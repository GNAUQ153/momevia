# Momevia v0.6.0 — Hướng dẫn tích hợp thay đổi kiến trúc

**Base source:** Momevia main tại commit `8d87a23` (bản ZIP người dùng gửi). Không tự ghi đè thay đổi của đồng đội nếu `main` đã có commit mới hơn.

## Mục tiêu

- Chạy **một** backend process thay cho Gateway + năm service process, vẫn ở `http://localhost:4100`.
- Giữ cấu trúc OOP, API frontend và dữ liệu JSON ở vị trí cũ.
- Kết nối module nội bộ qua dependency injection, không cần gọi HTTP qua 4101–4105.
- Giữ chế độ legacy để so sánh, **không chạy cả hai chế độ đồng thời trên cùng dữ liệu**.

## Đưa vào GitHub (khuyến nghị Pull Request)

Mở thư mục Git `E:\momevia-mvp`, kiểm tra working tree sạch rồi:

```bash
git switch main
git pull --ff-only origin main
git switch -c refactor/modular-monolith
```

Giải nén **Momevia_v0.6_Modular_Update.zip**, chép các file vào thư mục dự án và ghi đè đúng file trùng tên. Không sao chép nguyên thư mục ZIP lồng thêm cấp. **Không xóa `.git`, `.env`, các thư mục `services/*/data/` hoặc file media người dùng.**

Nếu Lộc đã chỉnh sửa những file này sau commit nền, cần đối chiếu Git diff trước khi ghi đè.

```bash
npm ci
npm run build
npm run check
npm test
npm run test:architecture
```

Nếu tất cả thành công, chạy:

```bash
npm run dev
```

Mở http://localhost:4100. Chỉ một process backend và một cổng 4100 được khởi động mặc định.

```bash
git status
git diff --stat
git add -A
git diff --cached --name-only
git commit -m "refactor: migrate Momevia to modular monolith"
git push -u origin refactor/modular-monolith
```

Tạo PR vào `main`, nhờ Lộc review, chờ GitHub Actions CI thành công rồi merge. Không push force lên `main`.

## Kiểm tra dữ liệu và tương thích

- `src/server/app.mjs` là composition root.
- `src/bootstrap/start.mjs` dùng một process; `npm run dev:legacy` dùng topology cũ chỉ để QA.
- Dữ liệu JSON hiện hữu giữ nguyên, nhưng **vẫn không phù hợp chạy nhiều instance hoặc thanh toán thật**.
- `JWT_SECRET` nên ổn định nếu cần giữ phiên sau khi restart. Không đưa `.env` lên GitHub.
- Google/Zalo OAuth vẫn cần credentials và callback URL thật; chưa được xác nhận production.
- `npm run test:architecture:legacy` giúp kiểm tra lại topology sáu process khi cần, nhưng không cần chạy trong mỗi PR.

## Giới hạn đợt này

Đây là **migration kiến trúc**, chưa phải migration PostgreSQL; chưa có payment webhook, Object Storage, queue/worker, payout. Chưa đưa lên production.
