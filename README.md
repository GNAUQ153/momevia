# Momevia — Interactive Digital Gift Platform

**Momevia** là nền tảng web tạo và gửi quà tặng số tương tác. Người gửi (Sender) có thể chọn mẫu, tùy biến nội dung, phát hành và chia sẻ bằng liên kết/QR; người nhận xem và hồi đáp mà không cần tài khoản. Nhà sáng tạo (Creator) có thể thiết kế mẫu, gửi kiểm duyệt và quản lý phiên bản; Admin quản trị người dùng, nội dung và hỗ trợ.

> **Trạng thái:** MVP/Beta. Thanh toán live chưa được xác nhận sẵn sàng vận hành; không dùng giao dịch thật trước khi hoàn thành kiểm thử với merchant và đối soát.

## Tech stack và kiến trúc

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript ES Modules (responsive, Canvas Editor) |
| Backend | Node.js 22.13+ hoặc 24+, JavaScript ESM, HTTP server, Modular Monolith |
| Database | JSON storage mặc định; MySQL 8.4 LTS (InnoDB, UTF8MB4) qua `mysql2` khi được cấu hình |
| Thanh toán | `@payos/node` (payOS/VietQR), MoMo API/IPN; mặc định vô hiệu hóa live |
| Media / QR | `sharp` xử lý ảnh; `qrcode-generator` cho mã QR chạy nội bộ |
| Kiểm thử | `node:test`, ESLint, Playwright, MySQL integration và GitHub Actions CI/CD |
| Công cụ local | npm, Docker Desktop + Docker Compose (nếu sử dụng MySQL) |

Ứng dụng chạy **một tiến trình backend**, chia module theo nghiệp vụ tại `src/modules/` (`identity`, `catalog`, `designs`, `gifts`, `checkout`, `payments`, `support`). Các adapter MySQL và JSON được cấu hình theo môi trường; **không chuyển storage bằng cách đổi cờ trước khi import dữ liệu**.

## Chức năng hiện tại theo vai trò

| Vai trò | Chức năng chính |
| --- | --- |
| **Sender** | Đăng nhập/đăng ký, khám phá mẫu, quản lý yêu thích, thiết kế/cá nhân hóa, lưu nháp, xuất bản và chia sẻ quà, xem phản hồi, thu hồi link/quà |
| **Creator** | Thiết kế mẫu bằng Canvas, quản lý bản nháp và phiên bản, gửi Admin duyệt, sửa theo phản hồi và rút mẫu khỏi thư viện |
| **Admin** | Quản lý vai trò, duyệt mẫu, tiếp nhận báo cáo vi phạm và ticket hỗ trợ |
| **Recipient (khách)** | Xem quà qua link/QR và hồi đáp theo chính sách quyền của món quà |

**Còn đang hoàn thiện:** vòng đời hủy/retry thanh toán an toàn, hoàn tiền/đối soát vận hành, định giá và chi trả Creator, tự động thu phí gói. Trang Pricing không đồng nghĩa đã có subscription thực tế.

**Nhạc nền Canvas:** Thư viện 10 giai điệu nội bộ (6 bài theo sinh nhật, đám cưới, Giáng sinh, Tết dương lịch, Tết Nguyên đán, Valentine); Sender lọc theo dịp/cảm xúc, nghe thử và chỉnh âm lượng. Recipient chủ động bấm phát. Hướng dẫn tại [Music Occasion V4](docs/MUSIC_OCCASIONS_V4.md).

## Chạy localhost (mặc định JSON)

**Yêu cầu:** Node.js 22.13+ (nhánh 22) hoặc Node.js 24+, npm. Mở Terminal tại thư mục gốc dự án.

```bash
cp .env.example .env
npm ci
npm run build
npm run dev
```

Trước khi khởi động, **thay `JWT_SECRET` và `INTERNAL_SERVICE_KEY` trong `.env`** bằng hai giá trị ngẫu nhiên, khác nhau, dài ít nhất 32 ký tự. Có thể tạo từng khóa bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Mở **http://localhost:4100**. Dừng server bằng `Ctrl+C`. Không commit `.env` hoặc thông tin mật. `npm start` cũng khởi động ứng dụng; cách chạy trên là dành cho phát triển local.

## Chạy localhost với MySQL 8.4 (tùy chọn)

