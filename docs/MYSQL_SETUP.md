# Momevia v0.8 — MySQL 8.4 LTS (Windows / Docker)

> **Trạng thái:** Đã chuyển lược đồ và công cụ JSON import sang MySQL; lớp kết nối hỗ trợ transaction; **Support** có adapter MySQL tùy chọn. **Identity, Catalog, Gifts, Checkout vẫn lưu JSON**. Chưa kích hoạt thanh toán thật. Không dùng bản này cho production.

## 1. Chuẩn bị

Yêu cầu: Node.js 22+, Docker Desktop với WSL 2 và Docker Engine đang chạy. Mở Terminal tại thư mục gốc `E:\momevia-mvp`.

- Tạo `.env` từ `.env.example` nếu chưa có. **Giữ lại các khóa JWT, OAuth hiện có**.
- Điền các biến MySQL (tạo 2 mật khẩu ngẫu nhiên, khác nhau):

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=momevia_dev
MYSQL_USER=momevia
MYSQL_PASSWORD=<mat-khau-rieng>
MYSQL_ROOT_PASSWORD=<mat-khau-root-khac>
SUPPORT_STORAGE=json
```

**Không commit `.env`.** `MYSQL_ROOT_PASSWORD` chỉ phục vụ Docker khởi tạo; ứng dụng sử dụng tài khoản `momevia`. Đổi mật khẩu trong `.env` **không tự đổi mật khẩu database đã khởi tạo trong Docker volume**.

## 2. Khởi động MySQL

```bash
docker compose --env-file .env -f database/compose.yml up -d
docker compose --env-file .env -f database/compose.yml ps
```

Port `3306` chỉ bind `127.0.0.1`; nếu đã có MySQL của XAMPP, hãy dừng MySQL XAMPP hoặc đổi **MYSQL_PORT=3307** trong `.env`, rồi khởi động Compose với cổng mới. Momevia khi chạy ngoài container sẽ kết nối tới `127.0.0.1:3307`.

## 3. Cài Node driver

```bash
npm install mysql2@3 --save-exact
```

Lệnh này sẽ cập nhật `package.json` **và** `package-lock.json`. Cần commit cả hai lên branch cùng code. Sau đó dùng `npm ci` ở các lần cài mới.

## 4. Chạy schema trên database MỚI, không có dữ liệu

Các lệnh dưới đây dùng cú pháp **PowerShell** hoặc Git Bash; biến môi trường được mở rộng **bên trong container**:

```bash
docker compose --env-file .env -f database/compose.yml cp database/migrations/001_initial.sql db:/tmp/001_initial.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/001_initial.sql'

docker compose --env-file .env -f database/compose.yml cp database/migrations/002_support_user_bridge.sql db:/tmp/002_support_user_bridge.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/002_support_user_bridge.sql'
```

Migration `002` chỉ được chạy **một lần**. Không thử chạy lại `002` nếu cột `legacy_user_id` đã tồn tại. Trong MySQL, DDL không tự rollback toàn bộ như transaction dữ liệu.

Kiểm tra:

```bash
npm run db:ping
npm run db:verify
```

Để xem dữ liệu SQL:

```bash
docker compose --env-file .env -f database/compose.yml cp database/verify.sql db:/tmp/verify.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/verify.sql'
```

## 5. Chuyển snapshot JSON cũ (tùy chọn, KHÔNG bắt buộc)

**Dừng `npm run dev`**, sao lưu `services/*/data/` và ảnh trước khi làm. Cẩn trọng với tài khoản và phiên đăng nhập thật.

```bash
npm run db:prepare
```

File nhạy cảm được tạo tại `database/private/import.sql` và đã bị Git ignore. Chỉ import vào database **trống các bảng nghiệp vụ**. Bảng migrations đã có phiên bản 001 và 002 không bị tính là dữ liệu nghiệp vụ.

```bash
docker compose --env-file .env -f database/compose.yml cp database/private/import.sql db:/tmp/import.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/import.sql'
docker compose --env-file .env -f database/compose.yml exec -T db rm -f /tmp/import.sql
npm run db:verify
```

Nếu import lỗi, không xóa database hoặc cố chạy lại cho đến khi xác định rollback. File SQL chứa email, nội dung quà, lời đáp, password hash và phiên; **không gửi lên GitHub, chat hoặc log công khai**. File ảnh thật chưa được migrate. Đơn `demo_paid` vẫn là dữ liệu thử và **không tạo quyền sử dụng mẫu production**.

## 6. Bật MySQL riêng cho Support

Trong `.env`:

```dotenv
SUPPORT_STORAGE=mysql
```

Sau đó chạy:

```bash
npm run dev
```

Gửi yêu cầu ở nút **Liên hệ/Hỗ trợ**, kiểm tra bản ghi bằng `npm run db:verify` hoặc DBeaver. Request mới được lưu vào `support_requests`; ID tài khoản JSON được giữ trong `legacy_user_id`, vì Identity chưa chuyển MySQL.

Để quay lại JSON: dừng server, chỉnh `SUPPORT_STORAGE=json`, khởi động lại. **Dữ liệu ở MySQL không tự chuyển ngược về JSON**. Khi nhập dữ liệu cần chọn một nguồn làm chính, tránh mất lịch sử liên hệ.

## 7. Các lệnh quản trị

```bash
# Xem logs
docker compose --env-file .env -f database/compose.yml logs --tail=60 db

# Dừng database nhưng giữ volume
docker compose --env-file .env -f database/compose.yml stop

# Khởi động lại
docker compose --env-file .env -f database/compose.yml up -d
```

**KHÔNG chạy `docker compose down -v`** nếu muốn giữ dữ liệu.

DBeaver hoặc MySQL Workbench: Host `127.0.0.1`, Port từ `.env`, Database `momevia_dev`, User `momevia`, mật khẩu của `MYSQL_PASSWORD`.

## 8. Giới hạn và những việc tiếp theo

- Chưa kiểm thử thật migration/adapter trên MySQL 8.4 tại môi trường tạo source. **Phải chạy `db:verify`, kiểm tra chức năng Support và CI trước khi merge.**
- Module khác chưa lưu MySQL, JSON vẫn là nguồn dữ liệu chính.
- Chưa triển khai transactional checkout, webhook payment, outbox worker hay chi trả creator.
- Để production: thêm backup/restore, migration versioning chuẩn, monitoring, secret manager, transaction business và kiểm thử xâm nhập.
