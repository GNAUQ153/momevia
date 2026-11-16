# Hướng dẫn cập nhật Momevia v0.4.0 vào GitHub

Bản cập nhật được xây từ nguồn **Momevia v0.3.0** đã gửi trước đó, **không phải trạng thái mới nhất trên GitHub** nếu hai thành viên đã sửa thêm code.

## Cách áp dụng an toàn

1. Tại thư mục repository đã clone, chạy `git status`. Commit hoặc stash những thay đổi còn dang dở.
2. Khuyến nghị tạo branch riêng: `git switch main`, `git pull origin main`, `git switch -c feature/auth-catalog-policies`.
3. Giải nén **Momevia_v0.4_Update_Only.zip** và chép nội dung bên trong đè đúng đường dẫn vào thư mục repository (cùng cấp `package.json`).
4. Kiểm tra `git diff` và `git status`; file mới và file chỉnh sửa phải trùng các mục bên dưới.
5. Chạy `npm test`, `npm run dev`, rồi tại terminal thứ hai chạy `npm run smoke:auth`, `npm run smoke`, `npm run smoke:ui`.
6. Kiểm tra các trang `/login`, `/register`, `/explore` và `/policies/privacy` bằng trình duyệt và trên điện thoại.
7. Commit và push; tạo PR vào `main` để thành viên còn lại review.

**Không chép đè `.env`, không đưa thư mục `services/**/data/` vào git, không thay thế thư mục `.git` hoặc `.github/workflows/ci.yml`.**

## File thay đổi/chèn mới

- `.gitignore` (tăng bảo vệ secret)
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `web/index.html`
- `web/js/app.js`
- `web/js/catalog-filter.js` (mới)
- `web/js/legal.js` (mới)
- `web/css/catalog-filters.css` (mới)
- `web/css/auth-pages.css` (mới)
- `web/css/legal.css` (mới)
- `scripts/seed-test-user.mjs` (mới)
- `scripts/smoke-ui.mjs` (mới)
- `tests/catalog-filter.test.mjs` (mới)
- `tests/legal.test.mjs` (mới)
- `docs/UPDATE_V04.md` (mới)

## Chú ý

- Bản update chưa thêm kiểm thử trình duyệt tự động do môi trường tạo source chặn truy cập localhost từ Chromium.
- Chính sách là bản dự thảo, không thay thế việc xác định đơn vị vận hành, nghĩa vụ pháp lý và quy trình xử lý dữ liệu/giao dịch trước production.
- OAuth Google/Zalo vẫn phải được cấu hình bằng credentials hợp lệ.
- Quy trình thanh toán thật và hoàn tiền chưa được tích hợp.
