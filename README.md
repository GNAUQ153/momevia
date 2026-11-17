# Momevia — Nền tảng quà tặng số tương tác

**Phiên bản phát triển:** 0.9.0 — Client–Server + Modular Monolith + OOP (Node.js). Ứng dụng chưa đủ điều kiện triển khai thương mại có thu tiền thật.

Momevia cho phép người dùng chọn mẫu, cá nhân hóa, xuất bản quà qua link/QR, mở quà và gửi phản hồi. Hỗ trợ tài khoản email/mật khẩu, vai trò Creator/Admin, yêu thích và biểu mẫu hỗ trợ. Google/Zalo OAuth cần cấu hình ứng dụng nhà cung cấp. Checkout hiện chỉ tạo **đơn hàng mô phỏng**, chưa xử lý tiền thật.


## MySQL 8.4 Foundation & Support Adapter (v0.8)

MySQL 8.4 LTS với InnoDB/utf8mb4 là database được chọn. Đã chuyển schema, công cụ chuẩn bị snapshot JSON, Docker Compose, connection pool và adapter MySQL cho module **Support**.

- Hướng dẫn: [`docs/MYSQL_SETUP.md`](docs/MYSQL_SETUP.md)
- Tạo snapshot JSON riêng tư: `npm run db:prepare`
- Kiểm tra MySQL thật: `npm run db:ping`, `npm run db:verify`
- **Mặc định vẫn dùng JSON**; chỉ `SUPPORT_STORAGE=mysql` mới bật MySQL cho Support.
- Driver `mysql2` phải có trong `package-lock.json` trước khi chạy `npm ci`; dùng `npm install mysql2@3.24.6 --save-exact` khi tích hợp patch v0.9.
- Từ v0.9, có thể bật MySQL cho **Identity và Catalog** sau khi import dữ liệu; Gifts/Checkout vẫn JSON. Chưa có thanh toán thật hoặc multi-instance production.
- Tuyệt đối không commit `.env`, `database/private/` hoặc `services/*/data/`.

## Khởi chạy bằng VS Code trên Windows

Yêu cầu Node.js 22.13+ hoặc Node.js 24+, npm và kết nối mạng khi cài gói lần đầu.

```powershell
Copy-Item .env.example .env
npm ci
npm run build
npm run check
npm test
npm run test:architecture
npm run dev
```

Mở `http://localhost:4100`. Nếu đã có `.env` riêng thì **không ghi đè**. Nếu gặp lỗi vì file QR thiếu, chạy lại `npm run build` sau `npm ci`.

### Các lệnh quan trọng

| Lệnh | Tác dụng |
|---|---|
| `npm run db:ping` | Kiểm tra kết nối MySQL với `.env` (cần mysql2) |
| `npm run db:verify` | Kiểm tra schema + migration trên MySQL thật (cần mysql2) |
| `npm run dev` | Khởi động **một** backend HTTP process, mặc định cổng 4100 |
| `npm run build` | Tạo module QR của frontend từ dependency đã cài |
| `npm run check` | Kiểm tra cú pháp, ESLint, workflow và file QR |
| `npm test` | Unit tests |
| `npm run test:architecture` | API regression trên dữ liệu/cổng tạm, **một server** |
| `npm run test:browser` | Browser regression với Playwright nếu có trình duyệt |
| `npm run seed:test-user` | Sinh tài khoản QA ngẫu nhiên; dừng ứng dụng trước khi chạy |
| `npm run dev:legacy` | Chế độ 6 process cũ, chỉ để kiểm tra tương thích |
| `npm run test:architecture:legacy` | Kiểm thử topology 6 process cũ |

**Không chạy `dev` và `dev:legacy` đồng thời trên cùng dữ liệu JSON.**

## Kiến trúc

```text
Browser → HTTP Server :4100
           ├── Identity  (OOP / sessions / roles)
           ├── Catalog   (templates / favorites)
           ├── Checkout  (demo orders / licenses)
           ├── Gifts     (gift / photo / reply)
           └── Support   (contact requests)
```

`src/server/app.mjs` tạo và nối các module bằng dependency injection. Module giao tiếp qua interface nội bộ (getTemplate, hasLicense, resolveUser), không qua cổng HTTP riêng. Những route cũ `/api/auth`, `/api/catalog`, `/api/gifts`, `/api/checkout`, `/api/support` **được giữ nguyên** nên không yêu cầu sửa frontend.

