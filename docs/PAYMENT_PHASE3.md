# Momevia — Payment Phase 3: UX an toàn và kế hoạch Cancellation/Retry

## Đã hoàn thiện trong bản này

- Làm rõ trạng thái kết quả cho người mua: `pending`, `paid`, cần đối soát thủ công.
- Khi pending, chỉ hiển thị **Tải lại trạng thái**, **Đối soát với nhà cung cấp** (API hiện có) và **Liên hệ hỗ trợ** khi quá hạn.
- Không có nút tự mở đơn mới, huỷ, hoàn tiền hoặc tự ghi `paid` từ frontend.
- Hiển thị mã đơn và số tiền đã ghi tại backend, không tin querystring/redirect.
- Giữ nguyên hiển thị biên nhận thành công, xử lý biên nhận chưa tải được và resume nháp.

## Chưa hoàn thiện: xử lý tiền thực tế

Không được coi `terminal_review`, `cancelled`, timeout hoặc mất mạng là bằng chứng chắc chắn không có tiền chuyển muộn. Trước khi thêm API `cancel`/`retry` phải có:

1. **State machine** thống nhất (`pending`, `paid`, `cancel_requested`, `cancel_verified`, `review`, `refunded`), chỉ thêm trạng thái sau khi có migration, test và xác nhận logic provider tương ứng.
2. **Hợp đồng provider**: xác định bằng chứng hủy cuối cùng từ payOS và MoMo; kiểm tra dư tiền, trạng thái ngân hàng và thời gian eventual consistency. Không suy diễn từ redirect UI.
3. **Transaction MySQL**: khóa định danh checkout trên hàng transaction, ghi idempotency, giải phóng quyền thử lại **chỉ khi** xác minh terminal bằng provider, không cấp entitlement/receipt hai lần.
4. **Late webhook**: callback đã ký đến sau khi hủy phải được xử lý theo quy trình reconciliation/refund và audit bất biến, không tự bỏ qua.
5. **QA**: race conditions, timeout, IPN lặp, callback đến muộn, xác minh số tiền và environment, refund với merchant sandbox.
6. **Operational sign-off**: quy trình hoàn tiền và hỗ trợ trước khi bật live.

Vì chưa đủ bằng chứng từ sandbox provider và quy trình refund, bản này chỉ cập nhật **an toàn hiển thị**. **Không có endpoint hoặc migration hủy/retry mới** để tránh nguy cơ mất tiền hoặc trùng quyền.
