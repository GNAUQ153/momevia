# Vận hành và CI/CD

## Chạy và cấu hình

Chạy `npm ci`, `npm run build` rồi `npm start`. Ứng dụng mặc định nghe ở localhost:4100. Khi chạy sau reverse proxy, đặt `HOST`, `PORT`, `PUBLIC_BASE_URL` và HTTPS theo địa chỉ thực tế. Hai khóa `JWT_SECRET` và `INTERNAL_SERVICE_KEY` phải khác nhau và dài ít nhất 32 ký tự. Duy trì khóa phiên khi khởi động lại. Kiểm tra `/api/designs/health`, quà legacy và quà canvas qua địa chỉ chia sẻ đã cấu hình.

`.env.example` ghi các cờ runtime. Có thể cấp một tài khoản QA khi startup bằng nhóm `TEST_ACCOUNT_*`, với vai trò `sender`, `creator` hoặc `admin`. Dùng email riêng cho tài khoản opt-in. Tắt cờ ngừng khởi tạo thêm tài khoản. [Web demo nhiều vai trò](DEMO_WEB.md)

## Lưu trữ, migration và khôi phục

JSON là mặc định và dùng một backend process. Khi dùng MySQL 8.4, canvas cần Identity/Catalog/Designs/Gifts cùng profile. Mẫu trả phí cần Checkout cùng profile. Support có adapter riêng. Cờ storage quyết định kho sử dụng, dữ liệu chỉ chuyển qua quy trình import.

- Lập kế hoạch import bằng `npm run db:import:identity-catalog` và `npm run db:import:gifts-checkout`. Dùng `-- --apply` sau khi kiểm nguồn, đích và backup. Importer legacy từ chối aggregate canvas có nội dung. Giữ ID, FK và ảnh legacy.
- Có thể tạm dừng ghi qua `CANVAS_EDIT_ENABLED=false` và `CANVAS_PUBLISH_ENABLED=false`. Giữ `CANVAS_READ_ENABLED=true` cho quà đã gửi. Trước rollback binary, kiểm khả năng đọc snapshot hiện có.

Với JSON, dừng writer, chọn thư mục đích mới và sao lưu `services/designs/data/`:

```text
node scripts/dev/canvas-backup.mjs export --source <designs-data-dir> --target <new-backup-dir> --offline
node scripts/dev/canvas-backup.mjs verify --source <backup-dir>
node scripts/dev/canvas-backup.mjs restore --source <backup-dir> --target <new-data-dir>
```

