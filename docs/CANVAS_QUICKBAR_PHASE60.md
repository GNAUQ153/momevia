# Phase 6.0 — Canvas Contextual Quickbar

## Mục tiêu

Cho phép người dùng chọn layer trong Fabric Studio (hộp thoại hoặc Inline) và chỉnh nhanh vị trí, góc xoay và căn giữa ngay gần artboard. Không yêu cầu nhớ các nút trong bảng thuộc tính. Thiết kế hỗ trợ desktop và mobile 320/390px, toàn bộ thao tác dùng chữ và ARIA; không dùng emoji.

## Tích hợp kỹ thuật

- `fabric-quickbar.js`: pure geometry + chọn thao tác bàn phím + UI/controller; tái sử dụng `fabric-inspector.js` để cùng một phép biến đổi tọa độ Fabric ↔ Momevia.
- `editor-fabric-quickbar.css`: thanh công cụ độc lập, các vùng bấm tối thiểu 44px, wrap theo màn hình, `focus-visible`, giảm chuyển động.
- `fabric-studio.js`: thêm quickbar vào `fabric-stage-stack`; gỡ listener trong `cleanup`.
- `web/index.html`: nạp CSS mới, không ảnh hưởng trang nhận quà.

## Các ràng buộc nghiệp vụ

- Khi chưa chọn layer, khi lớp bị khóa, ẩn, thiếu ảnh hoặc không có quyền chỉnh sửa: toàn bộ công cụ disabled.
- Trên bàn phím: mũi tên di chuyển 1 px, Shift + mũi tên di chuyển 10px; tắt phím tắt khi focus trong `input`, `textarea`, `select`, editor nội dung hoặc đang composition (IME tiếng Việt).
- Dịch chuyển bằng quickbar được giới hạn trong vùng artboard; không xóa layer, không thêm props mới, không sửa template Creator bị khóa.
- Quickbar chỉ thay đổi Fabric object tạm thời; `onApply` và document gốc vẫn thuộc luồng Phase 5.8/5.9. Hủy phiên không lưu thay đổi; Áp dụng tạo patch của Momevia, không lưu Fabric JSON.
- `object:modified` đồng bộ hiển thị Inspector sau thao tác trên quickbar.
- Không sửa `main.js`, `api.js`, `library.js`, `session.js`, API, database hoặc schema.

## Nghiệm thu bắt buộc trên localhost

1. Mở chế độ Inline và Modal Fabric; chọn lớp ảnh, hình và văn bản chưa bị khóa, kiểm tra bảng quickbar hiện tên lớp.
2. Dùng nút và phím mũi tên, Shift + mũi tên; kiểm tra toạ độ Inspector cập nhật, lớp không đi ngoài artboard.
3. Nhập chữ tiếng Việt trong field và Textbox; mũi tên chỉ di chuyển con trỏ, không thay đổi vị trí layer.
4. Bấm Hủy để kiểm tra document gốc không đổi; bấm Áp dụng, lưu, mở lại và thử Undo/Redo.
5. Khóa và ẩn layer, chuyển người dùng Creator bị hạn chế quyền; quickbar không được cho phép sửa.
6. Kiểm tra viewport 320/390/768/1440px, tab bằng bàn phím và reduced motion.
7. Chạy `npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package`.

## Giới hạn

Đây là Phase 6.0a (P0 thao tác theo ngữ cảnh), chưa bổ sung kho PNG/WebP và chưa có Browser E2E riêng cho quickbar. Môi trường kiểm tra là source tham chiếu được dựng từ các giai đoạn trước, không phải commit `main` mới nhất của người dùng. Installer phải dừng khi anchor khác hoặc các file mục tiêu đang có thay đổi chưa commit.
