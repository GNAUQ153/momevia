# Momevia v0.7.0 — Hướng dẫn tích hợp vào GitHub

**Base source:** v0.6.0, được tạo từ commit nền `8d87a23` + thay đổi migration Modular Monolith. Bản cập nhật không chứa thông tin truy cập GitHub và chưa tự push lên repository.

1. Kiểm tra đã đưa **v0.6.0** lên `main` và CI thành công. Hai bạn cần tránh push đồng thời vào `main`.
2. Từ working tree sạch: `git switch main` rồi `git pull --ff-only origin main`.
3. Tạo branch `git switch -c feature/postgresql-foundation`.
4. Giải nén `Momevia_v0.7_PostgreSQL_Foundation_Update.zip`, sao chép các file vào **gốc repository** (không thêm thư mục bọc).
5. Chạy `npm ci`, `npm run build`, `npm run check`, `npm test`. Kiểm tra thêm `npm run db:prepare` (không nhập DB tự động).
6. Kiểm tra file đã stage bằng `git diff --cached --name-only` và bảo đảm không có `.env`, `database/private/` hoặc `services/**/data/`.
7. `git add .env.example .gitignore package.json package-lock.json README.md CHANGELOG.md database/ docs/POSTGRESQL_SETUP.md docs/UPDATE_V07.md tests/unit/database-import.test.mjs`.
8. `git commit -m "feat: add PostgreSQL schema and migration foundation"`.
9. `git push -u origin feature/postgresql-foundation`; tạo Pull Request vào `main`, nhờ Lộc review, chỉ merge khi CI thành công.

**Quan trọng:** Bản này chỉ chuẩn bị DB và công cụ import; `npm run dev` **vẫn dùng JSON Storage**. Không bật thanh toán production hoặc chạy đồng thời nhiều instance ghi JSON.
