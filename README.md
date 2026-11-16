# Momevia — Nền tảng quà tặng số tương tác

## Cập nhật v0.5.0 — Authentication Routes, Catalog Filters & Policies

- **Đăng nhập:** `/login` là một trang riêng; có email, mật khẩu, hai nút Google/Zalo cùng độ rộng, liên kết **Đăng ký ngay**.
- **Đăng ký:** `/register` là một trang riêng; có họ tên, email, mật khẩu, xác nhận mật khẩu và liên kết **Đăng nhập ngay**.
- **Google/Zalo:** Luồng OAuth vẫn giữ nguyên; nếu chưa điền Client ID/Secret trong `.env`, nút được vô hiệu hóa và có chú thích.
- **Thư viện:** Dropdown phong cách lấy động từ mẫu đã phát hành; checkbox **Chỉ mẫu miễn phí** độc lập; số `... mẫu phù hợp` cập nhật khi tìm kiếm hoặc lọc.
- **Chính sách:** `/policies/general`, `/policies/payment`, `/policies/privacy`, `/policies/content`, liên kết tại footer. Nội dung là bản dự thảo cần duyệt trước khi công bố chính thức.
- **Tài khoản QA:** Không đưa mật khẩu mặc định vào source. Có thể tự đăng ký tài khoản hoặc tạo tài khoản thử ngẫu nhiên qua script riêng.

### Tạo tài khoản QA (tùy chọn)

Trước khi chạy script, tắt ứng dụng để tránh ghi đồng thời vào JSON storage:

```powershell
npm run seed:test-user
```

Terminal in ra email và mật khẩu ngẫu nhiên. Ghi lại thông tin đó để đăng nhập trên `/login`, sau đó chạy `npm run dev`.
**Không chia sẻ thông tin tài khoản, không đưa các tệp `services/**/data/` hoặc `.env` lên GitHub.**

### Kiểm thử

Kiểm thử tự động trên dữ liệu và service cô lập, không cần dừng phiên local đang chạy:

```powershell
npm test
npm run test:architecture
```

`test:architecture` tạo bản sao nguồn sạch trong thư mục tạm, bỏ `.env` và dữ liệu local, dùng cổng riêng rồi tự dọn sau khi chạy HTTP regression và các smoke test. Không kiểm chứng thao tác hoặc bố cục trình duyệt. Xem [báo cáo kiến trúc](docs/CODE_REVIEW_ARCHITECTURE.md) để biết phạm vi và giới hạn. Cài dependency và tạo QR module bằng `npm ci`, `npm run build` trước khi kiểm thử.

CI kiểm tra Node 22/24 trên Windows/Linux. Sau khi toàn bộ kiểm tra đạt trên `main`, pipeline kiểm tra lại bản đóng gói và xuất artifact nguồn kèm SHA-256 từng file. Theo phạm vi hiện tại, chưa tự động deploy hosting. Xem [hướng dẫn CI và phát hành](docs/CI_RELEASE.md).

Để chạy smoke thủ công trên phiên local (các script sẽ tạo dữ liệu kiểm thử trên phiên đó):

```powershell
npm run dev
```

Mở Terminal thứ hai:

```powershell
npm run smoke:auth
npm run smoke
npm run smoke:ui
```

`smoke:ui` chỉ kiểm tra tải route/tài nguyên HTTP; **không thay thế kiểm thử thao tác và bố cục trên trình duyệt thật**.

---


**Phiên bản:** 0.5.0 + refactor chưa phát hành · **Cấu trúc mã:** Module nghiệp vụ, Node.js ES Modules · **Mô hình chạy hiện tại:** Gateway và năm service · **Ngôn ngữ giao diện:** Tiếng Việt.

Momevia là tên thương hiệu **đề xuất** cho giai đoạn phát triển; cần kiểm tra quyền sử dụng tên, nhãn hiệu và tên miền trước khi phát hành chính thức.

## 1. Bắt đầu trên Windows / VS Code

1. Cài **Node.js 22.13+ (nhánh 22) hoặc 24+**.
2. Giải nén `Momevia_MVP_v0.3_UI_Favorites_Support.zip` và mở thư mục `momevia-mvp` trong VS Code.
3. Mở Terminal PowerShell tại thư mục `momevia-mvp`.
4. Chạy lệnh sau:

   ```powershell
   Copy-Item .env.example .env
    npm ci
    npm run build
   npm run dev
   ```

