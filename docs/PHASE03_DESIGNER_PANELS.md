# Phase 3.4B — Canvas Designer Responsibility

## Phạm vi

- `web/js/pages/designer.js`: điều phối editor, state, commit, action/change, session, Fabric và lifecycle như trước.
- `web/js/features/canvas-editor/inspector-panel.js`: dựng Inspector cho cảnh/đối tượng, effect, tương tác, motion, hình học, crop, clipboard và áp dụng quyền chỉnh sửa UI.
- `web/js/features/canvas-editor/asset-panel.js`: dựng bảng ảnh đã tải, giữ signature trên DOM, đọc quyền tái sử dụng ảnh và xóa cache khi ở Quick Mode.

## Hợp đồng và tương thích

Hai factory nhận getter thay vì giữ snapshot của draft lúc mount. Inspector đọc store/design khi render và stage tại callback preview. Callback chỉnh sửa vẫn dùng `commit`/`safe` của Designer; không có đường ghi nháp hoặc API mới. Không thay tên `data-editor-action`/`data-editor-field`, thứ tự control, CSS, bản dịch hoặc logic backend. Kiểm tra quyền trên UI không thay thế authorization phía server.

`renderInspector()` vẫn bỏ qua khi đang nhập IME hoặc thiếu host. Giữ trạng thái disclosure, focus field và geometry theo ID đối tượng. Asset panel giữ cơ chế cache hiện tại, không thêm cache toàn cục. Chưa thay đổi logic quản lý scene/layer action, event delegation, undo/redo, autosave hoặc vòng đời Fabric.

## Kiểm thử

- `node --test tests/unit/phase03-designer-panels.test.mjs`: DOM fixture kiểm tra getter, focus, IME, Quick Mode, policy, clipboard, asset cache và motion.
- `npm run check:architecture`: không thêm vòng import tĩnh hay vi phạm ranh giới.
- `npm run check`: kiểm tra cả UI literals trong hai panel mới.
- `npm test`, `npm run test:browser`, `npm run test:canvas:browser`: nghiệm thu hồi quy đầy đủ trong môi trường có dependency; kiểm tra thủ công thêm trên mobile và khi chuyển VI/EN, crop ảnh, chọn nhiều layer, motion, Creator locked template, Undo/Redo và khôi phục draft.

Không migration, không biến môi trường, không dependency mới. Frontend cần triển khai đồng bộ toàn bộ build sau nghiệm thu. Không chạy test trên MySQL production.
