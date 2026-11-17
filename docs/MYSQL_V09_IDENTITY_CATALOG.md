# Momevia v0.9 — MySQL Identity & Catalog

## Phạm vi

Bản v0.9 chuyển **Users, Sessions, Templates, Favorites** sang MySQL theo cờ bật/tắt. Các endpoint public giữ nguyên. Support tiếp tục dùng MySQL (nếu `SUPPORT_STORAGE=mysql`). Gifts, Checkout và các tệp ảnh vẫn dùng JSON / file local. Không tích hợp thanh toán thật.

**Không bật MySQL Identity/Catalog trước khi import dữ liệu cũ.** Không có đồng bộ hai chiều JSON ↔ MySQL. Nếu bạn rollback về JSON, những tài khoản/mẫu được tạo mới sau khi bật MySQL sẽ không tự xuất hiện trong JSON.

## 1. Chuẩn bị

- Dùng **MySQL 8.4** trong Docker, trạng thái `healthy`, source ở nhánh `main` đã đồng bộ với remote.
- Bảo đảm `.env` có `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT=3307` (nếu Docker đã dùng cổng đó), `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`.
- Sao lưu cả dữ liệu JSON dưới `services/*/data/` và MySQL volume, đóng ứng dụng để tránh ghi dữ liệu trong khi import.
- Không commit `.env`, `services/*/data/` hay backup vào GitHub.
- Không chạy `docker compose down -v` vì xóa dữ liệu database.

## 2. Cài dependencies và chạy migration mới

```bash
npm install mysql2@3.24.6 --save-exact
npm ci

docker compose --env-file .env -f database/compose.yml cp database/migrations/003_identity_catalog.sql db:/tmp/003_identity_catalog.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/003_identity_catalog.sql'

npm run db:ping
npm run db:verify
```

Chỉ chạy migration 003 **một lần**. Migration đặt `users.provider_id` ở collation case-sensitive nhằm bảo vệ các ID OAuth/demo; email login vẫn không phân biệt chữ hoa/chữ thường.

## 3. Import dữ liệu JSON → MySQL

**Mặc định là dry-run**, chỉ kiểm tra cấu trúc và số lượng, chưa ghi database:

```bash
npm run db:import:identity-catalog
```

Kiểm tra số lượng `users`, `templates`, `favorites`, `sessions`, đặc biệt các file trong `services/identity/data` và `services/catalog/data`. Nếu file templates không tồn tại, importer dùng **12 mẫu seed mặc định**.

Import thật sau khi chắc chắn dữ liệu đúng:

```bash
npm run db:import:identity-catalog -- --apply
npm run db:verify
```

Các bảng **users, sessions, templates, favorites phải trống trước khi import**. Nếu đã có dữ liệu, importer sẽ từ chối thay vì ghi đè. Import dùng **một transaction**, tự rollback khi gặp lỗi; giữ nguyên file JSON. Session hết hạn sẽ không được nhập. Có thêm bước nối yêu cầu Support cũ với `users` vừa import nếu ID tương ứng tồn tại.

Nếu local MySQL đã có tài khoản thật/mẫu trước v0.9: **không chạy --apply**; cần lập kế hoạch merge dữ liệu riêng. Tránh xóa bảng/volume để vượt qua lỗi này.

## 4. Chuyển runtime (chỉ sau khi import đạt)

Trong `.env` (không commit):

```dotenv
IDENTITY_STORAGE=mysql
CATALOG_STORAGE=mysql
SUPPORT_STORAGE=mysql
MYSQL_PORT=3307
```

Khởi động:

```bash
npm run dev
```

Kiểm thử thủ công: đăng nhập/đăng xuất, đăng ký trùng email, đọc `/api/auth/me`, OAuth nếu đã cấu hình, role Admin/Creator, tìm mẫu, tạo mẫu chờ duyệt, Admin duyệt, favorite add/remove, mua thử và gửi Gift (vẫn trên JSON). Khi MySQL được bật, mỗi phiên phải được kiểm tra `jti` trong bảng `sessions`, role được đọc từ bảng `users` thay vì chỉ tin JWT.

Kiểm thử source:

```bash
npm run build
npm run check
npm test
npm run test:architecture
npm run package
npm run verify:package
```

Không commit/push khi migration hoặc chức năng login/catalog thực tế bị lỗi.

## 5. Rollback có kiểm soát

Tắt ứng dụng, đặt lại `IDENTITY_STORAGE=json` và `CATALOG_STORAGE=json`, rồi chạy lại. Các tệp JSON cũ không bị import chỉnh sửa. Dữ liệu mới được tạo **sau khi bật MySQL** phải export/đối soát trước khi rollback nếu muốn giữ. Backup và một kế hoạch chuyển ngược là bắt buộc nếu có dữ liệu mới quan trọng.

## 6. Giới hạn đã biết

- MySQL runtime được chuẩn bị và có unit tests/mock; **chưa thể xác nhận end-to-end trên server MySQL thật trong môi trường tạo bản vá**.
- Schema nền đang phục vụ quá trình chuyển từ JSON, chưa tối ưu cho lượng truy cập lớn. Tìm kiếm catalog hiện thực hiện lọc ở service sau khi đọc bảng, cần SQL pagination/search index ở bản sau.
- Gifts, Checkout, media và phần lớn nghiệp vụ vẫn sử dụng lưu trữ cũ, không áp dụng transaction chéo sang MySQL.
- Chưa có đồng bộ tự động hoặc khả năng chuyển dữ liệu hai chiều.
