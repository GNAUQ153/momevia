# Momevia — Fabric Workspace Phase 5.1

## Mục tiêu

Bổ sung Workspace chuyên nghiệp lên Fabric Studio Beta mà vẫn giữ nguyên schema v1, MySQL, các mẫu quà, quyền Creator và renderer dành cho người nhận. **Momevia Canvas document vẫn là nguồn dữ liệu duy nhất.** Fabric.js chỉ là engine để thao tác bố cục.

## Đã triển khai

1. **Bảng quản lý lớp** bên phải (desktop), xuống dưới trên màn hình nhỏ: hiển thị lớp từ trên xuống dưới, tên lớp, trạng thái khóa/ẩn, nút chọn, lên/xuống.
2. **Đổi thứ tự layer có lưu:** cập nhật `scene.elementIds` khi người dùng bấm Áp dụng. Không cho xáo trộn lớp tương tác, lớp bị khóa hoặc vượt quyền Creator.
3. **Ẩn/hiện có lưu:** cập nhật `element.visible`. Các lớp đã ẩn từ trước vẫn hiện trong Layer Panel để bật lại (trừ các lớp bị khóa bởi thiết kế/chính sách).
4. **Khóa thao tác tạm thời:** chặn kéo/resize/rotate trong cửa sổ đang mở; không thay đổi `element.locked` trong schema. Nếu thoát studio, khóa tạm được hủy. Lớp bị khóa ở schema hoặc policy không có nút mở khóa.
5. **Căn nhanh (snap):** tự hút tâm và biên artboard khi kéo, có công cụ bật/tắt; không ghi thêm metadata lên server.
6. **Kiểm tra atomically:** đổi thứ tự, visible và layout chỉ commit cùng nhau qua `applyFabricWorkspacePatch` và `validateDocument`. Undo/Redo/autosave sử dụng `createEditorStore` sẵn có.
7. **UI:** dùng nút tiếng Việt, ARIA cho bảng layer, focus-visible, responsive nhỏ hơn 850px, tôn trọng `prefers-reduced-motion`; CSS riêng `editor-fabric-workspace.css`, mỗi thuộc tính một dòng.

## Không thay đổi

- Không đụng schemaVersion/registryVersion, cấu trúc CSDL, thanh toán, quà đã phát hành hoặc public gift runtime.
- Không lưu Fabric JSON, ảnh PNG hay trạng thái khóa tạm.
- Không tích hợp Konva, Lumio hay CardCraft vào runtime; Fabric.js 7.4.0 (MIT) kế thừa từ Phase 5. Bản quyền Fabric tiếp tục do `scripts/build/fabric-vendor.mjs` đóng gói.

## Giới hạn và rủi ro còn lại

- Chưa có Group/Ungroup **vĩnh viễn**. Schema v1 không có khái niệm group; nhóm trực tiếp bằng Fabric ActiveSelection sẽ không bảo toàn ngữ nghĩa sau khi gửi quà. Phải thiết kế schema v2 cùng migration/compatibility trước.
- Khóa phiên không được lưu; cần provenance và policy model trước khi hỗ trợ mở khóa bền vững.
- Snap theo tâm/biên artboard; chưa có đường guide trực quan khi kéo hay căn theo những lớp khác.
- Cần QA browser thực tế về stack order, xuất PNG, di chuyển touch và vòng save/reload.

## Chạy và kiểm thử tại local

```bash
npm ci
node --test tests/unit/fabric-adapter.test.mjs tests/unit/fabric-workspace.test.mjs
npm run build && npm run check && npm test && npm run test:architecture
npm run package && npm run verify:package
npm run test:canvas:browser
```

Kiểm tra thủ công tại `http://localhost:4100`:

- Vào Designer được phép chỉnh bố cục, mở Fabric Studio. Kiểm tra thứ tự layer trên/dưới và nút “Lên/Xuống” phản ánh lớp tương ứng trong Canvas.
- Ẩn layer chữ/hình, lưu thiết kế, reload và mở lại Studio: layer vẫn ẩn; bật lại rồi kiểm tra gift preview.
- Bật/khóa tạm, thử kéo lớp và mở khóa tạm. Đóng mở Studio lại sẽ bỏ khóa tạm.
- Thử thao tác trên nút tương tác và các lớp bị policy khóa: không thể ẩn/đổi thứ tự hoặc chỉnh layout.
- Kiểm tra responsive 320/390/768/1440px, bàn phím và phông chữ tiếng Việt.
- Kiểm tra các cảnh khác và quà đã xuất bản không bị thay đổi.

Không commit/push cho tới khi browser E2E, MySQL QA và GitHub CI/CD chạy đạt trên nhánh đang dùng.
