# Phase 5.7 — User-facing Canvas & Fabric Studio UX

## Mục tiêu

Cải thiện trình thiết kế Momevia cho người gửi và người tạo quà được phép thay đổi bố cục, **không** thay đổi nội dung/trạng thái của trang người nhận. Các yếu tố có thể kiểm chứng:

- Nút **Chỉnh sửa nâng cao** nằm trên thanh tác vụ Designer cả khi đang cá nhân hóa nhanh (nếu được phép).
- Từ chế độ nhanh, nút chuyển sang chế độ bố cục trước khi mở Fabric Studio.
- Thư viện — Artboard — Inspector có phân cấp, khoảng trắng, màu sắc và trạng thái rõ ràng.
- Trạng thái lớp được chọn và số cảnh hiển thị theo document đang mở.
- Hướng dẫn sử dụng thu gọn (`details`) không làm cho màn hình quá dài.
- Mobile có các nút thao tác tối thiểu 44px, Fabric Studio mở gần toàn màn hình.
- Tôn trọng `prefers-reduced-motion`, focus outline, ARIA và tiêu đề tiếng Việt.

## Bảo toàn nghiệp vụ

- Không thay API, MySQL, schema Canvas V1/V2 hoặc runtime nhận quà.
- Không serialise Fabric JSON vào document; chỉ áp dụng qua `applyFabricWorkspacePatch` và `validateDocument` như trước.
- Chặn `creator-template` và các lớp khóa bằng policy ở hàm mở Fabric lẫn bước xác minh patch.
- Không chỉnh trực tiếp hoặc nhân bản nội dung đã xuất bản. Giữ cơ chế concurrency dựa trên `store.sequence`.
- Tên layer từ nội dung người dùng được đưa vào `textContent`, không chèn HTML.
- Người nhận mở link công khai vẫn sử dụng `gift-runtime`; không tải module Designer/Fabric.

## Quy trình người dùng

1. Mở `/design/{id}` và sửa nhanh nội dung, hoặc vào chế độ bố cục.
2. Chọn **Chỉnh sửa nâng cao** từ thanh thao tác.
3. Trong Fabric Studio: kéo, xoay, thay đổi kích thước, căn hàng và quản lý lớp cho cảnh hiện tại.
4. Chọn áp dụng; hệ thống chỉ nhận patch hợp lệ và lưu bản nháp theo session hiện tại.
5. Xem trước, kiểm tra hình tương tác và xuất bản bằng chức năng hiện có.

## Giới hạn

- Fabric Studio vẫn là hộp thoại người dùng chứ chưa phải artboard Fabric gắn trực tiếp vào mặt chính. Việc thay toàn bộ editor bằng Fabric engine cần chuyển đổi sự kiện, serialization và schema; không thực hiện trong Phase 5.7.
- Fabric chỉ chỉnh cảnh hiện hành. Những thành phần tương tác và ảnh đặc thù sẽ tiếp tục dùng renderer Momevia ở chế độ xem trước để bảo đảm parity.
- Cần nghiệm thu giao diện thực tế ở 320px, 375px, 390px, 768px, 1024px và desktop; unit tests không thay thế kiểm tra UX bằng mắt hoặc audit WCAG.

## Nguồn và giấy phép

- [Fabric.js](https://fabricjs.com/), phiên bản đang được dự án sử dụng, MIT — không thay dependency hoặc bundle.
- Màu sắc, layout và CSS ở bản này là code được tạo riêng cho Momevia; không nhập code hay asset từ các repository bên thứ ba.

## Kiểm thử

```bash
node --test tests/unit/editor-experience.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```


## Lưu ý tương thích với Fabric Studio trên `main`

Bản cài Fabric Compatibility không thay `fabric-studio.js`; giữ nguyên nhãn gốc trong modal và mọi cập nhật do đồng đội thực hiện. Lối vào **Chỉnh sửa nâng cao** vẫn được thêm trong Designer và dùng hàm mở Fabric đang có. Phải kiểm tra thủ công tính tương thích quyền và lưu nháp.