- **OOP:** Controller/route, Service, Repository được tách theo trách nhiệm.
- **Xác thực:** Session được kiểm tra trực tiếp từ Identity trên mỗi request cần đăng nhập, bảo toàn tính năng logout/revoke và role hiện tại.
- **Dữ liệu:** Vẫn là file JSON tại `services/*/data/` để không làm mất dữ liệu hiện có. **Chưa an toàn cho nhiều instance/production.**
- **Bảo mật:** Chặn endpoint `/internal` công khai, loại bỏ header forwarding do client tự gửi, giới hạn tốc độ và không cấp quyền chỉ dựa vào role trong JWT.

Xem [tài liệu kiến trúc](docs/ARCHITECTURE.md), [cấu trúc source](docs/PROJECT_STRUCTURE.md), [API](docs/ENDPOINTS.md) và [giới hạn sản phẩm](docs/PRODUCT_SCOPE.md).

## Cấu hình môi trường

Các khóa ở `.env` là bí mật, không commit lên GitHub. Tạo file mới từ `.env.example` rồi thay các giá trị ví dụ trước khi triển khai production. Khi dev không có khóa, launcher tạo khóa ngẫu nhiên cho phiên chạy đó; token mất hiệu lực nếu khởi động lại. Để tái sử dụng phiên cần khai báo `JWT_SECRET` ổn định ở máy chạy.

```env
PUBLIC_BASE_URL=http://localhost:4100
PORT=4100
HOST=127.0.0.1
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ZALO_APP_ID=
ZALO_APP_SECRET=
```

Cấu hình `JWT_SECRET`, `INTERNAL_SERVICE_KEY` và OAuth callback xem `.env.example`. `INTERNAL_SERVICE_KEY` tiếp tục tồn tại để kiểm thử topology cũ; không được dùng như bằng chứng phân quyền người dùng.

### Tài khoản mẫu qua `.env`

Điền các biến sau vào `.env` để tự tạo một tài khoản khi khởi động bằng `npm run dev` (cũng áp dụng cho Identity ở chế độ legacy):

```env
TEST_ACCOUNT_ENABLED=true
TEST_ACCOUNT_NAME="Tài khoản kiểm thử"
TEST_ACCOUNT_EMAIL=your-tester@example.test
TEST_ACCOUNT_PASSWORD=<mật khẩu riêng từ 10 đến 128 ký tự, có chữ và số>
TEST_ACCOUNT_ROLE=sender
```

Thay giá trị mật khẩu trước khi chạy. Vai trò nhận `sender`, `creator` hoặc `admin`; nếu bỏ trống thì dùng `sender`. Đăng nhập tại `/login` bằng email/mật khẩu đã khai báo, không cần bật `DEMO_AUTH_ENABLED`. Thiếu email/mật khẩu hợp lệ sẽ dừng khởi động khi tính năng được bật. Production từ chối bật tính năng này.

Tài khoản dùng cấu trúc hiện có trong `services/identity/data/users.json`, lưu `passwordHash` và thêm `testAccount: { "source": "env" }` để ghi nhận nguồn tạo. API không trả mật khẩu, hash hoặc metadata này. Khởi động lại không tạo trùng hay thay đổi ID, tên, mật khẩu, vai trò của tài khoản mẫu đã lưu; thay `.env` không cập nhật các trường đó. Email trùng tài khoản khác sẽ báo lỗi và không ghi đè. Đặt `TEST_ACCOUNT_ENABLED=false` chỉ tắt việc tạo mẫu, tài khoản đã lưu vẫn tồn tại và đăng nhập được. Không commit `.env` hoặc dữ liệu tài khoản.

## Trạng thái và rủi ro trước production

- **MySQL mới là foundation + Support (tùy chọn):** Chưa cutover Identity, Catalog, Gifts và Checkout; cần migration dữ liệu có kiểm chứng, backup và transaction nghiệp vụ.
- **Thanh toán mới là mô phỏng:** Chưa nhận tiền thật, chưa có webhook, đối soát hoặc payout creator.
- **Gửi thiệp hiện chia sẻ link/QR:** Chưa có background queue gửi email/SMS tự động và chính sách chống spam hoàn chỉnh.
- **OAuth Google/Zalo:** Cần xác thực end-to-end bằng credentials thật, HTTPS và callback được nhà cung cấp cho phép.
- **Vận hành:** Cần object storage, sao lưu, giám sát lỗi, chính sách dữ liệu, E2E và kiểm tra bảo mật trước khi phát hành.

Mỗi thay đổi nên thực hiện trên branch riêng và mở Pull Request; không ghi đè source vừa refactor bằng bản ZIP v0.4/v0.5 cũ.


## v0.9 MySQL Identity & Catalog

Bổ sung các adapter MySQL cho Users/Sessions/Templates/Favorites và lệnh import JSON an toàn.
Theo mặc định Identity/Catalog vẫn dùng JSON; sau migration/import, đọc [hướng dẫn v0.9](docs/MYSQL_V09_IDENTITY_CATALOG.md).
