# Momevia Phase 6.3b — Read-only Conflict Review

Source tham chiếu: Momevia_Main_Latest_20261120 (upload của chủ dự án). Bản này **không** sửa `session.js`/autosave, DB, endpoint, role hay cách resolve CAS. Không tự gộp 2 bản thiết kế.

## Phạm vi

- Nút **Xem bản máy chủ** trong Recovery Center và thanh xử lý xung đột mở dialog so sánh **bản đang chỉnh sửa** với **bản tải qua GET xác thực chủ sở hữu**.
- Các khối: tên, số lượng và cấu trúc cảnh/layer, ảnh, bindings, thiết lập Canvas khác. Chênh lệch trong props layer vẫn được đánh dấu khác dù số lượng bằng nhau.
- Có xem một phần các binding text (tối đa 8 trường); không xuất thông tin ra bên thứ ba. Đóng dialog giữ nguyên mọi thay đổi.
- Vi/En cho toàn bộ giao diện mới, tương thích bản cập nhật i18n của Lộc.

## Giới hạn

- Đây là **so sánh thuộc tính**, không phải diff bitmap/preview pixel hoặc merge tự động.
- Khi hai người chỉnh sửa cùng lớp, vẫn phải kiểm tra thủ công và xác nhận rõ trước khi tải bản máy chủ. Dùng lại hành động `server-reload` sẵn có.
- Các bindings có thể chứa dữ liệu riêng tư. Chỉ hiển thị sau khi GET được server cho phép theo chủ sở hữu.
- Toàn bộ snapshot là bản tạm trong memory. Không giữ token, recovery key, pending ACK vào đối tượng mới.
- `compare` không thể quyết định quyền ghi, kiểm tra cuối cùng thuộc về CAS server.

## Kiểm thử

```bash
node --test tests/unit/conflict-review.test.mjs tests/unit/recovery-center.test.mjs tests/unit/canvas-tab-sync.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

## Smoke bằng tay

1. Mở cùng nháp ở hai tab, chỉnh nội dung tab A nhưng chưa lưu; lưu ở tab B.
2. Khi tab A gặp conflict, mở **Bản nháp > Xem bản máy chủ**. Dialog hiện hai phiên bản và số nhóm khác biệt.
3. Đóng dialog: tab A vẫn giữ chữ/ảnh, redo/undo, và trạng thái xung đột.
4. Mở lại, kiểm tên/cảnh/lớp thay đổi. Không thấy nút tự động hợp nhất/ghi đè.
5. Kiểm vi/en, màn hình 320/390/768/1440 px, ESC và keyboard.
6. Trong Recovery Center có nút **Tải bản máy chủ** riêng và hộp xác nhận khi chọn; không bị thay thế.
