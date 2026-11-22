# Music Library 3.1 — Tìm kiếm và refactor Canvas Designer

## Phạm vi

- Đưa cấu trúc DOM thư viện nhạc, trạng thái chọn và volume vào `web/js/features/canvas-editor/music-panel.js`.
- Thêm tìm kiếm không phân biệt dấu cho 4 track, dùng metadata đã dịch ở VI/EN; tìm kiếm trên client, không gọi API.
- Giữ lựa chọn `Không dùng nhạc` hiển thị khi có bộ lọc; danh mục và dữ liệu đã gửi không thay đổi.
- Trạng thái kết quả dùng `role=status`, `aria-live=polite`; tìm kiếm có label, focus ring và vùng chạm đủ lớn.

## Tương thích

- Chỉ tách UI, không thay đổi `soundtracks.js`, Canvas JSON, snapshot, database, thanh toán, hay logic kiểm tra server.
- `designer.js` vẫn điều phối commit/Undo/Redo và audio preview, `music-panel.js` chỉ render, đồng bộ và lọc.
- `onLocaleChange` lọc lại theo ngôn ngữ mới mà không xoá input search.

## Kiểm tra thủ công

1. Vào Designer với Sender, nhập `binh minh`, `đêm`, `bright` khi ở đúng ngôn ngữ.
2. Đổi VI/EN trong khi vẫn giữ query; kiểm tra kết quả được lọc lại theo ngôn ngữ mới.
3. Lọc Êm dịu/Tươi vui, chọn track, nghe thử, chỉnh volume, Undo/Redo, lưu và mở trên trang người nhận.
4. Kiểm tra 390px/1024px, bàn phím Tab, trạng thái không tìm thấy và không có tràn ngang.

## Độ tin cậy

Unit test có thể chạy độc lập bằng Node.js; browser regression và CI chính thức phải chạy trên source đích sau `--apply`.
