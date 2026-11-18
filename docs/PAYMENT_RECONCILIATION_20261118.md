# Momevia — Payment Lifecycle Phase 1 (18/11/2026)

## Mục tiêu

Thêm **đối soát chủ động, chỉ từ server** cho đơn đang `pending` mà không thay thế cơ chế webhook/IPN đã xác thực. Không yêu cầu migration và không thay đổi các bản ghi thanh toán cũ.

- `POST /api/checkout/payments/orders/:orderId/reconcile`: yêu cầu đăng nhập, kiểm tra quyền sở hữu; truy vấn payOS hoặc MoMo bằng thông tin merchant ở server.
- Đối chiếu `orderCode/orderId`, nhà cung cấp, **số tiền đầy đủ**, chế độ sandbox/live và mã giao dịch trước khi sử dụng `settleVerified` hiện có. Việc ghi `paid`, cấp `template_entitlements` và tạo `payment_receipts` vẫn nằm trong **một transaction MySQL**.
- Nếu provider trả `pending`, `processing`, `cancelled` hoặc kết quả chưa chắc chắn, hệ thống **KHÔNG** tự hủy đơn, giải phóng `payment_checkout_keys`, cấp quyền hoặc phát hành biên nhận. Với kết quả terminal, giao diện thông báo liên hệ Support để đối soát.
- Hạn chế truy vấn tối đa 1 lần/30 giây theo người mua + đơn trong **một process**. Không log API keys hay trả thông tin giao dịch của người khác.
- Nút **Đối soát với nhà cung cấp** tại trang `/payment-result/{orderId}`. Nút **Tải lại trạng thái** vẫn chỉ đọc từ dữ liệu nội bộ.

## Cách sử dụng

1. Đảm bảo các migration hiện tại (001–008) và MySQL chạy bình thường: `npm run db:ping && npm run db:verify`.
2. Để sandbox MoMo, đặt `NODE_ENV=development`, `PAYMENT_ENV=sandbox` cùng bộ credential MoMo sandbox và `PUBLIC_BASE_URL` HTTPS công khai. `PAYMENT_ENABLED=false` vẫn cho phép đối soát **giao dịch đã tạo trước đó**, nhưng không tạo giao dịch mới.
3. Chỉ bật thanh toán thực khi merchant đã được duyệt và có kế hoạch đối soát/hoàn tiền.
4. Chạy kiểm thử: `node --test tests/unit/payment-foundation.test.mjs tests/unit/payment-reconciliation.test.mjs` và toàn bộ CI.
5. Mở trang chi tiết giao dịch có trạng thái `pending` từ chính tài khoản người mua và nhấn **Đối soát với nhà cung cấp**; kiểm tra kết quả qua `db:verify`/DBeaver.

## Bảng quyết định

| Kết quả từ provider | Đơn Momevia | Quyền mẫu | Retry |
|---|---|---|---|
| Xác nhận `paid` + đúng mã, tiền, merchant | `paid` (qua transaction) | Cấp 1 lần | Không cần |
| `pending` / `processing` / chỉ `authorized` | Giữ `pending` | Không cấp | Chưa cho phép |
| `cancelled` / `failed` (từ query) | Giữ `pending`, yêu cầu đối soát thủ công | Không cấp | Chưa cho phép |
| Sai mã/tiền, sai môi trường, API lỗi | Từ chối đối soát | Không cấp | Chưa cho phép |

**Đây chưa phải quy trình hủy/retry hoàn chỉnh.** Không tự làm sạch đơn pending, không thay trạng thái thành `failed` chỉ do timeout; chuyển tiền muộn có thể vẫn xảy ra. Để triển khai Phase 2, phải xây trạng thái provider terminal được xác thực, đối soát giao dịch muộn, xử lý hoàn tiền và nhật ký audit bất biến; cần integration test sandbox có merchant thật trước khi mở bán.

## Tham khảo kỹ thuật

- MoMo: https://developers.momo.vn/v3/vi/docs/payment/api/payment-api/query/
- MoMo result codes: https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/resultcode/
- payOS API: https://payos.vn/docs/api/ (GET /v2/payment-requests/{id})

**Hạn chế xác minh:** Các bài test mới sử dụng HTTP response mô phỏng, không thực hiện giao dịch với merchant thật. Kiểm thử SDK/API live và MySQL thực tế là bước triển khai tại máy dev/CI của nhóm.
