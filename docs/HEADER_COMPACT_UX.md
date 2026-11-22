# Header responsive trên laptop

## Phạm vi

Từ 901 đến 1150 px, thay vì ép 6 liên kết điều hướng ở cỡ 12 px, header hiển thị menu thu gọn đang có của ứng dụng. Các đường dẫn dùng chung cho VI và EN; nhãn lấy từ i18n, không tạo bản HTML mới cho tiếng Anh.

## Kiểm soát

- Menu sử dụng vùng chạm tối thiểu 48 px và cỡ chữ 15 px.
- Nút mở giữ `aria-expanded`, liên kết menu nằm trong navigation landmark.
- Escape đóng menu; đổi lên độ rộng >= 1151 px đóng menu tự động.
- Trên thiết bị giảm chuyển động, không phát animation mở menu.
- Không dùng `overflow-x: hidden` để che tràn layout.

## Kiểm thử

`npm run test:browser` kiểm tra VI/EN tại 1024 px. Test mở, đóng, ESC, resize lên desktop, cỡ chữ và scrollWidth.

## Giới hạn

Cần xem lại thực tế trên các mức zoom trình duyệt 125–200%, với chuỗi dịch dài và khi người dùng tăng cỡ chữ theo hệ điều hành. Nếu xung đột trên source mới, dừng ở `--check`.
