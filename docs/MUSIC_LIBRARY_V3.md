# Music Library 3.0 — Giai điệu theo cảm xúc

Ngày 22/11/2026. Baseline: `Momevia_Main_Latest_20261122.zip` và các bản cập nhật nhạc đã qua CI trên `main` (đến Music Playback Resilience).

## Thay đổi

- Thư viện tăng từ 2 lên 4 giai điệu; thêm **Đêm mơ màng** (`dreamy-night`) và **Ngày hân hoan** (`little-celebration`).
- Sender có thẻ chọn nhạc trực quan và bộ lọc hai nhóm **Êm dịu** / **Tươi vui**. Dropdown cũ vẫn tồn tại và dùng chung một cơ chế thay đổi Canvas, nhằm giữ tương thích và khả năng sử dụng bằng bàn phím.
- Các thẻ có `aria-pressed`, trạng thái focus, khoảng chạm phù hợp. Bản dịch VI/EN dùng chung một bộ điều khiển; giảm chuyển động theo hệ điều hành.
- Chỉ có metadata cục bộ tại `web/js/shared/canvas/soundtracks.js`; tài liệu Canvas vẫn **chỉ** lưu `{ id, volume }`, không lưu URL, mô tả, mood hay file nhạc. Không thay đổi API, database, schema hoặc quyền sở hữu.
- Âm thanh vẫn chỉ phát khi Sender nghe thử hoặc Recipient bấm Phát nhạc, không autoplay. Track không tồn tại bị backend từ chối.

## Provenance / bản quyền

Hai MP3 **mới** được tổng hợp bằng hàm tạo sóng (sine, harmonic, pad, delay) và chuỗi hợp âm/nốt tự biên soạn, **không sử dụng sample hoặc tác phẩm âm nhạc bên ngoài**. Để tái tạo, dùng `python scripts/assets/generate-music-v3.py` (yêu cầu Python 3 + NumPy + FFmpeg có libmp3lame). Script chỉ dùng trong bảo trì, không chạy khi triển khai sản phẩm. MP3 hiện được phát từ cùng origin qua `/assets/music/`, không đưa token hoặc dữ liệu cá nhân vào âm thanh.

Trước khi thương mại hóa, chủ dự án cần xác nhận hồ sơ quyền khai thác cho tất cả 4 bản, điều khoản sử dụng và quy trình quản lý giấy phép. Không sao chép nhạc thương mại vào thư viện khi chưa có quyền.

## Kiểm thử và ranh giới

- Test metadata/path MP3, lọc mood, VI/EN, lưu Canvas V2, giữ Canvas V1 và từ chối URL ngoài.
- Test source đảm bảo thẻ mới vẫn gọi handler `change` cũ, giữ Undo/Redo và validation; không tắt bài kiểm thử sẵn có.
- Cần chạy `npm ci`, `npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser` trên máy/CI trước khi push.
- Kiểm tra bằng tay trong Chrome Android và Safari iOS, đặc biệt trạng thái audio khi ẩn tab và việc đọc tên bài bằng VoiceOver.

## Những việc chưa làm

Chưa có upload nhạc của người dùng, playlist, tích hợp Spotify/YouTube, mua bản quyền bên thứ ba, hay hệ thống lọc dựa trên ML. Các phần này có rủi ro bảo mật/bản quyền lớn hơn phạm vi đợt này.
