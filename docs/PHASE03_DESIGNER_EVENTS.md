# Phase 3.4C — Canvas State & Event Management

## Phạm vi

- `keyboard-handler.js`: tách xử lý phím tắt khỏi Designer, nhận getter trạng thái và callback từ controller. Giữ listener `safe(handleKey)` với AbortSignal của lần mount.
- `selection.js`: helper thuần cho chọn nhiều, chọn theo cảnh, chọn layer có thể chỉnh sửa, chọn lại đối tượng phục hồi bằng Undo/Redo. Không ghi document.
- `clipboard-actions.js`: sở hữu clipboard và số lần paste của từng editor, dùng `clipboard.js` hiện có để xử lý model và tài sản; không thêm global state hoặc browser storage. Mọi thao tác ghi vẫn qua `commit`.
- Designer giữ Store, session, Fabric, stage, scene ID, selection và lifecycle hiện có; chưa tách toàn bộ scene/layer action hoặc event change/input.

## Sửa lỗi có chủ đích

- Ctrl/Cmd+[ hoặc ] với layer không thể chỉnh sửa không được rơi xuống nhánh Delete. Không thay đổi quyền chỉnh sửa ở server.
- Xóa tập selection cũ khi chọn cảnh trực tiếp hoặc khởi tạo lại document. Tránh chọn lại ngầm đối tượng ở cảnh trước.
- Bỏ qua keyboard event khi stage chưa khởi tạo; giữ guard IME, input, dialog, sheet, Quick Mode.

## Nghiệm thu

Chạy `node --test tests/unit/phase03-designer-events.test.mjs`, `npm run check:architecture`, `npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser` trên môi trường QA độc lập. Kiểm tra Ctrl/Cmd+S, Ctrl/Cmd+A, Copy/Cut/Paste (kể cả paste in place), Duplicate/Delete, Ctrl/Cmd+[ và ], phím mũi tên, Undo/Redo, chuyển cảnh, nhập tiếng Việt bằng IME và focus khi mở sheet. Kiểm tra bằng cả VI/EN và Creator template bị khóa. Không thử thanh toán thật hoặc chạy fixture trên database production.

Không thay đổi API, schema, CSS, font, dependency hoặc chính sách thanh toán. Không thay đổi chủ đích layout giao diện hay Fabric shortcut riêng. Cần nghiệm thu trình duyệt thực tế trước khi release Hostinger.
