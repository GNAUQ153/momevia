# Phase 2.5A — Vòng đời và kho thiệp Sender

## Quy tắc nghiệp vụ

- `active`: link còn hạn và chưa bị thu hồi. `expired`: hết hạn (bao gồm đúng mốc hết hạn) hoặc không có thời hạn hợp lệ. `revoked`: thu hồi, được ưu tiên hơn hết hạn.
- Kho lưu trữ là trạng thái tổ chức danh sách riêng của Sender, không phải trạng thái mở link. Chỉ thiệp đã đóng được lưu trữ. Đưa lại danh sách không khôi phục link, không đổi slug, quyền, snapshot, lịch sử phản hồi hoặc RSVP, không hoàn credit và không tạo đơn hàng.
- `senderArchivedAt` nằm trong payload gift (MySQL JSON hoặc kho JSON), không cần migration. Thiệp cũ không có thuộc tính này tiếp tục hiện bình thường. Giá trị null là đã đưa lại danh sách. Không trả metadata kho lưu trữ trong public gift view.
- `POST /api/gifts/gifts/mine/:slug/archive`, body `{ "archived": true }` hoặc `{ "archived": false }`, response `{ "senderArchivedAt": "..." }` hoặc null. Yêu cầu session, sai chủ thiệp trả 404, thiệp đang hoạt động không thể lưu trữ (409), body sai trả 422. Kiểm tra lại chủ và trạng thái trong thao tác ghi hiện có. Gọi lại cùng trạng thái không thay timestamp đã lưu.
- Đọc tài nguyên Canvas MySQL kiểm tra trạng thái đóng lần nữa khi lấy asset. Đây không phải cơ chế hủy byte đã tải hoặc stream đang chạy.

## Kiểm thử và triển khai

Chạy `node --test tests/unit/phase02-gift-lifecycle.test.mjs`, `npm test`, `npm run build`, `npm run check`, `npm run test:canvas` và `npm run test:canvas:browser`. Fixture `tests/integration/rsvp.mjs` dùng bởi cả JSON và MySQL HTTP integration kiểm tra quyền chủ thiệp, lưu trữ, khôi phục, bảo toàn RSVP và Legacy. Chỉ chạy MySQL integration trong QA cô lập, không dùng Railway production.

Kiểm tra Studio bằng cả VI/EN, bàn phím, mobile: thiệp active không có nút lưu trữ; thiệp hết hạn/thu hồi có nút; kho thu gọn mở được, vẫn đọc lịch sử; đưa về danh sách không mở lại thiệp. Cập nhật backend trước frontend. Frontend cũ bỏ qua metadata mới; frontend mới chỉ đưa thiệp vào kho khi server xác nhận.

Không đổi flags payment/quota, không thêm service hoặc dependency. Không thay đổi TTL hiện hành (`GIFT_TTL_DAYS`), không bật gia hạn trả phí hoặc tự gia hạn; cần chốt hạn mức, giá, chính sách hồi sinh thiệp hết hạn và quyền lịch sử trước khi triển khai gia hạn. Không chạy migration 017–019 ngoài quy trình nghiệm thu đã có.
