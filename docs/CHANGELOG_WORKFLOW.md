# Quy trình cập nhật CHANGELOG — Momevia

`CHANGELOG.md` là lịch sử thay đổi được biên tập bằng tay, không phải log tự sinh từ commit. CI/CD và README Sync không tự ghi file này.

## Mỗi lần phát triển

1. Cập nhật `main` sạch trước khi chỉnh sửa: `git pull --ff-only origin main`.
2. Khi sửa source hoặc test, thêm mục mới trên đầu `CHANGELOG.md` (ngày, chức năng, phạm vi, giới hạn, migration nếu có).
3. Kiểm thử trước khi commit: `npm run build && npm run check && npm test`.
4. Chỉ stage các file liên quan, bao gồm `CHANGELOG.md`:
   `git add CHANGELOG.md <những-file-cần-commit>`.
5. Chạy `npm run changelog:check` và `git diff --cached --check`.
6. Commit, sau đó push khi nguồn remote còn đồng bộ. Không dùng `git push --force` trên main.

Nếu chỉ sửa README/docs/ghi chú, không bắt buộc đổi changelog. Công cụ chỉ đánh giá *các file đã stage* (không thể tự xác minh nội dung ghi chú có đầy đủ/chính xác hay không). Không tự sửa Git hooks hoặc tạo commit nền, tránh xung đột với người cùng phát triển.

## Giới hạn

- Cơ chế này là kiểm tra trước commit, **chưa chặn trên GitHub Actions**. Nếu muốn áp đặt cho cả nhóm, thống nhất quy ước rồi bổ sung CI guard sau.
- Tên lớp và lời chúc trong Canvas thuộc dữ liệu người dùng, không được dịch tự động khi thay đổi giao diện.
