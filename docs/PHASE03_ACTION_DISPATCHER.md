# Phase 3.4A — Application Controller và Action Dispatcher

## Phạm vi

- Tách 56 tên `data-action` (48 nhánh xử lý cũ) thành năm nhóm: finance, catalog, shell, payment và studio.
- `app/main.js` tiếp tục quản lý router, render, form, modal, listener click và lifecycle. Dispatcher dùng `Map` riêng, không dispatch thuộc tính prototype, từ chối đăng ký trùng và chuyển lỗi về listener hiện hữu.
- Dependency của từng nhóm được truyền từ composition root. Getter đọc generation, checkout context, cursor và route controller hiện hành; adapter hàm đọc các view được lazy-load tại thời điểm sử dụng. Không tạo state store hay listener toàn cục mới.
- Giữ action ID, endpoint, body, điều kiện xác nhận, quy tắc phân quyền, guard sau `await` và chính sách thanh toán hiện hữu. Frontend guard không thay thế authorization backend.
- Mở rộng quality gate chuỗi UI sang tất cả file JS trong `web/js/app/`. Các assertion kiểm tra source được chuyển sang đúng file chứa logic; không bỏ assertion cũ.

## Số liệu trên baseline tái dựng

| Chỉ số | Trước | Sau |
|---|---:|---:|
| Dòng vật lý app/main.js | 1794 | 1360 |
| Tên action | 56 | 56 |
| File JS frontend | 192 | 198 |
| Dòng JS frontend | 23018 | 23237 |
| Vòng import tĩnh / vi phạm ranh giới | 0 / 0 | 0 / 0 |

Số dòng tổng tăng do tách nhóm và wiring; không phải số đo bundle hoặc hiệu năng. Không thay đổi CSS, font, locale, schema, dependency hoặc API backend.

## Nghiệm thu

- `node --test tests/unit/phase03-action-dispatcher.test.mjs`: tám test về danh sách action, alias/lỗi, role finance, cursor, guard checkout, payload/URL và logout.
- `npm run check:architecture`, `npm run check`, `npm run build`, `npm test`, `npm run test:architecture`, `npm run test:browser`, `npm run test:canvas:browser`.
- Kiểm tra trình duyệt: menu mobile, modal, đăng nhập/đăng xuất, lọc mẫu, Creator/Admin, inbox/QR, checkout đang chờ rồi đổi trang, chuyển VI/EN. Không gọi provider thật hoặc dùng DB production cho fixture.
- Chưa thực hiện refactor `render`, submit handler, Canvas Designer, hay xác nhận kích thước bundle và hiệu năng. Bản build frontend mới cần triển khai đồng bộ tài nguyên trên Hostinger sau khi CI đạt.
