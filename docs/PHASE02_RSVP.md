# Phase 2.2 — Xác nhận tham dự (RSVP)

## Phạm vi
- Thiệp mời có dữ liệu sự kiện Phase 2.1B, sử dụng danh sách khách hoặc chế độ tự nhập tên. Không thay đổi thiệp cũ, thiệp chúc mừng hoặc chế độ một người nhận thủ công.
- Mỗi lượt nhận có một trạng thái: `attending`, `declined`, `tentative`; `null` là chưa phản hồi. Có thể sửa trước giờ bắt đầu. Không tự động tạo phản hồi khi khách chỉ mở thiệp.
- Tự nhập tên định danh bằng mã lượt nhận trong phiên, không phải xác minh danh tính. Người có đường dẫn/mã nhận có thể trả lời thay khách; ưu tiên link riêng khi cần kiểm soát danh sách.
- Dùng quyền mở/gửi của thiệp; nếu tắt gửi phản hồi thì không được sửa RSVP. Quyền đọc phản hồi công khai không cấp quyền đọc danh sách RSVP.
- Chủ thiệp xem thống kê trong quản lý người nhận. Chưa mở rộng CSV/XLSX, nhắc lịch, số người đi cùng, bộ lọc RSVP hoặc RSVP cho link thủ công. Không thu thập thêm email/số điện thoại.

## Dữ liệu & API
`POST /api/gifts/gifts/:slug/rsvp?invite=...&r=...` nhận JSON `{ "status": "attending" }`. Cần mã nhận hợp lệ và mã mời nếu được yêu cầu. Trả `{ "rsvp": { "status": "attending", "updatedAt": "...", "canRespond": true } }`.

Public GET chỉ thêm `rsvp` cho lượt nhận hợp lệ trên thiệp hỗ trợ. GET danh sách người nhận của chủ thiệp có trường `rsvp` riêng, không thay thế trạng thái đã xác nhận tên/gửi lời nhắn. Cùng một lựa chọn được gửi lại giữ nguyên thời điểm; thay đổi trạng thái là cập nhật bản ghi hiện có, không tăng replyCount. Thao tác kiểm tra lại quyền/hạn sự kiện trong khóa ghi JSON hoặc giao dịch MySQL `SELECT ... FOR UPDATE` sẵn có, và dùng rate limiter hiện tại với key riêng theo lượt nhận. Giới hạn tổng lượt gửi vẫn áp dụng.

Lưu trạng thái trong `recipients` của payload quà đã xuất bản; không sửa documentSnapshot, không đổi schema SQL, không thêm dependency hoặc service Railway. Chưa nghiệm thu MySQL/Playwright trên môi trường tạo patch. Không thực hiện migration production.

## Kiểm tra
1. `npm run build && npm run check && npm test`
2. `npm run test:canvas` (fixture JSON độc lập), `npm run test:canvas:browser`. MySQL HTTP test chạy trong CI với schema QA mới; không chạy test MySQL trên Railway production.
3. Trên profile local độc lập, chọn Lời mời bên hiên, bật thông tin sự kiện có cấu trúc; ngày nằm trong thời hạn thiệp. Chọn danh sách khách (ít nhất hai khách) hoặc tự nhập tên. Xuất bản, mở từng link, chọn trạng thái, tải lại trang, đổi trạng thái. Chủ thiệp mở quản lý người nhận và kiểm tra thống kê. Chuyển VI/EN, kiểm tra mobile. Thử link sai và thu hồi thiệp.
4. Triển khai backend mới trước rồi cập nhật frontend cùng phiên bản trên Hostinger. Không chạy migration; kiểm tra cấu hình môi trường riêng. Backup dữ liệu trước khi phát hành.

## Tương thích
Backend mới thêm trường API có điều kiện. Frontend cũ bỏ qua trường mới; frontend mới không hiện RSVP khi API cũ chưa cung cấp. Dữ liệu đã ghi vẫn được giữ trong payload. Không rollback bằng cách phục hồi database cũ nếu đã có phản hồi mới; chỉ rollback code sau khi kiểm tra tương thích đọc/ghi.