1. Mở **Docker Desktop**. Trong `.env`, đặt `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_HOST=127.0.0.1`, `MYSQL_DATABASE=momevia_dev` và `MYSQL_PORT` (ví dụ `3307` nếu cổng 3306 đang được sử dụng).
2. Chạy các lệnh dưới đây tại thư mục gốc dự án:

```bash
docker compose --env-file .env -f database/compose.yml up -d
npm run db:migrate
npm run db:ping
npm run db:verify
npm run dev
```

3. Chỉ bật các cờ storage MySQL (`IDENTITY_STORAGE`, `CATALOG_STORAGE`, `DESIGNS_STORAGE`, `GIFTS_STORAGE`, `CHECKOUT_STORAGE`, `SUPPORT_STORAGE`) sau khi hoàn tất migration và **import/đối chiếu dữ liệu hiện có**. Các module có ràng buộc phụ thuộc; xem [Vận hành MySQL](docs/OPERATIONS.md#nâng-schema-mysql-từ-terminal).

Không chạy `docker compose down -v` đối với dữ liệu cần giữ lại. Không bật `PAYMENT_ENABLED`/`PAYMENT_LIVE_ENABLED` khi chưa có merchant sandbox/HTTPS webhook và kiểm thử an toàn.

## Kiểm thử trước khi push

```bash
npm run build
npm run check
npm test
npm run test:architecture
npm run package
npm run verify:package
```

Các bài browser/Canvas/MySQL chuyên sâu và quy trình release có tại [docs/OPERATIONS.md](docs/OPERATIONS.md). Có thể chạy demo cho nhiều vai trò bằng `npm run demo:web` tại http://127.0.0.1:4110.

## Cập nhật tự động sau mỗi lần push lên `main`

Sau khi workflow **Momevia CI/CD** thành công, GitHub Actions **Momevia README Sync** sẽ cập nhật mục bên dưới dựa trên phiên bản `package.json`, các chức năng được ghi trong `CHANGELOG.md` và những commit gần nhất. Các phần tên dự án, tech stack, vai trò và hướng dẫn localhost **được giữ nguyên**. Nếu thay đổi công nghệ hay quy trình chạy, developer phải chỉnh mục tương ứng và ghi `CHANGELOG.md` cùng commit.

<!-- MOMEVIA-AUTO-START -->
### Phiên bản và cập nhật gần đây

**Phiên bản trong package.json:** `1.1.0` (không đồng nghĩa đã phát hành production).

**Các chức năng/thay đổi gần đây được ghi nhận trong CHANGELOG:**

- Sửa thứ tự thao tác trong `tests/browser/home.mjs`: mở hộp thoại Preview trước, đợi hiển thị rồi mới đọc CTA “Dùng mẫu”; tránh Playwright chờ 30 giây vì dialog chưa mở.
- Thêm unit guard kiểm tra thứ tự `Enter → dialog visible → CTA href` để hạn chế tái diễn lỗi trong CI. Giữ nguyên code ứng dụng, API, Canvas và dữ liệu người dùng.

**Các commit gần nhất trên `main`:**

- `2e421bb` — test: open template preview before checking create CTA (2026-11-23)
- `932b911` — feat: let users create cards directly from template previews (2026-11-23)
- `3559344` — feat: add occasion discovery shortcuts to marketing home (2026-11-23)
- `78bf643` — perf: respect data saver in marketing motion and slideshow (2026-11-23)
- `d36c664` — fix(auth): use Zalo brand icon and sync web assets (2026-11-23)
- `4e6173a` — fix: include interactive cards rollout bundle in release package (2026-11-23)

> Mục này được đồng bộ tự động sau khi CI đạt. Để thông tin tính năng chính xác, mỗi thay đổi nghiệp vụ phải được ghi trong `CHANGELOG.md` và dùng commit message rõ ràng.
<!-- MOMEVIA-AUTO-END -->

## Tài liệu dự án

- [Danh mục tài liệu](docs/README.md)
- [Kiến trúc](docs/ARCHITECTURE.md) · [HTTP API](docs/ENDPOINTS.md)
- [Hướng dẫn Creator/Sender](docs/CANVAS_SENDER_GUIDE.md) · [Demo nhiều vai trò](docs/DEMO_WEB.md)
- [Vận hành, backup, MySQL và CI/CD](docs/OPERATIONS.md)
- [Lịch sử chức năng và sửa lỗi](CHANGELOG.md)
- [GitHub Actions](https://github.com/GNAUQ153/momevia/actions)