5. Mở **http://localhost:4100**.
6. Bấm **Đăng nhập** trên header, chuyển tab **Đăng ký** để tạo tài khoản email. Sau đó vào **Khám phá mẫu**, bấm nút hình trái tim và kiểm tra trang **Mẫu yêu thích** trong menu tài khoản.

Không cần Docker hoặc XAMPP. Cần `npm ci` để cài dependency theo lockfile và `npm run build` để tạo module QR cục bộ trước khi chạy. Dùng `Ctrl+C` để dừng các dịch vụ. **Không đưa file `.env` lên GitHub**.

## 2. Các thay đổi phiên bản 0.3.0

- **Đổi thương hiệu:** Momevia với logo 3D thiết kế riêng, tự host tại `web/assets/momevia-logo-3d.png`.
- **Header:** Hiển thị liên kết **Trang chủ**, trạng thái active trên desktop/mobile, chỉ giữ nút **Đăng nhập** khi chưa đăng nhập; sau đăng nhập dùng menu avatar.
- **Yêu thích:** Nút trái tim trên danh sách và chi tiết mẫu, lưu vào Catalog Service theo tài khoản. Trang `/favorites` hiển thị các mẫu đã lưu.
- **Hỗ trợ:** Nút tai nghe ở góc màn hình, biểu mẫu liên hệ; yêu cầu được lưu tại Support Service và có mã ghi nhận, Admin có thể xem trong trang kiểm duyệt.
- **Back to top:** Nút trở về đầu trang khi cuộn đủ xa.
- **Form xác thực:** Icon email/khóa/mắt, nút hiện/ẩn mật khẩu, scrollbar ẩn nhưng vẫn cuộn được bằng chuột/cảm ứng.
- **Nội dung hướng người dùng:** Loại bỏ nhãn kỹ thuật “local” và “demo”. Trạng thái thanh toán vẫn được diễn đạt minh bạch là *đang hoàn thiện*.
- **Font:** Giữ đúng bộ Plus Jakarta Sans, Inter và Lora đã yêu cầu.

## 3. Kiến trúc microservices

| Dịch vụ | Cổng | Trách nhiệm |
|---|---:|---|
| API Gateway + Web | 4100 | Phục vụ website và chuyển tiếp API |
| Identity Service | 4101 | Tài khoản, đăng nhập, Google/Zalo OAuth |
| Catalog Service | 4102 | Kho mẫu, kiểm duyệt, **favorites** |
| Gifts Service | 4103 | Tạo, mở và phản hồi quà |
| Checkout Service | 4104 | Quyền dùng mẫu giả lập — chưa thu tiền |
| Support Service | 4105 | Ghi nhận yêu cầu liên hệ, quyền xem của Admin |

Mỗi dịch vụ sử dụng OOP cho nghiệp vụ của mình. Dữ liệu MVP đang lưu dạng JSON riêng biệt trong `services/*/data/` (các tệp tạo tự động khi chạy). **Không dùng JSON storage cho production**; cần chuyển sang hệ quản trị cơ sở dữ liệu có transaction, kiểm soát đồng thời và backup.

## 4. Chạy kiểm thử

```powershell
npm test
npm run smoke:auth
npm run smoke:upgrade
```

`npm test` kiểm tra unit; `smoke:auth` kiểm tra email/password; `smoke:upgrade` kiểm tra branding, lưu yêu thích theo hai tài khoản khác nhau và biểu mẫu liên hệ.

Bài kiểm thử cũ `npm run smoke:legacy` dùng đặc quyền quản trị phát triển và yêu cầu bật `DEMO_AUTH_ENABLED=true` trong môi trường kiểm thử riêng. Không bật tùy chọn này trên production.

## 5. Google và Zalo OAuth