Sao lưu phối hợp Identity, Catalog, Checkout, Gifts legacy, Support và các ảnh tương ứng. `database/scripts/canvas-backup.mjs` diễn tập trên MySQL QA và xác minh schema, container, checksum và file ảnh. [Kịch bản khôi phục](SENDER_CREATOR_BETA.md#khôi-phục-và-vận-hành)

### Nâng schema MySQL từ terminal

Chạy từ thư mục gốc repo. Nếu các module của môi trường đang dùng JSON thì bỏ qua migration MySQL. Với môi trường dùng MySQL, repo áp dụng các file SQL trong [database/migrations](../database/migrations/) theo thứ tự số. Migration `006_canvas` bổ sung canvas, snapshot và pin. Migration `007_support_reports` bổ sung đối tượng báo cáo, người xử lý và kết quả Support. Migration `008_gift_reply_read_state` thêm trạng thái đọc cho lời đáp mới. Lời đáp cũ tiếp tục hiện trong toàn bộ hộp thư.

**1. Xác nhận máy chủ, schema và migration đã áp dụng.** Chạy `npm run db:ping` để kiểm tra tài khoản ứng dụng. Nếu gặp `ER_ACCESS_DENIED_ERROR`, đối chiếu `MYSQL_HOST`, `MYSQL_PORT` và tài khoản trên đúng máy chủ. Khi chạy Docker Compose, dùng `docker compose --env-file .env -f database/compose.yml ps` để xem cổng host của dịch vụ `db`. Mỗi máy chủ quản lý tài khoản riêng.

Trong PowerShell, dùng `mysql.exe` trong `PATH` hoặc điền đường dẫn đầy đủ. Thay các giá trị ví dụ trong `$dbArgs` bằng cấu hình của DB đích và tài khoản có quyền migration. `--password` sẽ hỏi mật khẩu trong terminal.

```powershell
$mysql = 'mysql.exe'
# Ví dụ khi mysql.exe chưa có trong PATH
# $mysql = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe'
$dbArgs = @('--no-defaults', '--protocol=TCP', '--host=127.0.0.1', '--port=3306', '--user=momevia', '--password', '--default-character-set=utf8mb4', '--database=momevia_dev')
& $mysql @dbArgs --execute='SELECT @@hostname AS server_host, VERSION() AS server_version, DATABASE() AS schema_name, CURRENT_USER() AS db_account; SELECT version, applied_at FROM schema_migrations ORDER BY version;'
```

Nếu bảng `schema_migrations` chưa có, chạy `SHOW TABLES` trên cùng schema. Chỉ bắt đầu từ `001` với schema mới, rỗng. Nếu schema đã có bảng ứng dụng hoặc ledger bị hổng số, kiểm tra trạng thái schema trước khi áp dụng tiếp.

**2. Sao lưu và áp dụng từng file còn thiếu.** Sao lưu DB và ảnh cùng mốc, rồi thử khôi phục trên đích riêng trước khi nâng schema đang dùng. Khi ledger đã có đầy đủ `001`–`006` và thiếu `007`, chạy:

```powershell
& $mysql @dbArgs --execute='source database/migrations/007_support_reports.sql'
```

Nếu thiếu nhiều file, thay tên file trong lệnh trên và chạy từng file theo thứ tự tăng dần. Dừng khi terminal báo lỗi hoặc `$LASTEXITCODE` khác `0`. MySQL DDL có implicit commit. Khi migration dừng giữa chừng, đối chiếu cột, constraint và ledger trước khi chạy lại.

Với schema đã có `001`–`007`, dùng file `database/migrations/008_gift_reply_read_state.sql` trước khi khởi động bản có hộp thư mới. Khi Catalog khởi động, ứng dụng bổ sung hai mẫu hệ thống mới còn thiếu theo ID và bảo toàn bản ghi đã có.

**3. Xác minh sau khi chạy.** Lặp lại truy vấn ledger ở bước 1. Với `007`, kiểm tra ledger có `007_support_reports` và bảng `support_requests` có đủ bốn cột mới:

```powershell
& $mysql @dbArgs --execute="SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_requests' AND COLUMN_NAME IN ('report_kind', 'report_target', 'assigned_to', 'resolution') ORDER BY COLUMN_NAME;"
npm run db:verify
```

`npm run db:verify` dùng cấu hình ứng dụng và kiểm tra bắt buộc đến `005`. Dùng truy vấn ledger để xác nhận `006`–`008`. Sau `008`, kiểm tra `gift_replies.read_status` và index `gift_replies_unread_idx`. Dữ liệu từ kho JSON chuyển sang MySQL qua các lệnh import ở trên.

## CI và phát hành

[Workflow Momevia](../.github/workflows/ci.yml) chạy cho PR vào `main`, push vào `main`, push tag và chạy thủ công. Ma trận Windows/Linux và Node 22/24 kiểm build, lint, audit, unit và HTTP. Linux/Node 24 chạy Chromium, topology legacy và bộ khởi tạo web demo. Job MySQL 8.4 dùng schema cô lập. Browser gate chạy kèm nhóm HTTP cùng phạm vi.

- Job package chờ CI và MySQL, dựng gói, cài lại dependency rồi chạy lại smoke HTTP, thư viện và canvas trong gói. Artifact gồm tar.gz, checksum SHA-256 và manifest theo file.
- Push tag `vMAJOR.MINOR.PATCH` chạy CD. Pipeline kiểm tag khớp `package.json` và commit thuộc lịch sử `main`. Job phát hành tải artifact đã qua gate, kiểm lại checksum rồi đăng gói và checksum lên GitHub Release. Quyền ghi chỉ dùng ở job phát hành.
- Gói cài đặt được bàn giao qua GitHub Release. Hosting và migration của môi trường đích có quy trình riêng.

Ở máy phát triển, có thể dùng Edge đã cài bằng `$env:BROWSER_CHANNEL='msedge'` hoặc cài Chromium bằng `npx playwright install chromium`. Chạy `npm run test:browser` và `npm run test:canvas:browser` để kiểm UI. Hai gate `test:canvas:mysql` và `test:canvas:mysql:api` yêu cầu `CANVAS_QA_MYSQL_ISOLATED=true`, cổng loopback, thông tin xác thực QA và schema bắt đầu bằng `momevia_canvas_qa_`. Gate adapter cần schema rỗng có sẵn. Gate HTTP tự tạo schema mới.

Dùng `npm run package` và `npm run verify:package` để kiểm bản dựng tại `dist/release`. Manifest ghi phiên bản, commit, trạng thái working tree và SHA-256. Package bỏ dữ liệu runtime, `.env` thật, mật khẩu demo, log và toàn bộ `local/`. Khi nhận release, kiểm checksum archive, giải nén vào thư mục mới và chạy `npm ci` tại đích.

## Thanh toán và beta

Demo cấp quyền bằng đơn `demo_paid`. Merchant cần profile MySQL, xác thực webhook, HTTPS, thử sandbox và đối soát. `PAYMENT_ENABLED` và `PAYMENT_LIVE_ENABLED` mặc định tắt. Server xác nhận trạng thái trước khi cấp quyền. [Kịch bản beta](SENDER_CREATOR_BETA.md)

## Khôi phục tài khoản

Email khôi phục chỉ được bật khi cấu hình cả `RECOVERY_MAIL_URL` và `RECOVERY_MAIL_TOKEN`. Relay HTTPS nhận POST JSON gồm `to`, `subject` và `text`, dùng Bearer token và trả 2xx khi nhận gửi. Tài khoản email đang đăng nhập có thể xác minh địa chỉ trong Studio. Mã có hạn 15 phút và dùng một lần. Sau khi đặt mật khẩu mới, ứng dụng vô hiệu hóa các phiên trước của tài khoản đó.

Tài khoản Google khôi phục qua đúng danh tính đã liên kết bằng cấu hình Google hiện tại. Tài khoản thiếu kênh đã xác minh dùng luồng hỗ trợ. Khi thử QA, dùng hộp thư và Google giả lập của bộ kiểm thử canvas API.
