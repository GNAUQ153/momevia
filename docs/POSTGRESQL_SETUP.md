# Momevia v0.7 — Nền tảng PostgreSQL

## Trạng thái triển khai

- **Đã có:** lược đồ PostgreSQL (`database/migrations/001_initial.sql`), ràng buộc quan hệ, chỉ mục, bảng chuẩn bị cho thanh toán và outbox; công cụ kiểm tra dữ liệu JSON và xuất snapshot SQL.
- **Chưa có:** kết nối runtime sang PostgreSQL, transaction thật của thanh toán, nhận webhook, upload ảnh sang Object Storage và worker. Ứng dụng khi chạy `npm run dev` **vẫn đọc/ghi JSON Storage** như v0.6.
- **Không được:** đưa database chứa dữ liệu demo vào production và coi các đơn `demo_paid` là thanh toán thật. Bản snapshot đưa vào `app.orders` luôn gắn `is_test = TRUE`, không tạo `app.template_entitlements`.

## A. Khởi tạo PostgreSQL để thử nghiệm (Docker Desktop)

1. Cài Docker Desktop và khởi động Docker Engine.
2. Sao chép `.env.example` thành `.env` nếu chưa có. Giữ nguyên cấu hình trước đó và thêm:

```dotenv
POSTGRES_DB=momevia_dev
POSTGRES_USER=momevia
POSTGRES_PASSWORD=THAY_BANG_MAT_KHAU_NGAU_NHIEN_DU_MANH
```

3. Trong thư mục gốc repository, chạy:

```powershell
docker compose --env-file .env -f database/compose.yml up -d
```

4. Chép và chạy lược đồ SQL:

```powershell
docker compose --env-file .env -f database/compose.yml cp database/migrations/001_initial.sql db:/tmp/001_initial.sql
docker compose --env-file .env -f database/compose.yml exec db psql -X -v ON_ERROR_STOP=1 -U momevia -d momevia_dev -f /tmp/001_initial.sql
```

Nếu đổi `POSTGRES_USER` hoặc `POSTGRES_DB`, thay tương ứng ở lệnh `psql`.

> Compose này dành cho môi trường phát triển: cổng 5432 chỉ bind `127.0.0.1`; Docker volume lưu dữ liệu riêng. Không dùng password mẫu, không công khai port và không dùng nguyên cấu hình cho production.

## B. Kiểm tra snapshot JSON và tạo script import

Dừng ứng dụng trước khi tạo snapshot để tránh JSON bị ghi thay đổi trong lúc xuất.

```powershell
npm run db:prepare
```

Script đọc các JSON trong `services/*/data/`, kiểm tra UUID, khóa quan hệ, email trùng, số VND nguyên, cân đối đơn hàng, trạng thái và thời hạn. Nếu chưa có file `templates.json`, script lấy 12 mẫu mặc định từ `src/modules/catalog/seed.mjs`.

File xuất ra là **`database/private/import.sql`**, bị Git ignore. File này có thể chứa **email, lời chúc, nội dung hỗ trợ, hash mật khẩu và token phiên**. Tuyệt đối không commit, đăng lên GitHub hoặc chia sẻ trong chat công khai.

Để nhập vào database **mới và đang trống**:

```powershell
docker compose --env-file .env -f database/compose.yml cp database/private/import.sql db:/tmp/import.sql
docker compose --env-file .env -f database/compose.yml exec db psql -X -v ON_ERROR_STOP=1 -U momevia -d momevia_dev -f /tmp/import.sql
docker compose --env-file .env -f database/compose.yml exec db rm /tmp/import.sql
```

Lệnh import chạy trong `BEGIN/COMMIT`. Nó chủ động **từ chối import nếu database đã chứa bản ghi** trong những bảng dữ liệu hiện có; không có chế độ ghi đè. Nếu lỗi, không thử chạy lại bằng cách xóa/ghi đè database đang sử dụng; phải xác định nguyên nhân trước.

Xác minh số bản ghi:

```powershell
docker compose --env-file .env -f database/compose.yml cp database/verify.sql db:/tmp/verify.sql
docker compose --env-file .env -f database/compose.yml exec db psql -X -v ON_ERROR_STOP=1 -U momevia -d momevia_dev -f /tmp/verify.sql
```

Đối chiếu số lượng với log `npm run db:prepare`. Script **chỉ chuyển metadata đường dẫn của ảnh** trong gifts; file ảnh ở `services/gifts/data/images/` cần đưa sang Object Storage bằng bước migration riêng.

### Các cảnh báo quan trọng

- **Không bật PostgreSQL runtime ở v0.7:** Chưa có repository adapter async và chưa có cơ chế dual-write/cutover; đừng tự đổi `.env` để tưởng ứng dụng đã dùng DB.
- Snapshot không phải backup tin cậy của hệ thống đang hoạt động. Cần dừng ghi và backup các file JSON + media trước khi export.
- Schema chuẩn bị cho thanh toán thật nhưng không xử lý giao dịch và không cấp entitlement từ đơn demo.
- Nếu import dữ liệu có chứa sessions thì chúng có thể hết hạn; trước production nên loại bỏ toàn bộ phiên demo và yêu cầu đăng nhập lại.
- Không chạy cùng lúc runtime JSON trên nhiều instance; các repository hiện tại vẫn chỉ đảm bảo một tiến trình.
- Không sử dụng Docker volume tạo thử nghiệm để lưu dữ liệu production.

## C. Hướng tiếp theo sau v0.7

1. Xây `PostgresRepository` bất đồng bộ và adapter theo interface của từng module.
2. Chuyển các service/route sang `async/await`, bổ sung transaction cho mỗi use case nhiều bảng.
3. Kiểm thử sự tương đương dữ liệu giữa JSON và PostgreSQL, sau đó cutover từng module trong môi trường staging.
4. Tạo cấp quyền mẫu riêng cho đơn thanh toán thực, webhook có chữ ký và idempotency, outbox + background worker.
5. Di chuyển file ảnh sang Object Storage, kiểm thử khôi phục và backup trước production.

Không đưa tất cả thay đổi trên vào một PR cùng lúc; giữ khả năng rollback từng bước.
