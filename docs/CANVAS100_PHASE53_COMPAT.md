# Momevia — Phase 5.3 tương thích Canvas 100 Elements

## 1. Tại sao không dùng installer Phase 5.3 cũ?

Source Canvas 100 Elements nhận từ nhóm ngày 19/11/2026 đã triển khai **100 mục chèn**, **24 hiệu ứng**, ảnh có `focalPoint`, bộ chỉnh crop bằng kéo, trường tọa độ phần trăm và runtime V2. Installer cũ được viết cho `designer.js` của Phase 5.2 và sẽ ghi đè thay đổi Canvas mới nếu bỏ qua kiểm tra tương thích.

Bản tích hợp này **không cài 12 preset cũ** (vì trùng chức năng với thư viện 100 Elements) và **không ghi đè `designer.js`, `library.js`, `library-presets.js`, `schema.js`, `gift-runtime`**.

## 2. Thay đổi bổ sung

| Thành phần | Hành vi |
|---|---|
| Crop Inspector | Bảng 3×3 điểm lấy nét: trái/giữa/phải × trên/giữa/dưới |
| Khối ảnh tương tác | Có cùng bảng crop nhanh khi ô ảnh cho phép chỉnh |
| Chức năng cũ | Kéo điểm trên ảnh và nhập tọa độ % vẫn hoạt động |
| Lưu | Bấm preset gọi `onPreview` rồi `onChange` hiện có; commit qua Designer và validation |
| Quyền Creator | Khi `editable=false`, bảng crop nhanh không xuất hiện; không mở rộng quyền |
| Hỗ trợ bàn phím | 9 nút với tên truy cập và trạng thái `aria-pressed`, giữ focus sau khi lưu |
| Ảnh gốc | Không biến đổi, không thêm asset, chỉ thay `focalPoint` trong tài liệu |

Vẫn dùng Canvas schema V1/V2 hiện có; không cần migration hay thư viện npm mới. Không triển khai group vĩnh viễn hoặc mask pixel tự do trong bản này.

## 3. File thay đổi

- `web/js/features/canvas-editor/crop.js`: nối preset vào crop editor đã có.
- `web/js/features/canvas-editor/crop-presets.js`: dữ liệu 9 vị trí + hàm chuẩn hóa tọa độ thuần.
- `web/css/editor-crop-presets.css`: styles riêng, thuộc tính một dòng, breakpoint mobile.
- `web/index.html`: thêm stylesheet đúng một lần.
- `CHANGELOG.md`: ghi nhận thay đổi.
- `tests/unit/crop-presets.test.mjs`: kiểm tra 9 vị trí, hợp lệ V1/V2, không ghi đè asset/actions, quyền tương thích.

## 4. Kiểm thử nghiệm thu

```bash
node --test tests/unit/crop-presets.test.mjs
npm run build
npm run check
npm test
npm run test:architecture
npm run test:canvas:browser
npm run test:templates
npm run package
npm run verify:package
```

Mở `npm run dev`, chọn một ảnh ở Designer, kiểm tra 9 nút crop nhanh, kéo tâm crop, nhập tọa độ %, Undo/Redo, lưu/mở lại. Kiểm tra ô ảnh trong album và so sánh ảnh; ô ảnh Creator không có quyền phải không hiển thị preset. Kiểm tra viewport 390 và 1440 px; kiểm tra Tab/Enter/Space, màn hình đọc, reduce motion.

Đối với MySQL, chạy riêng theo quy trình QA cô lập đã có của Momevia, không chạy integration destructively trên `momevia_dev` hoặc production.

## 5. Kết quả kiểm tra tại môi trường chuẩn bị

- 6/6 test mới PASS; 31/31 test Fabric/canvas liên quan PASS trên source trích từ ZIP.
- Dữ liệu 100 Elements và 24 hiệu ứng được kiểm tra qua unit test source đính kèm.
- Chưa thể chạy Full Local CI vì ZIP chỉ gồm các thư mục mã nguồn chọn lọc, không có toàn bộ `scripts/`, `database/`, `.github/` và dependencies.
- Browser tương tác thực tế cần thử trên máy người dùng; môi trường Chromium tại đây từ chối điều hướng mạng ngay cả với trang `data:`.
