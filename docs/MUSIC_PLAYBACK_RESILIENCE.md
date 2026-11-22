# Music Playback Reliability — 2026-11-22

## Phạm vi

- Xử lý sự kiện `error`, `pause`, `ended` của HTMLAudioElement sau khi người dùng bắt đầu phát.
- Dừng nghe thử của Sender khi tab Editor bị ẩn, không tự phát lại khi tab hiện.
- Hủy đăng ký sự kiện khi dispose; không truyền dữ liệu audio, thông tin người dùng hoặc telemetry ra ngoài.

## Tình huống kiểm tra

1. Bắt đầu phát nhạc rồi chặn/tắt tệp MP3: nút phải trở về Phát và hiển thị thông báo lỗi (VI/EN).
2. Phát rồi dừng bằng điều khiển media của hệ điều hành: nút về Phát.
3. Đang gọi `play()` rồi đóng trang: Promise trả muộn không tự bật nhạc.
4. Nghe thử trong Designer rồi chuyển tab: audio dừng, trở lại tab không autoplay.
5. Giữ nguyên nhạc và âm lượng đã lưu trong Canvas; không thay đổi dữ liệu hoặc tác động đến SVG template trên máy người dùng.

## Rủi ro tồn đọng

- Cần chạy Browser Regression và kiểm tra bằng thiết bị thực tế vì Web Audio/HTMLAudioElement hoạt động khác nhau giữa browser.
- Không mặc định bật âm thanh; không thêm nguồn ngoài allowlist.
