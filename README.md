# Momevia — Nền tảng quà tặng số tương tác

**Phiên bản phát triển:** 0.6.0 — Client–Server + Modular Monolith + OOP (Node.js). Ứng dụng chưa đủ điều kiện triển khai thương mại có thu tiền thật.

Momevia cho phép người dùng chọn mẫu, cá nhân hóa, xuất bản quà qua link/QR, mở quà và gửi phản hồi. Hỗ trợ tài khoản email/mật khẩu, vai trò Creator/Admin, yêu thích và biểu mẫu hỗ trợ. Google/Zalo OAuth cần cấu hình ứng dụng nhà cung cấp. Checkout hiện chỉ tạo **đơn hàng mô phỏng**, chưa xử lý tiền thật.

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

## Trạng thái và rủi ro trước production

- **Chưa có PostgreSQL:** Cần migration có kiểm tra dữ liệu và backup/rollback; xây unique constraints, transaction, idempotency.
- **Thanh toán mới là mô phỏng:** Chưa nhận tiền thật, chưa có webhook, đối soát hoặc payout creator.
- **Gửi thiệp hiện chia sẻ link/QR:** Chưa có background queue gửi email/SMS tự động và chính sách chống spam hoàn chỉnh.
- **OAuth Google/Zalo:** Cần xác thực end-to-end bằng credentials thật, HTTPS và callback được nhà cung cấp cho phép.
- **Vận hành:** Cần object storage, sao lưu, giám sát lỗi, chính sách dữ liệu, E2E và kiểm tra bảo mật trước khi phát hành.

Mỗi thay đổi nên thực hiện trên branch riêng và mở Pull Request; không ghi đè source vừa refactor bằng bản ZIP v0.4/v0.5 cũ.
