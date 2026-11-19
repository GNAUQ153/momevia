# Momevia Phase 5.2 — Precision Alignment (Beta)

## Mục đích

Bổ sung công cụ căn chỉnh **nhiều layer** trên Fabric Studio, thay vì chỉ căn từng layer theo artboard. Đây là bước nâng cấp an toàn trước khi triển khai group/mask/crop nâng cao. Không thay đổi `schemaVersion: 1` hoặc dữ liệu DB.

## Tính năng đã triển khai

- Layer Panel có ô chọn nhiều lớp; các lớp tương tác, ẩn, có quyền Creator hoặc khóa tạm không thể đưa vào nhóm căn chỉnh.
- 6 phép căn chỉnh: trái, giữa ngang, phải, trên, giữa dọc, dưới.
- 2 phép phân bố: khoảng cách ngang đều hoặc khoảng cách dọc đều. Yêu cầu tối thiểu 3 lớp; nếu lớp chồng lấn và không đủ chỗ thì báo lý do, không tự biến dạng.
- Tính theo bounding box của Fabric (bao gồm xoay); chỉ tịnh tiến vị trí, không resize/rotate/chỉnh văn bản.
- Áp dụng qua `fabricDiff` và `applyFabricWorkspacePatch`: không thêm/xóa layer, không lưu Fabric JSON hoặc làm mất ID, bind, action, asset.
- Toolbar có ARIA và trạng thái disabled hợp lệ; Layer Panel phù hợp mobile và `prefers-reduced-motion`.

## Các file

- `web/js/features/canvas-editor/fabric-align.js`: công thức hình học thuần; không gọi DOM/Fabric.
- `web/js/features/canvas-editor/fabric-studio.js`: giao diện chọn nhiều, dùng hình học để dịch chuyển đối tượng.
- `web/css/editor-fabric-align.css`: CSS độc lập, một thuộc tính trên một dòng.
- `tests/unit/fabric-align.test.mjs`: kiểm thử căn, phân bố, quyền khóa và dữ liệu gốc.

Không thêm dependency mới. Fabric.js 7.4.0 (MIT) đã được tích hợp từ Phase 5.

## Kiểm thử thủ công

1. Chạy `npm run dev`, mở một thiết kế của chính mình trong `Fabric Studio`.
2. Ở bảng lớp, chọn 2 hình có thể chỉnh sửa; thử **Căn trái**, **Căn giữa ngang**, **Căn trên**, **Giữa dọc**.
3. Chọn 3 hình rời nhau; thử **Chia đều ngang** và **Chia đều dọc**. Chọn 3 hình chồng lấn để xem thông báo từ chối.
4. Xoay một hình trước khi căn theo biên; kích thước, góc xoay và văn bản phải giữ nguyên.
5. Dùng **Áp dụng vào thiết kế** rồi Undo/Redo, lưu và tải lại; xác nhận vị trí lớp vẫn đúng.
6. Thử chọn lớp tương tác, lớp ẩn và lớp bị Creator khóa; checkbox phải bị vô hiệu hóa.
7. Kiểm tra mobile 320/390/768px và keyboard tab/focus; không emoji, không tràn ngang.
8. Mở quà đã phát hành, xác nhận runtime người nhận không bị ảnh hưởng.

## Phạm vi chưa triển khai

- Group/Ungroup persist: cần quyết định schema v2 và cách render tương tác trước khi làm.
- Mask/crop nâng cao: cần xử lý focal point, quyền truy cập asset, CORS và snapshot quà đã gửi.
- Kéo chọn bằng hình chữ nhật (Fabric ActiveSelection): tạm không bật vì schema v1 không lưu nhóm.
- Trình hướng dẫn căn chỉnh bằng đường kẻ trực tiếp: chưa có trong bản này.

## Bảo mật và tính nhất quán

`arrangeFabricBoxes` kiểm tra ID trùng/ngoài cảnh, số không hữu hạn và số lớp tối thiểu. UI chỉ cho chọn các lớp đủ quyền; khi lưu, `applyFabricWorkspacePatch` tiếp tục kiểm tra policy phía client, đồng thời server giữ trách nhiệm kiểm soát quyền sửa thiết kế. Đây không phải cơ chế phân quyền phía server.
