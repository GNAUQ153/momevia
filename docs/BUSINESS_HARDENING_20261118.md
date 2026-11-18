# Momevia Business Hardening — 2026-11-18

Bản vá trên **Momevia_Main_Latest_20261118.zip**, không phải toàn bộ nhánh GitHub `main` sau thời điểm ZIP được tạo. Chỉ cập nhật code nghiệp vụ/UI và bài kiểm thử; không có migration MySQL.

## Đã sửa

1. **Thanh toán live:** MoMo/payos chỉ được hiển thị khi `PAYMENT_ENV=production` **và** `PAYMENT_LIVE_ENABLED=true`; với sandbox, chỉ cho dùng khi `NODE_ENV` khác production. `PAYMENT_ENABLED=true`, Identity/Catalog/Checkout trên MySQL và credential vẫn là điều kiện bắt buộc. Việc đặt `NODE_ENV=development` không còn vô tình kích hoạt MoMo production khi live flag tắt.
2. **Webhook đang xử lý:** tắt cờ mở giao dịch live mới không được làm rớt webhook **đã xác minh chữ ký** từ giao dịch live đang chờ. Triển khai production vẫn chặn callback sandbox.
3. **Intent/QR cũ:** khi user yêu cầu provider khác trong lúc có đơn pending, API trả `409` thay vì âm thầm trả QR provider cũ. Intent `paid`/`failed`/`cancelled` không được trả về như một đơn mới.
4. **Giao dịch pending lâu:** API trạng thái gửi `pendingSince`, `needsReview` và `notice` khi chờ từ 30 phút. Trang kết quả gợi ý liên hệ Support và không thanh toán lại trước khi đối soát. Không tự hủy, mở khóa hoặc retry chỉ vì quá 30 phút.
5. **Creator rút mẫu:** `reusable` từ chối tạo lượt tặng/nháp mới từ template đã `withdrawn` hoặc không còn `published`, kể cả phiên bản cũ đã được duyệt. Snapshot quà đã gửi không bị xóa.
6. **Admin Support:** nhận xử lý và đóng ticket thường **và** báo cáo vi phạm; vẫn yêu cầu Admin, bảo vệ người nhận xử lý và điều kiện trạng thái, dùng optimistic conditional update trong MySQL. UI Admin hiển thị trạng thái và nút xử lý cho ticket thường.

## Chưa thực hiện — chặn go-live cho Marketplace thu tiền thật

- **Vòng đời đơn hàng đầy đủ:** `pending → failed/cancelled/expired → retry` chỉ được giải phóng khóa sau khi đối chiếu trạng thái cuối với **provider**, kể cả late webhook, partial/duplicate paid events, và hoàn tiền. Không an toàn nếu tự gỡ khóa `payment_checkout_keys` khi hết thời gian — người mua vẫn có thể chuyển khoản trên QR cũ.
- **Đối soát/hoàn tiền:** chưa có background worker quản lý đơn treo, reconciliation, dispute, partial refund, cảnh báo giao dịch trả muộn và cân bằng sổ cái.
- **Creator Marketplace:** chưa có định giá qua Canvas Creator, quy tắc chiết khấu theo chủ mẫu, điều chỉnh phí khi refund, doanh thu có thể rút và payout. Hiện công thức 20% không được dùng làm chính sách tài chính chính thức.
- **Admin operations:** ticket đã có vòng đời cơ bản, nhưng còn thiếu escalation, phân loại ưu tiên, SLA, lịch sử thao tác, gửi email kết quả và trang quản lý đối soát/hoàn tiền.
- **Production hardening:** chưa kiểm thử trên MySQL container/merchant sandbox thật trong bản vá này; không bật tiền thật. Các test độc lập không chứng minh toàn bộ hệ thống sẵn sàng production.

## Triển khai an toàn

1. Kiểm tra source local có tương ứng ZIP ngày 2026-11-18 và `git status` sạch. Nếu Lộc push thêm sau ZIP, so sánh diff và áp dụng patch thử trước; không ghi đè source mới.
2. `git apply --check` rồi `git apply` patch, hoặc trên source khác biệt thử `git apply --3way --check` và xử lý conflict thủ công.
3. `node --test tests/unit/business-hardening.test.mjs tests/unit/payment-foundation.test.mjs tests/unit/mysql-support.test.mjs`.
4. Sau `npm ci`, chạy `npm run build && npm run check && npm test && npm run test:architecture && npm run package && npm run verify:package`.
5. Kiểm thử thủ công: mẫu Creator rút không tặng lại được, quà đã gửi vẫn mở được theo quyền; Admin xử lý ticket thường; MoMo sandbox mới hiển thị khi cấu hình; trạng thái pending lâu không tự phát QR/mở khóa.
6. Kiểm tra `git diff --check` và `git diff --cached --check`, loại `.env`, secret, backup trước khi commit; push `main` chỉ sau PASS và theo phối hợp của nhóm.

**Không cần thêm migration**; patch không tự bật thanh toán và không sửa các khóa API.
