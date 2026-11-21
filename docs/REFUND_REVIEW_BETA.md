# Momevia — Refund Review Beta (quy trình rà soát nội bộ)

## Phạm vi

Giai đoạn này bổ sung **hồ sơ yêu cầu hoàn tiền** cho Buyer và **hàng đợi phân loại** cho Admin, dành cho đơn thanh toán MoMo/payOS đã xác minh và có biên nhận. Chỉ hoạt động khi `CHECKOUT_STORAGE=mysql` và MySQL đã được migrate đến `010_refund_review`.

**Đây không phải refund engine.** Không gọi API hoàn tiền, không đánh dấu “đã hoàn tiền”, không cập nhật `orders`, `payment_intents`, `creator_ledger` hay `template_entitlements`, không chi trả hoặc đảo bút toán. Trạng thái `awaiting_provider` có nghĩa **đang chờ đối chiếu với nhà cung cấp**, không đồng nghĩa tiền đã được hoàn.

## Luồng Buyer

1. Đăng nhập và mở `/payment-result/<order-id>` của **chính mình**.
2. Nếu đơn đã `paid` và API MySQL hoạt động, chọn lý do và mô tả từ 10–500 ký tự. Không đưa thông tin tài khoản ngân hàng hoặc dữ liệu nhạy cảm.
3. POST `/api/checkout/payments/orders/:orderId/refund-request` tạo một hồ sơ `submitted` và ghi sự kiện trong cùng transaction. `UNIQUE(order_id)` hạn chế trùng hồ sơ.
4. POST lặp lại với cùng lý do/nội dung được trả về hồ sơ cũ; nếu thay đổi lý do hoặc mô tả, API trả `409` thay vì giả vờ ghi đè.
5. GET cùng URL cho phép Buyer xem trạng thái hồ sơ của chính mình. Không có hồ sơ trả về `null` (không làm lộ hồ sơ của người khác).

## Luồng Administrator

1. Mở `/admin/payments` và xem mục “Hồ sơ yêu cầu hoàn tiền”.
2. Chọn trạng thái nội bộ và nhập ghi chú từ 10–500 ký tự.
3. Chuyển trạng thái theo bảng dưới, với `expectedStatus` để ngăn cập nhật bằng dữ liệu cũ.
4. Kiểm tra lịch sử xử lý; mỗi trạng thái được ghi sự kiện append-only kèm actor ID và thời gian.

| Trạng thái hiện tại | Trạng thái hợp lệ tiếp theo |
| --- | --- |
| `submitted` | `in_review`, `closed_declined` |
| `in_review` | `awaiting_provider`, `closed_declined` |
| `awaiting_provider` | `in_review` |
| `closed_declined` | Không có |

Không có thao tác hoàn tiền thực hoặc trạng thái `refunded` ở giai đoạn này.

## Quyền và bảo mật

- Mọi API lấy người dùng/role qua **phiên được server xác minh**; không tin `role`, `userId` hay `creatorId` gửi từ trình duyệt.
- Buyer chỉ tạo hồ sơ cho `orders.user_id = session.sub`, đơn `paid` và có `payment_receipts`.
- Admin mới được liệt kê toàn bộ hồ sơ, xem lịch sử và thay trạng thái.
- Trạng thái lưu vào MySQL qua transaction và `SELECT ... FOR UPDATE`. Ghi chú và mô tả được giới hạn độ dài, xuất HTML có escape.
- Không trả về provider payload, checkout URL, bí mật webhook hay số tài khoản.
- Thông tin Buyer nhập có thể chứa dữ liệu cá nhân: cần chính sách lưu giữ/xóa, quyền truy cập của nhân viên và quy trình chống nhập PII nhạy cảm trước khi thương mại hóa.

## Migration

1. **Sao lưu MySQL thực tế trước khi chạy DDL** (không chỉ sao lưu source).
2. Áp dụng bản vá code, xác nhận bằng `git diff --check`, `npm run check`, `npm test`.
3. Trên MySQL thử nghiệm, chạy `npm run db:migrate` để áp dụng migration `010_refund_review`.
4. Chạy `npm run db:verify` và kiểm tra bảng `refund_review_requests`, `refund_review_events`.
5. Kiểm tra phân quyền bằng ít nhất hai tài khoản Buyer, một Admin; thử POST lặp, xung đột expectedStatus, trạng thái không hợp lệ và live/sandbox.

**Lưu ý về triển khai:** bản code mới không tự chạy migration. Nếu chưa có bảng, API phải báo chưa khả dụng và UI không được coi là “0 yêu cầu”. Không bật cấu hình `PAYMENT_LIVE_ENABLED=true` để kiểm thử beta này.

## Việc chưa triển khai

- Chính sách hoàn tiền và thời gian xử lý theo hợp đồng.
- Tích hợp nhà cung cấp hoàn tiền thật và xác nhận kết quả bằng thông báo có chữ ký.
- Ghi bút toán đảo Creator và đối soát accounting ledger dưới transaction.
- Kiểm thử schema MySQL thực tế, kịch bản rollback migration, retention/audit access policy.
