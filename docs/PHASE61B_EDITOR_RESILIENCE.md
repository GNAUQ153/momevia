# Phase 6.1b — Editor History & Recovery Guards

## Phạm vi

- Thống nhất điều kiện cảnh báo đóng tab và điều hướng khi có bản nháp/Fabric session chưa áp dụng, upload ảnh, drag hoặc publish.
- Bổ sung Ctrl+Y, Ctrl/Cmd+Shift+Z cho Redo; không chặn phím khi đang nhập text, IME hoặc có dialog mở.
- Reset lịch sử Undo/Redo khi thay toàn bộ snapshot authoritative bằng `replace(..., { record: false })`. Khi người dùng tiếp tục chỉnh, Undo chỉ trở về snapshot mới, không lùi về bản cũ.
- Kiểm tra envelope recovery theo chủ sở hữu, thiết kế, schema và mutation ID trước khi khôi phục. Giữ nguyên lost ACK replay, revision CAS và API.
- Chỉ refactor thuần JavaScript, không thay đổi SQL, schema V1/V2, endpoint, role hoặc package/dependency.

## Vấn đề còn lại

- Cơ chế `localStorage` giữ thông điệp trong bản phục hồi cục bộ. Đây không phải vùng lưu trữ được mã hóa; tiếp tục cần mô hình bảo vệ dữ liệu phù hợp khi dùng máy công cộng. Không được loại bỏ âm thầm chức năng recovery đang có.
- Chưa thực hiện kiểm thử bảo mật độc lập, DAST hay penetration test.
- Kiểm thử `node --test` không thay thế nghiệm thu trên Chrome/Edge, đặc biệt đường dẫn mất kết nối và mở lại bản nháp.
- Bản vá được xây từ snapshot Phase 6.0b cộng với thay đổi Phase 6.1a ở `designer.js`; installer dùng checksum để tránh ghi đè phiên bản khác.

## Kiểm thử trên máy Windows

```bash
node --test tests/unit/editor-guards.test.mjs tests/unit/recovery-guards.test.mjs tests/unit/canvas-editor.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

## Nghiệm thu UI thủ công

- Mở Fabric Inline, chỉnh đối tượng nhưng chưa Áp dụng, thử reload: phải có cảnh báo.
- Mở Fabric Studio modal, chỉnh nhưng chưa Áp dụng, thử đóng tab: phải có cảnh báo.
- Undo bằng Ctrl+Z, Redo bằng Ctrl+Y hoặc Ctrl+Shift+Z. Nhập nội dung trong textbox phải vẫn dùng native Undo/Redo.
- Chuyển scene/undo/redo, lưu, refresh; bản thiết kế tải lại đúng.
- Giả lập offline/lost ACK; tiếp tục phải replay mutationId cũ trước, giữ nguyên CAS và owner scope.

## Backlog tiếp theo

- Refactor `designer.js` thành các domain controller rõ ràng, thêm integration tests cho restore concurrent và scene lifecycle.
- Audit quyền media theo người gửi/creator, kiểm tra upload pipeline và lưu trữ dữ liệu khôi phục.
