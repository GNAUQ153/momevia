# Momevia – Báo cáo doanh thu Creator/Admin (chỉ đọc)

## Phạm vi

- `GET /api/checkout/payments/creator/statement?limit=20`: tài khoản Creator/Admin chỉ xem doanh thu của **chính mình** (theo `sub` từ phiên); tối đa 100 dòng gần nhất.
- `GET /api/checkout/payments/admin/finance`: chỉ Admin; tổng hợp live/sandbox riêng, báo đơn đã thanh toán chưa có sale ledger.
- Chỉ thống kê các đơn `paid` có `payment_receipts`, không tính đơn demo `demo_paid`, pending hay hủy. Không đọc hoặc trả buyer ID, email, secrets hoặc URL thanh toán.
- Khoản phân bổ creator không phải "available balance" và không phải cam kết chi trả. Chưa triển khai khấu trừ phí nhà cung cấp, thuế, hoàn tiền, payout hoặc số dư khả dụng.

## Bảo toàn dữ liệu

Khi webhook hợp lệ được xử lý, `orders`, `payment_receipts`, `template_entitlements` và `creator_ledger(category='sale')` được ghi **trong cùng transaction**. `creator_id` lấy từ mẫu khi thanh toán được xác nhận và lưu nguyên; mẫu hệ thống không sinh sale ledger. `creator_ledger.id=order.id` khiến một đơn chỉ ghi sale một lần; replay webhook trả về ngay mà không ghi thêm.

Dữ liệu các đơn `paid` trước bản cập nhật có thể chưa có sale ledger và **không tự suy đoán người nhận tiền hồi tố**. Admin API báo `missingSaleEntries` để đội vận hành đối chiếu trước khi chạy migration/backfill có phê duyệt. Không tự backfill và không tự gửi tiền.

## Điều kiện hoạt động

Cần `CHECKOUT_STORAGE=mysql`, migration hiện có (`creator_ledger` trong 001, `payment_receipts` trong 005), và kết nối DB hợp lệ. JSON/demo chỉ hiển thị thông báo báo cáo chưa khả dụng; giao diện làm việc bình thường.

## Kiểm thử

`npm run check`, `npm test`, `npm run build`, `npm run test:browser`. Cần kiểm thử MySQL container với webhook hợp lệ/trùng, timeout và rollback để xác nhận transaction, phân quyền, multi-instance. Tất cả các điều này không đồng nghĩa hệ thống được phép chạy payment live.
