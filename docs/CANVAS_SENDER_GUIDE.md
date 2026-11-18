# Thiết kế và gửi quà trên web

## Sender

1. Chọn **Cá nhân hóa nhanh** ở chi tiết mẫu để điền trường mẫu hỗ trợ. Chọn **Chỉnh bố cục** để mở editor. Chuyển chế độ giữ cùng một nháp. Studio có **Tự thiết kế** để tạo trang trống hoặc bố cục phong bì.
2. Điền tên hai bên và lời chúc. Mẫu có khung ảnh cho thay PNG/JPEG/WebP tới 2 MiB. Editor có cảnh, lớp, crop, tọa độ, kéo và resize. Vùng khóa lấy từ phiên bản đã duyệt.
3. Bấm **Lưu nháp** hoặc chờ **Đã lưu · rN**. **Xem như người nhận** mở player xem thử với hồi đáp mô phỏng.
4. Bấm **Gửi** và chọn riêng quyền mở, gửi hồi đáp và đọc hồi đáp. Có thể tắt hồi đáp. Nếu mẫu có giá, app giữ nháp qua checkout và Sender chọn xuất bản khi quay lại. Thiệp trống cần chèn lời chúc hoặc ảnh vào một cảnh trước khi gửi.
5. Sao chép link, chia sẻ qua thiết bị nếu có hoặc tải QR. Nếu clipboard bị từ chối, sao chép thủ công từ ô được chọn. URL chia sẻ lấy từ `PUBLIC_BASE_URL`.
6. Studio hiển thị thời hạn, trạng thái quà và hộp thư. **Lưu trữ bản nháp** cất nháp. **Ngừng chia sẻ món quà** thu hồi quyền mở link, ảnh và hồi đáp công khai.

Link mời cấp quyền cho người giữ link. Người nhận hồi đáp theo quyền đã chọn khi gửi. Quà legacy giữ quyền ban đầu đến khi hết hạn hoặc bị thu hồi. Quà đã gửi giữ bản chụp và ảnh từ thời điểm xuất bản.

## Creator và Admin

Creator vào **Mẫu của tôi** để tạo, mở, nhân bản và xem thử nháp. Khi gửi duyệt, chọn vùng chữ, khung ảnh và ghi nguồn/quyền phân phối ảnh demo. Người duyệt mở đúng revision đã chốt, thử nội dung và ảnh, xác nhận quyền tài nguyên, rồi duyệt hoặc ghi lý do yêu cầu sửa.

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
