# Momevia — Payment Lifecycle Phase 2 (Admin review + audit)

## Phạm vi

- Migration **009_payment_reconciliation_audit** tạo bảng `payment_reconciliation_attempts` chỉ ghi metadata (`intent_id`, `actor_id`, `outcome`, thời điểm). **Không ghi** provider credential, IPN body hoặc dữ liệu thẻ ngân hàng.
- `GET /api/checkout/payments/admin/review?limit=50`: session Admin hiện hành, trả danh sách **đơn chưa thanh toán, pending từ 30 phút**, tối đa 100 dòng. Không chứa `checkout_url`, QR, token hoặc PII người mua.
- `GET /api/checkout/payments/admin/orders/:orderId/audit?limit=50`: chỉ Admin, lịch sử truy vấn provider theo thứ tự thời gian ngược, tối đa 100 dòng.
- Mỗi lần người mua gọi endpoint Phase 1 để đối soát provider, service lưu kết quả quan sát (paid/pending/terminal/error/mismatch). **Audit không phải bằng chứng ngân hàng đã thu tiền**; chỉ việc `settleVerified` thành công với dữ liệu đã xác thực mới cấp entitlement/receipt.

## Triển khai local

1. Sao lưu MySQL trước khi thay đổi schema. Không chạy `docker compose down -v` hoặc xóa dữ liệu.
2. Pull source mới nhất, áp dụng patch. Chạy `npm run db:migrate` để lên migration 009. Nếu hệ thống không tự tạo quyền migration, dùng tài khoản migration thích hợp theo hướng dẫn MySQL trong docs.
3. `npm run db:ping && npm run db:verify` và `node --test tests/unit/payment-review.test.mjs tests/unit/payment-reconciliation.test.mjs`.
4. Chạy Full CI local, kiểm thử với một đơn pending sandbox quá 30 phút; đăng nhập Admin rồi truy cập các API qua browser session.
5. Bất kỳ trạng thái không chắc chắn đều **giữ khóa checkout**. Không tự hủy đơn hoặc cho retry chỉ vì quá 30 phút.

## Bảo mật và giới hạn

- Chỉ dữ liệu từ phiên Admin thực được trả về; vai trò được kiểm tra phía server tại mỗi request.
- API Admin **chỉ đọc**, không có chức năng cấp quyền, sửa giá, hủy, hoàn tiền hoặc thao tác với provider. Cần RBAC chi tiết và audit hành động Admin trước khi cung cấp các chức năng ghi.
- Audit chỉ ghi cho thao tác `reconcile` thực sự gọi provider; không ghi các lần xem `status` hoặc vượt hạn mức.
- Hạn mức Phase 1 là in-memory từng process, chưa phải distributed throttling. Audit hiện tại chỉ là log của query, không thay cho ledger tài chính, webhooks hay đối soát độc lập từ báo cáo ngân hàng.
- Chưa kiểm thử trên merchant/sandbox thật và chưa hoàn thiện luồng huỷ–retry. **Không bật thanh toán live.**
