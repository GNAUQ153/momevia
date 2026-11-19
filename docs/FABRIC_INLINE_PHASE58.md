# Momevia Phase 5.8 — Fabric Inline Workspace

## Mục tiêu

- Thêm nút **Chỉnh trực tiếp** ngay trong Canvas Designer. Fabric Studio xuất hiện tại artboard chính, không mở modal mới.
- Giữ nguyên nút **Chỉnh sửa nâng cao** và chế độ modal của Fabric Studio để có đường quay lại nếu cần.
- Tái sử dụng đúng Fabric Adapter, Workspace Patch, Alignment, Layer Management đang có. Không lưu Fabric JSON.
- Chỉ áp dụng thay đổi khi người dùng bấm **Áp dụng vào thiết kế**. **Hủy** không đổi Canvas Document.

## Ranh giới nghiệp vụ

- Quyền Creator/template bị khóa tiếp tục kiểm tra ở UI và trong Fabric Adapter/Workspace Patch.
- Chế độ cá nhân hóa nhanh chuyển sang bố cục trước khi mở. Người nhận link công khai không sử dụng Designer.
- Trong khi chỉnh trực tiếp, các nút điều hướng, đổi cảnh, lưu, chỉnh ngoài vùng Fabric bị vô hiệu hóa để tránh thay đổi document giữa phiên.
- Trước khi áp dụng, xác nhận `store.sequence` và ID cảnh; nếu thay đổi thì từ chối ghi đè.
- Fabric được dispose khi đóng/cancel/chuyển route; ResizeObserver được ngắt.
- Tương thích 172 elements: text, shape, image sửa được theo quyền; sticker, action, hiệu ứng và lớp không hỗ trợ chỉ thể hiện preview. Export PNG tĩnh bị tắt khi không thể tái tạo chính xác.

## Kiểm tra trước khi phát hành

1. `node --test tests/unit/fabric-inline.test.mjs`
2. `npm run build && npm run check && npm test`
3. `npm run test:architecture && npm run test:canvas:browser && npm run test:templates`
4. `npm run package && npm run verify:package`
5. Trên localhost: mở nhanh/đầy đủ, mở trực tiếp, chọn/kéo/xoay/resize, căn, khóa/ẩn/layer, Hủy, Áp dụng một lần, Undo một lần, Save/Reload; kiểm tra mobile 320/390/768px; Creator bị khóa, link công khai.

## Giới hạn

Đây là chế độ Fabric nhúng vào workspace theo lựa chọn của người dùng. Bản vẽ DOM ban đầu vẫn được giữ cho chế độ thường và chế độ nhanh. Chưa thay renderer runtime nhận quà, chưa thêm bitmap động, không mở chỉnh sửa bản gốc cho người nhận.

## Giấy phép

Fabric.js 7.4.0: MIT. Dự án giữ nguyên phần ghi công open-source và các nguồn đã công bố ở các phase trước.
