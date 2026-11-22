# Canvas Designer — tách Inspector Fields

Ngày: 2026-11-22

## Mục tiêu

Tách logic dựng trường thuộc tính cơ bản, hình học và trạng thái khóa UI khỏi `web/js/pages/designer.js` để giảm độ phức tạp của module điều phối mà không đổi dữ liệu thiết kế hay các thao tác hiện có.

## Phạm vi cập nhật

- `web/js/features/canvas-editor/inspector-fields.js` dựng các trường thuộc tính theo `registry`, điều khiển vị trí/kích thước/opacity và nút thao tác Layer.
- Giữ nguyên danh sách trường của từng element, tên `data-editor-field`, `data-editor-action`, `aria-*`, giới hạn giá trị, nhãn dịch VI/EN và cảnh báo khi đối tượng nằm ngoài artboard.
- Tách quyết định khóa UI thành `canEditInspectorField()` và `canUseInspectorAction()`, rồi áp dụng qua `lockInspectorControls()`. Quy tắc ưu tiên **khóa mặc định** cho các thuộc tính không nằm trong `editableProps`.
- Inspector đóng vẫn dùng được khi element Creator bị khóa. Điều khiển `inline-text` chỉ được phép khi tầng Designer đã xác định có quyền sửa binding.
- Dữ liệu mô hình và xử lý Undo/Redo, lưu nháp, xuất bản vẫn nằm ở Designer/Store; module mới không gọi API và không sửa Canvas JSON.

**Lưu ý bảo mật:** `disabled` trên frontend không phải kiểm tra phân quyền. Các API và schema server vẫn phải từ chối cập nhật trái phép; bản này không làm thay đổi hoặc thay thế chúng.

## Kiểm thử

Chạy tại gốc repository:

```bash
npm ci
npm run build
npm run check
node --test tests/unit/inspector-fields.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
npm run i18n:audit
```

### Kiểm tra thủ công sau khi áp dụng

1. Mở Canvas Designer, chọn Shape/Text/Image/Sticker/Interaction, đối chiếu trường thuộc tính trong Inspector.
2. Thử sửa tọa độ, kích thước, opacity, crop và Undo/Redo; mở Inspector lại và xác nhận trạng thái `Geometry` được bảo toàn.
3. Mở mẫu Creator với các trường bị khóa, xác nhận các nút sửa/xóa Layer không tự mở khóa; nút đóng Inspector vẫn dùng được.
4. Chuyển VI → EN → VI; xác nhận cấu trúc, nhãn và focus không mất.
5. Kiểm tra các thiết bị mobile/laptop để xác nhận Inspector không tràn ngang.

## Đánh giá hồi quy

Bộ kiểm thử Node có thể chạy không đủ khi môi trường thiếu thư viện gốc `sharp`. Không đánh đồng số lượng test đạt với chứng nhận production. Browser/CI của commit mới trên nhánh `main` là bước xác nhận cuối cùng.

## Hướng mở rộng

Tiếp tục tách phần Text/Image/Crop chuyên dụng trong Inspector và bổ sung browser test cho policy của mẫu Creator, nhưng không tự động chuyển quyền từ client sang server.
