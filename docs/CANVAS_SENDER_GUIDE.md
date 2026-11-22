# Thiết kế và gửi quà trên web

## Sender

1. Chọn **Dùng mẫu** để điền các trường mẫu hỗ trợ. Chọn **Chỉnh bố cục** để mở editor. Studio nhớ chế độ gần nhất theo tài khoản và nháp. **Tự thiết kế** hiển thị hình của ba bố cục khởi đầu gồm Trang trống, Phong bì và lời chúc, Hộp quà sinh nhật.
2. Điền tên hai bên và lời chúc. Mẫu có khung ảnh cho thay PNG/JPEG/WebP tới 2 MiB. Vùng khóa lấy từ phiên bản đã duyệt.
3. Bấm **Lưu nháp** hoặc chờ **Đã lưu · rN**. **Xem như người nhận** mở player xem thử với hồi đáp mô phỏng.
4. Bấm **Gửi** và chọn riêng quyền mở, gửi hồi đáp và đọc hồi đáp. Có thể tắt hồi đáp. Nếu mẫu có giá, app giữ nháp qua checkout và Sender chọn xuất bản khi quay lại. Thiệp trống cần chèn lời chúc hoặc ảnh vào một cảnh trước khi gửi.
5. Sao chép link, chia sẻ qua thiết bị nếu có hoặc tải QR. Nếu clipboard bị từ chối, sao chép thủ công từ ô được chọn. URL chia sẻ lấy từ `PUBLIC_BASE_URL`.
6. Studio hiển thị thời hạn, trạng thái quà và bộ lọc **Chưa đọc** trong hộp thư. **Tặng người khác từ bố cục này** tạo nháp sạch, dùng đúng phiên bản nguồn khi còn quyền. **Lưu trữ bản nháp** cất nháp. **Ngừng chia sẻ món quà** thu hồi quyền mở link, ảnh và hồi đáp công khai.

Link mời cấp quyền cho người giữ link. Người nhận hồi đáp theo quyền đã chọn khi gửi. Quà legacy giữ quyền ban đầu đến khi hết hạn hoặc bị thu hồi. Quà đã gửi giữ bản chụp và ảnh từ thời điểm xuất bản.

### Tớ đoán cậu sẽ chọn…

Trong thư viện, tìm **Tớ đoán** và chọn mẫu sinh nhật miễn phí của Momevia Originals. **Dùng mẫu** mở nháp trống có câu hỏi, hai lựa chọn, một dự đoán A/B, lý do và lời kết riêng cho từng lựa chọn. Có thể lưu khi đang viết dở. Khi gửi, điền đủ nội dung và giữ hai lựa chọn khác nhau. Đổi nhãn lựa chọn không đổi mã dự đoán. Người nhận chọn rồi mới thấy dự đoán; lời kết theo điều người nhận chọn. **Chơi lại** hoặc tải lại giữ nguyên dự đoán đã gửi. [Demo sinh nhật và kịch bản quay](TO_DOAN_CAU_SE_CHON_BAN_DAU.md).

### Chỉnh bố cục

