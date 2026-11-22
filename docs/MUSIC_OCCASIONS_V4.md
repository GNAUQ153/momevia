# Momevia — Music Occasion Library V4

Ngày 22/11/2026. Source gốc: `Momevia_Main_Latest_20261122(2).zip`.

## Nội dung

| ID | Dịp | Cảm xúc | Tên VI / EN |
| --- | --- | --- | --- |
| birthday-sparkle | Sinh nhật | Tươi vui | Nến lung linh / Birthday Sparkle |
| wedding-promise | Đám cưới | Êm dịu | Lời hẹn trăm năm / Wedding Promise |
| christmas-lights | Giáng sinh | Tươi vui | Ánh đèn mùa đông / Winter Lights |
| newyear-countdown | Tết dương lịch | Tươi vui | Khoảnh khắc giao thừa / New Year Moment |
| tet-spring | Tết Nguyên đán | Tươi vui | Sắc xuân sum vầy / Spring Reunion |
| valentine-whisper | Valentine | Êm dịu | Lời thì thầm / Valentine Whisper |

Thư viện cũ (`calm-dawn`, `dreamy-night`, `bright-day`, `little-celebration`) vẫn giữ ID và file. Tổng hiện tại: 10 bản MP3.

## Trải nghiệm người dùng

Sender: mở Designer → bộ lọc dịp → cảm xúc → tên/mô tả → chọn bài → nghe thử và chỉnh âm lượng → lưu/đăng thiệp. Recipient mở link, nhạc **không tự phát**; chỉ phát khi bấm nút. Trên màn hình hẹp, filter và cards dùng layout sẵn có, có thêm hiệu ứng hover chiều sâu nhẹ nhưng không ép chuyển động khi bật reduced-motion.

**Giữ tương thích:** dữ liệu Canvas tiếp tục chỉ lưu `{ id, volume }`. Không ghi mood, occasion, URL hoặc nội dung âm thanh vào snapshot; việc kiểm tra ID nằm tại `soundtrackById()` và `schema.js`. Không cần migration database.

## Tái tạo audio và kiểm soát bản quyền

Sử dụng `python scripts/assets/generate-occasion-music.py`. Cần Python 3, NumPy và FFmpeg (`libmp3lame`). Script tự tổng hợp sóng và chuỗi nốt tự biên soạn thành sáu MP3 24 giây. **Không sử dụng giai điệu Happy Birthday hay các bài hát Giáng sinh/thương mại có sẵn**, không dùng sample hay nguồn stream ngoài.

Các bản mới là tài nguyên nội bộ dự án, không khẳng định đã được kiểm tra quyền sử dụng với bất kỳ hiệp hội bản quyền nào. Nhóm cần xác nhận quyền sở hữu/khai thác, giấy phép sử dụng thương mại, đánh giá chất lượng nghe và nếu cần lập hồ sơ đăng ký. Không bật upload MP3 tự do ở V4: upload cần giới hạn định dạng/dung lượng, quét và cơ chế chứng minh bản quyền riêng.

## Checklist

1. `npm ci`, `npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser`, `npm run i18n:audit`.
2. Thử bộ lọc Dịp: mỗi dịp mới trả 1 bài; chọn `Tất cả dịp` trả 10 bài; kết hợp Êm dịu / Tươi vui.
3. Tìm `sinh nhat`, `dam cuoi` ở VI và `birthday`, `wedding` ở EN; kiểm tra khi chuyển ngôn ngữ giao diện giữ cùng layout.
4. Nghe thử tất cả sáu bài, đổi bài khi đang phát, kiểm tra volume 0–100% và Undo/Redo.
5. Xuất bản thiệp Canvas V2 rồi mở bằng Recipient trên iOS/Android; nút phát hoạt động sau click, không autoplay.
6. Kiểm tra người dùng không thể chèn URL ngoài hoặc ID không tồn tại vào `soundtrack`.
7. Rà chất lượng nhạc bằng tai nghe và loa ngoài; kiểm tra loop 24 giây (không clipping/pop), bitrate, mobile data.

Không xem kết quả CI là xác nhận chất lượng âm nhạc hay giấy phép thương mại.
