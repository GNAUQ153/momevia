# Canvas Designer — Refactor Scene & Layer Panel

Ngày: 22/11/2026. Phạm vi: frontend Designer, không thay đổi backend hoặc schema.

## Vấn đề

`web/js/pages/designer.js` trước đây trực tiếp dựng danh sách Scene/Layers, điều khiển cache thumbnail, trạng thái khóa/ẩn và khôi phục focus sau thao tác đổi tên/sắp xếp cảnh. Điều này làm file điều phối khó bảo trì và tăng rủi ro hồi quy khi chỉnh sửa từng thành phần UI.

## Thiết kế

Module `web/js/features/canvas-editor/scene-layer-panel.js` bao gồm:

- `sceneLayerEntries()`: tạo dữ liệu trình bày Layer thuần, theo thứ tự z-index đảo ngược (lớp trên cùng trước), không sửa Canvas JSON; dùng chỉ mục `Map` để tránh tìm tuyến tính trên mọi lớp.
- `sceneStructureKey()`: xác định thời điểm phải tạo lại các nút Scene dựa trên chế độ chỉnh sửa, loại policy, tên/thứ tự Scene và cảnh bắt đầu. Khi chỉ thay đổi nội dung, cập nhật thumbnail riêng, giữ nút và focus.
- `createSceneLayerPanel()`: dựng nút Scene, Layer và menu thao tác; giữ cache thumbnail trong phiên Editor, có `clear()` để dọn khi tải bản thiết kế khác.

`designer.js` vẫn sở hữu store, sceneId, selection, policy, quyền truy cập và sự kiện thao tác. Module chỉ nhận các hàm lấy trạng thái và không gửi request hay ghi dữ liệu.

## Các cam kết tương thích

- Không đổi event delegation `data-editor-action`, `data-id`, `data-scene`.
- Không đổi thứ tự Scene/Layer, hành vi chọn, Undo/Redo hoặc các giới hạn quyền sửa mẫu của Creator.
- Trạng thái khóa/ẩn được giữ trong `aria-label` và icon SVG hiện có.
- Menu Scene giữ trạng thái mở, focus sau sắp xếp/đổi tên và điều kiện disable các thao tác ở biên danh sách.
- Không đổi VI/EN, font, CSS, Canvas V1/V2, ảnh, nhạc nền, xuất bản hoặc thanh toán.

## Kiểm thử

Unit test: `node --test tests/unit/scene-layer-panel.test.mjs`.

Chạy đầy đủ trên máy có dependency:

```bash
npm ci
npm run build
npm run check
npm test
npm run test:browser
npm run test:canvas:browser
npm run i18n:audit
```

Thử thủ công: thêm 2–3 Scene; đổi tên, di chuyển lên/xuống, đổi Scene mở đầu; khóa/ẩn Layer, chọn Layer, đổi VI/EN; dùng bàn phím mở menu Scene rồi sắp xếp và kiểm tra focus. Thử một mẫu Creator có chính sách khóa và một thiệp cũ.

**Giới hạn kiểm chứng:** Môi trường đóng gói không có đầy đủ `sharp`, `js-yaml`, `qrcode-generator` nên chưa chạy build/Playwright của toàn ứng dụng. Cần kiểm tra trước commit lên `main`.
