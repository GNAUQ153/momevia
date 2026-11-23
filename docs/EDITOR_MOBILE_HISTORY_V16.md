# Momevia V16 — Canvas Mobile History

## Mục tiêu

Trên thiết bị di động, thanh trên cùng của Canvas chứa nhiều nút và dùng chữ nhỏ. Hai thao tác **Hoàn tác** và **Làm lại** thường xuyên được sử dụng nhưng khó tìm khi nằm cùng hàng với Lưu nháp, Xem trước và cài đặt khác.

V16 đưa hai nút lịch sử xuống gần vùng Canvas trong chế độ chỉnh bố cục ở màn hình rộng tối đa 800px. Trên desktop vẫn dùng bộ nút cũ; ở chế độ điền nhanh, thanh mới không xuất hiện và toolbar cũ không bị ẩn.

## Thay đổi kỹ thuật

- `web/js/pages/designer.js`: thêm nhóm thao tác lịch sử trước stage scroll; renderAll dùng `syncHistoryControls` để cập nhật đồng bộ cả mobile và desktop. Để giữ Playwright selector hiện có, hai nút mobile dùng action `mobile-undo`/`mobile-redo` rồi gọi chung `store.undo()`/`store.redo()`.
- `web/js/features/canvas-editor/history-controls.js`: module DOM thuần, chỉ cập nhật trạng thái nút; không đọc/ghi document, session, API hoặc local storage.
- `web/css/editor-experience.css`: ẩn toolbar lịch sử ở desktop; trên mobile chuyển Undo/Redo từ header tới vị trí dễ thao tác hơn, tăng vùng chạm lên 48px và hiển thị focus bằng bàn phím.
- `web/assets/locales/{vi,en}.json`: 3 khóa nhãn lịch sử theo giao diện mobile, tránh hiển thị tổ hợp Ctrl+Z trên điện thoại.
- `tests/unit/editor-mobile-history-v16.test.mjs`: kiểm tra disabled parity, undo/redo, layout và ngôn ngữ.
- `tests/browser/canvas.mjs`: kiểm tra thực tế tại 320px, 390px và 768px bằng Playwright: mobile bar visible, header buttons hidden, disabled parity, touch targets không tràn.

## Giới hạn

- Không thêm trạng thái lịch sử mới, không thay đổi semantics Undo/Redo hoặc dữ liệu bản nháp.
- Browser E2E và full build cần chạy trên source đầy đủ dependencies trước khi commit.
- Mã nguồn trong gói V16 được tạo từ baseline V15 đã PASS CI trên ảnh người dùng cung cấp; không truy cập trực tiếp repository trên máy người dùng.

## Kiểm tra được trên bản sao

- `node --test tests/unit/editor-mobile-history-v16.test.mjs tests/unit/editor-mobile-sheet-v15.test.mjs tests/unit/editor-experience.test.mjs`: 24/24 PASS.
- `node scripts/quality/check-ui-i18n.mjs --check`: PASS.
- `node scripts/quality/check-css-style.mjs`: PASS.
- Build chưa hoàn tất do bản sao `node_modules` thiếu `qrcode-generator`. Không đồng nghĩa CI của V16 đã PASS.

## Checklist trực quan

1. Mở `/design/{id}` ở chế độ chỉnh bố cục tại 320, 390, 768 và 1024px.
2. Mobile: nút Hoàn tác/Làm lại dễ thấy ngay trên Canvas, mỗi nút cao ít nhất 48px; nút đầu trang không lặp lại.
3. Thử sửa chữ → Hoàn tác → Làm lại; trạng thái disabled phải phản ánh chính xác.
4. Mở bottom sheet rồi đóng bằng Escape, kiểm tra không bị thay đổi hành vi V15.
5. Chuyển VI/EN, kiểm tra nhãn ngắn không tràn.
6. Desktop 1024px: giữ toolbar cũ, mobile history ẩn.
7. Chế độ điền nhanh: không xuất hiện mobile history, hai nút cũ vẫn hoạt động.
