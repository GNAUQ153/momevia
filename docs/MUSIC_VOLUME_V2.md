# Momevia — Âm lượng nhạc nền Canvas (2026-11-22)

## Phạm vi

- Sender có thanh âm lượng 0–100% (bước 5%) trong Designer, mặc định 55% khi chọn nhạc lần đầu.
- Thao tác kéo cập nhật số phần trăm và âm lượng nghe thử, nhưng chỉ tạo **một** phiên bản Undo/Redo khi kết thúc chỉnh (`change`).
- Đổi bài nhạc giữ âm lượng đã chọn; bỏ nhạc thì xóa toàn bộ cấu hình như trước.
- Recipient có thanh chỉnh âm lượng riêng cho phiên phát hiện tại. Thay đổi âm lượng **không gọi API** và không làm thay đổi snapshot, bản thiết kế, quyền xem hoặc dữ liệu người gửi.
- Tiếp tục yêu cầu người dùng bấm Phát; không autoplay, không cho phép URL âm thanh bên ngoài.
- Các trường Canvas V1 cũ không có nhạc vẫn hợp lệ; bản V2 tiếp tục chỉ có `soundtrack.id` và `soundtrack.volume`.

## Phân tách trách nhiệm

- `soundtrack.js`: quản lý lifecycle và âm lượng cho `HTMLAudioElement`, từ chối đầu vào ngoài [0,1].
- `designer.js`: tạo control, thực hiện commit sau khi người dùng kết thúc kéo slider; Undo/Redo dùng store cũ.
- `gift-runtime/index.js`: điều chỉnh âm lượng riêng tại player mà không thay đổi document.
- `music-controls.css`: chỉ chứa style, font Inter và focus rõ ràng; không thay đổi CSS global.

## Kiểm tra

```bash
npm ci
npm run build
npm run check
node --test tests/unit/soundtrack-mvp.test.mjs tests/unit/soundtrack-volume.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
```

Trong trình duyệt: chọn nhạc, kéo 25%, Nghe thử, Undo/Redo, lưu nháp, mở link nhận thiệp; tại link người nhận chỉnh 75% và xác nhận lần mở lại vẫn giữ 25% của thiết kế. Thử thêm chế độ EN, mobile và tab ẩn.

## Ranh giới

Không sửa `web/assets/basic-templates/en/to-doan-cau-se-chon.svg` đang có thay đổi cục bộ. Đợt này không bổ sung upload nhạc, streaming, giỏ hàng hay nghiệp vụ thanh toán.
