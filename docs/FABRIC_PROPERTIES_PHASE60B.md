# Phase 6.0b — Thuộc tính theo loại lớp Canvas

**Phạm vi:** Fabric Studio Modal/Inline; không thay đổi player hoặc API công khai.

## Thiết kế

1. Fabric chỉ giữ preview tạm. `fabric-properties.js` sử dụng `textContent`, xây dựng input với DOM API, không chèn HTML người dùng.
2. `fabric-style-patch.js` cung cấp allowlist theo loại layer, kiểm tra quyền, tên trường, giới hạn màu/kiểu chữ/kích thước/opacity và bảo toàn ID.
3. Khi Áp dụng, `fabric-studio.js` gửi `styles` cùng `layouts/order/visibility` vào `applyFabricWorkspacePatch`. Document mới được `validateDocument` rồi đi qua luồng commit/save revision của Designer.
4. Kết hợp với Quickbar, Inspector, Undo/Redo, CAS và các lớp khóa; không persist Fabric JSON.
5. Nếu mở khóa/ẩn lớp rồi cập nhật style trong phiên, thuộc tính còn được lưu nếu lớp thực sự có quyền chỉnh, vì `visible` không phải quyền sở hữu.

## Công cụ

- **Text:** `color`, `fontToken`, `fontSize`, `align`, `lineHeight`, `opacity`.
- **Rectangle:** `color`, `strokeColor`, `strokeWidth`, `radius`, `opacity`.
- **Ellipse:** `color`, `strokeColor`, `strokeWidth`, `opacity`.
- **Image:** `opacity`; crop/thay ảnh tiếp tục dùng Canvas Inspector hiện có.
- **Không hỗ trợ trong Phase 6.0b:** sửa style của interaction/sticker/shape vector không phải rectangle/ellipse từ Fabric preview. Tránh hiển thị sai so với player.

## Test & nghiệm thu

```bash
node --test tests/unit/fabric-properties.test.mjs tests/unit/fabric-adapter.test.mjs tests/unit/fabric-workspace.test.mjs tests/unit/fabric-inspector.test.mjs tests/unit/fabric-quickbar.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

Nghiệm thu người dùng với viewport 320, 390, 768, 1440px; keyboard, chạm, màu/chữ, photo opacity; chuyển cảnh; Hủy/Áp dụng; reload, Undo/Redo; policy Creator; màn hình không chọn layer; offline/retry save. Chạy kiểm thử trước commit.

**Vận hành:** Phase 6.0b không yêu cầu migration. Không bật payment live khi chưa xác nhận merchant sandbox và đối soát.