- Vào **Thêm** để chọn trong 100 thẻ. Chọn **Tất cả** hoặc một trong bảy nhóm, rồi tìm bằng từ có dấu hoặc không dấu. Ví dụ, “con dau” tìm được Con dấu sáp và “anh ghep” tìm được Ảnh ghép một lớn hai nhỏ. Hình thu nhỏ hiển thị các lớp sẽ được chèn. [Danh mục 100 thẻ](CANVAS_100_ELEMENTS_PLAN.md#2-danh-mục-đích)
- Chọn một lớp trên thiệp hoặc từ **Lớp**. Với chữ, dùng **Sửa trên thiệp**, nhấp đúp vào chữ, hoặc nhấn Enter khi vùng thiệp có focus. Ctrl+Enter xác nhận, Escape hủy. Chữ liên kết dùng chung tên hoặc lời chúc trong các cảnh. Bảng **Chỉnh** có mẫu font, cỡ, màu, căn chữ, giãn dòng và độ mờ. Tọa độ, rộng, cao, xoay và căn vị trí phần tử nằm trong **Vị trí và kích thước**.
- Với ảnh, chọn **Thay ảnh**, **Lấp khung** hoặc **Vừa ảnh**, rồi kéo điểm lấy nét hoặc nhập phần trăm ngang và dọc. **Đặt lại crop** đưa điểm nét về giữa. Mô tả ảnh tối đa 240 ký tự. Chọn **Ảnh trang trí** nếu ảnh không cần đọc mô tả. Chọn từng lớp ảnh trong dải phim, bưu thiếp hay ảnh ghép để sửa riêng. Album vuốt cần ít nhất một ảnh và thanh so sánh cần đủ hai ảnh. Mỗi ô có mô tả và chú thích riêng.
- Với **Hai cửa chọn câu chuyện**, đặt một cảnh đích riêng cho mỗi cửa. Với **Đồng hồ đếm ngược**, chọn múi giờ và nhập ngày giờ theo múi giờ đó. Quà hiện lời chúc khi đến giờ. Nút **Mở ngay** trên vé cào và **Trước/Sau** trong album cũng dùng được bằng bàn phím.
- Chọn một lớp để mở **Kiểu bề mặt**, **Khi xuất hiện**, **Nhấn mạnh** và **Khi kích hoạt** theo loại lớp. Chọn cảnh để chỉnh **Khi vào cảnh** và **Không khí**. **Xem thử** phát hiệu ứng đang chỉnh. Chọn **Tắt** hoặc **Bỏ hiệu ứng** để bỏ thiết lập. Người nhận có thể tắt chuyển động cho phiên xem.
- **Cảnh** có hình thu nhỏ và menu để nhân bản, đổi thứ tự, đặt cảnh mở đầu hoặc xóa. Nút chuyển cảnh cần chọn **Cảnh đích** theo tên và hình thu nhỏ. Đổi thứ tự lớp thay đổi lớp nào nằm trước trên thiệp. Trình tự đọc và Tab theo thứ tự nội dung.
- Trên điện thoại, dùng **Thêm**, **Lớp**, **Chỉnh** và **Cảnh** ở thanh dưới. Nút đóng hoặc Escape trả focus về nút mở bảng. Mỗi lần chèn cụm, kéo phần tử hoặc kéo điểm nét là một bước hoàn tác.

## Creator và Admin

Creator vào **Mẫu của tôi** để tạo, mở, nhân bản và xem thử nháp. Khi gửi duyệt, chọn vùng chữ, khung ảnh, cảnh dùng làm bìa và ghi nguồn/quyền phân phối ảnh demo. Với lớp tên đang hiển thị, mở trường tên để Sender nhập hoặc đổi lớp đó thành chữ cố định trung tính. Lần gửi tiếp theo nạp cấu hình gần nhất, yêu cầu xác nhận nguồn ảnh mới và hiển thị thay đổi cho Creator lẫn Admin.

Ảnh đại diện, chi tiết, preview và nút dùng mẫu trỏ cùng phiên bản đã duyệt. Rút mẫu hoặc mất vai trò Creator dừng lượt dùng mới. Nháp Sender đã bắt đầu giữ quyền theo nguồn, và quà đã gửi giữ snapshot. [Thử các trạng thái bằng web demo](DEMO_WEB.md)

## Khi lưu bị gián đoạn

| Hiện tượng | Cách xử lý |
| --- | --- |
| Đang lưu | Chờ ACK khi chuẩn bị checkout hoặc xuất bản |
| Mất mạng | Mở lại bằng đúng tài khoản và chọn khôi phục bản cục bộ rồi thử lưu lại |
| Xung đột revision | Xem bản server trước khi chọn dùng bản server hay giữ bản chỉnh cục bộ |
| Ảnh lỗi | Dùng ảnh trước hoặc chọn tệp hợp lệ để thay |
| Checkout đang xác nhận | Kiểm trạng thái/biên nhận ở trang kết quả rồi quay lại đúng nháp |

[Cờ canvas, sao lưu và cập nhật ứng dụng](OPERATIONS.md)