Giao diện có nút Google/Zalo. Để xác thực thật, cần đăng ký ứng dụng với nhà cung cấp và điền thông số trong `.env`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4100/api/auth/google/callback
ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_CALLBACK_URL=http://localhost:4100/api/auth/zalo/callback
```

Google callback phải nằm trong danh sách được phép; Zalo có thể yêu cầu HTTPS, xét duyệt ứng dụng và điều kiện truy cập phù hợp. Khi chưa cấu hình, nút được hiển thị ở trạng thái không khả dụng, không giả lập đăng nhập thành công.

**Quan trọng:** OAuth chưa được kiểm chứng end-to-end với ứng dụng Google/Zalo thật vì chưa có Client ID/Secret do chủ dự án cấp.

## 6. Ghi nhận liên hệ hỗ trợ

Ở mọi trang, nhấn nút hỗ trợ ở góc dưới bên phải để gửi yêu cầu. Server lưu họ tên, email, vấn đề và mô tả tại `services/support/data/requests.json` với mã `HT-YYYY-XXXXXXXX`. Chỉ Admin đọc được danh sách qua `/api/support/admin/requests` và trang `/admin`.

Đây là hộp thư nội bộ **chưa gửi email hoặc tự động thông báo nhân viên**; cần cấu hình dịch vụ email và quy trình chăm sóc khách hàng trước production. Không lưu mật khẩu trong nội dung hỗ trợ.

## 7. Giới hạn và hạng mục trước production

- Giao dịch mua mẫu hiện là **trải nghiệm giả lập**, không thu tiền thật. Phải tích hợp cổng thanh toán và webhook trước khi mở bán.
- Dữ liệu hiện lưu JSON, không dùng cơ sở dữ liệu transaction-safe và không có backup production.
- Chưa xác minh email, chưa có quên mật khẩu, chống bot và xử lý xóa dữ liệu đầy đủ. Đã có giới hạn xác thực theo tiến trình; chưa có rate limit phân tán/WAF.
- Cần triển khai HTTPS, CSP chặt chẽ, giám sát, nhật ký, kiểm thử bảo mật và quyền truy cập theo vai trò.
- **Không coi bản này là đã sẵn sàng production.** Cần QA giao diện trên Chrome, Edge, Safari và các màn hình di động thật.

Sau cập nhật bảo mật, các phiên JWT cũ cần đăng nhập lại. Phiên mới được Identity ghi nhận và kiểm tra ở mọi service; logout thu hồi phiên hiện tại kể cả khi token bị phát lại. Nếu Identity không khả dụng, API cần kiểm tra phiên trả `503`. Hai khóa `JWT_SECRET` và `INTERNAL_SERVICE_KEY` phải khác nhau, tối thiểu 32 ký tự; production từ chối khóa ví dụ. Chạy từng service trực tiếp cũng kiểm tra các điều kiện này.

Mỗi tài khoản có một role; Sender/Creator không tự đổi role. Chỉ Admin cấp hoặc đổi quyền qua API quản trị tài khoản. Giao diện Creator không còn nút tự mở quyền. Thay đổi role được áp dụng khi request tiếp theo kiểm tra phiên, kể cả khi JWT còn chứa role cũ. Các tài khoản Creator có sẵn không tự bị hạ quyền trong bản cập nhật này.

Ảnh mới tải lên được kiểm tra định dạng thực, giới hạn 16 triệu điểm ảnh và encode lại để bỏ metadata. Ảnh đã lưu trước cập nhật không được tự động thay đổi. QR được tạo hoàn toàn tại trình duyệt.

## 8. Ghi nhận công nghệ, thư viện và tài nguyên

- **Lucide:** SVG icon (MIT) — <https://lucide.dev/license>.
- **Google Fonts:** Plus Jakarta Sans, Inter, Lora (SIL Open Font License); tải qua Google Fonts. Không phân phối kèm tệp font.
- **Logo Momevia:** Hình 3D tạo riêng bằng công cụ tạo ảnh AI theo yêu cầu, đặt trong `web/assets/`. Không sao chép logo của thương hiệu khác.
- **Google/Zalo:** Biểu tượng nhà cung cấp ở form xác thực tải từ nguồn mạng và chịu quy định thương hiệu tương ứng. Đường dẫn nguồn nằm trong `web/js/pages/auth.js`.

## 9. Cấu trúc thư mục chính

Xem [cây thư mục và trách nhiệm từng lớp](docs/PROJECT_STRUCTURE.md), [đánh giá kiến trúc và DB](docs/ARCHITECTURE_OPTIONS.md), hoặc [mục lục tài liệu](docs/README.md).

```text
src/             bootstrap, gateway, modules nghiệp vụ, shared
web/js/          app, core, pages, ui, features và vendor build
tests/           unit, integration, browser, smoke
scripts/         build, quality, release, dev
services/*/data/ dữ liệu JSON local hiện hữu (ignored)
docs/            hướng dẫn, quyết định, bằng chứng và lịch sử
```

Các file server cũ chỉ chuyển tiếp đến nguồn mới; URL API và cổng hiện tại được giữ. Ứng dụng hiện dùng JSON file storage, chưa dùng MySQL/PostgreSQL/SQLite. Không bắt buộc dùng microservices; modular monolith là đề xuất kiến trúc tiếp theo, chưa được chuyển trong bản này.
