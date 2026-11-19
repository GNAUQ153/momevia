# Momevia Phase 5.9 — Fabric Contextual Inspector

## Mục tiêu

Tăng khả năng sử dụng Fabric Studio trong Canvas Designer, nhất là chế độ **Chỉnh trực tiếp** của Phase 5.8. Khi chọn một layer được phép sửa, người dùng có thể nhập chính xác tọa độ X/Y, chiều rộng, chiều cao, góc xoay, và căn giữa ngang/dọc ngay trên artboard.

## Phạm vi triển khai

- `web/js/features/canvas-editor/fabric-inspector.js`: engine nhập hình học và bảng thuộc tính dạng module, không có phụ thuộc runtime server.
- `web/css/editor-fabric-inspector.css`: style phân cấp rõ ràng, giao diện responsive, khả năng truy cập bàn phím.
- `web/js/features/canvas-editor/fabric-studio.js`: mount inspector vào bảng layer, dispose listener khi đóng Fabric.
- `web/index.html`: nạp stylesheet mới.
- `tests/unit/fabric-inspector.test.mjs`: kiểm tra phép biến đổi, quyền, đầu vào không hợp lệ, bản nháp không bị thay đổi trước khi Áp dụng.

**Không thay đổi:** `web/js/app/main.js`, `web/js/core/api.js`, `web/js/features/canvas-editor/library.js`, `web/js/features/canvas-editor/session.js`; API, database, định dạng JSON, quyền Creator, luồng người nhận.

## Nguyên tắc dữ liệu

1. Momevia Canvas Document là nguồn dữ liệu duy nhất; Fabric là lớp giao diện tạm.
2. Sử dụng tọa độ top-left của Momevia, chuyển đổi sang tọa độ tâm Fabric.
3. Thay đổi width/height qua `scaleX`, `scaleY`, không ghi đè kích thước vật lý của Fabric object.
4. Textbox giữ `momeviaBaseHeight` để tránh sai chiều cao trong `fabricDiff`.
5. Không sửa nếu layer ẩn, khóa, không thể chọn, bị hạn chế quyền hoặc ảnh thiếu.
6. Chỉ nút **Áp dụng vào thiết kế** mới gọi `onApply` và đưa patch qua `applyFabricWorkspacePatch`/schema Momevia.
7. Hủy phiên hoặc rời trình chỉnh sửa không được ghi các thay đổi tạm.

## Kiểm thử nghiệm thu

- Mở cả Fabric modal cũ và Inline Fabric mới, chọn text/shape/ảnh; kiểm tra tọa độ hiển thị.
- Nhập X=20, Y=30; chiều rộng=250; góc xoay=-45; bấm Áp dụng, lưu, mở lại.
- Hủy chỉnh sửa và xác nhận bản nháp cũ không đổi.
- Kiểm tra Undo/Redo sau khi Áp dụng.
- Chọn layer có quyền khóa, Creator policy, hình thiếu hoặc lớp ẩn; input phải disabled.
- Thử gõ chữ tiếng Việt, dùng Tab/Shift+Tab, màn hình 320px, 390px, 768px và desktop.
- Kiểm tra `npm run test:canvas:browser` để tránh ảnh hưởng publish, reply và share link.

## Giới hạn

- Inspector chỉ tác động hình học và căn giữa, **không** sửa trực tiếp màu, font, hiệu ứng hay asset.
- Chưa có end-to-end browser test riêng cho inspector; Unit Tests không thay thế nghiệm thu người dùng.
- Installer dựa trên anchor đã xác minh từ Phase 5.8, sẽ dừng nếu `main` đã thay đổi tại các vị trí cần chèn. Không bỏ qua kiểm tra để ép cài.
