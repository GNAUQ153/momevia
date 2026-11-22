# Momevia — Nhạc nền Canvas (MVP giới hạn)

Ngày 22/11/2026 · Baseline: `Momevia_Main_Latest_20261122.zip` (sau PR #19).

## Phạm vi đã triển khai

- Sender có một ô **Nhạc nền cho thiệp** trong tab nội dung của Canvas Designer (cả chế độ quick/layout). Có thể không dùng nhạc, chọn **Bình minh dịu dàng** hoặc **Ngày rực rỡ**, và bấm **Nghe thử**.
- Khi chọn bài, document lưu `soundtrack: { id, volume }`. Document V1 tự nâng sang V2 khi lưu bài nhạc; không nâng những thiệp cũ không có nhạc. Undo/Redo khôi phục lựa chọn nhạc và cập nhật selector.
- Backend và Canvas validation chỉ chấp nhận **ID có trong catalog**, không nhận URL nhạc ngoài, data URL hoặc bất kỳ trường lạ nào. Độ lớn âm lượng 0–1; mặc định 0.55. Với Creator template đã khóa, Sender có thể đổi nhạc nhưng không được đổi phần tử/hiệu ứng khác của mẫu. Việc nâng V1→V2 chỉ được chấp thuận nếu không có thay đổi V2 ngoài nhạc.
- Nhạc đi vào document snapshot được phát hành; người nhận có nút **Phát nhạc/Tạm dừng nhạc**. Không autoplay và không tự phát theo chuyển cảnh. Khi ẩn tab/đóng Player thì dừng; `play()` bị trình duyệt chặn được báo lỗi, không đánh dấu đã phát.
- Khi **tặng lại** từ bố cục quà đã nhận, lựa chọn nhạc của Sender trước không đi theo bố cục để tránh mang nội dung cá nhân hóa sang lượt tặng mới.
- Không thay đổi bảng MySQL hay API request bên ngoài: document JSON đã được lưu/kiểm tra theo phiên bản hiện có. File MP3 tĩnh được phục vụ từ `/assets/music/` với MIME `audio/mpeg`.

## Nhạc và quyền sử dụng

Hai tệp MP3 trong `web/assets/music/` là **giai điệu tổng hợp mới** được tạo bằng thuật toán và nốt nhạc tự biên soạn riêng cho bản MVP này, không lấy âm thanh/mẫu/track từ bên thứ ba. Mã danh mục nằm ở `web/js/shared/canvas/soundtracks.js`. Không có URL nhạc tùy ý, tải tệp âm thanh của người dùng hoặc liên kết Spotify/YouTube.

Phạm vi này chỉ là thư viện nhạc thử nghiệm. Trước khi thương mại hóa, đội dự án cần kiểm tra quyền sử dụng, quy trình lưu hồ sơ nguồn gốc, điều khoản cấp quyền và chất lượng âm thanh theo thị trường mục tiêu. Tuyệt đối không tải nhạc thương mại không có license lên web.

## Hướng phát triển nhạc về sau

1. Thêm thư viện bản nhạc có metadata: tác giả, license, phiên bản, độ dài, bitrate, kiểm duyệt, thời gian hết quyền.
2. Nếu hỗ trợ người dùng upload: kiểm tra chủ sở hữu, quyền sử dụng, dung lượng/MIME thực, mã hóa lại âm thanh, hạn chế thời lượng, quét nội dung độc hại, quota và đường dẫn phát signed khi cần. Đường dẫn không được nhận từ Canvas JSON.
3. Cho phép nghe thử trong trình chỉnh sửa, chọn volume, fade in/out và bảo đảm không tự phát với Recipient.
4. Kiểm thử trên iOS Safari, Chrome Android, desktop, thiết bị hạn chế dữ liệu và kết nối chậm. Đo LCP/INP/CLS trước/sau.

## Kiểm thử đã thực hiện

`node --test tests/unit/soundtrack-mvp.test.mjs`: kiểm tra tài liệu V1, tài liệu V2, allowlist, ảnh snapshot công khai, tặng lại, autoplay opt-in, lỗi browser `play()`, cleanup, MIME HTTP và tệp nhạc thật. Nhóm kiểm thử này không thay cho Browser E2E/CI. Các phụ thuộc npm trong môi trường phân tích chưa đủ để chạy toàn bộ CI.

## Cách kiểm thử trên máy local

```bash
npm ci
npm run build
npm run check
npm test
npm run test:browser
npm run test:canvas:browser
npm run dev
```

Đăng nhập Sender; tạo nháp mới; chọn nhạc; bấm nghe thử; lưu; xem trước và xuất bản. Mở link ở trình duyệt ẩn danh, kiểm tra **nhạc không tự phát**, nhấn Phát nhạc, chuyển VI/EN và điều hướng khỏi trang. Mở lại quà cũ đã gửi trước bản cập nhật để xác nhận không phát sinh lỗi schema.

## Triển khai an toàn

Bản vá dạng ZIP được thiết kế theo baseline mới nhất người dùng gửi; chạy `merge-main.mjs --check` trên working tree sạch trước khi áp dụng. Nếu Lộc đã sửa cùng vùng code, script không tự ghi đè. Phải review diff và hoàn tất CI trước khi push `main`.
