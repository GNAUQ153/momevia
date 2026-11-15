# Momevia — Nền tảng quà tặng số tương tác

**Phiên bản:** 0.3.0 · **Kiến trúc:** Microservices + OOP (Node.js ES Modules) · **Ngôn ngữ giao diện:** Tiếng Việt.

Momevia là tên thương hiệu **đề xuất** cho giai đoạn phát triển; cần kiểm tra quyền sử dụng tên, nhãn hiệu và tên miền trước khi phát hành chính thức.

## 1. Bắt đầu trên Windows / VS Code

1. Cài **Node.js 22 trở lên**.
2. Giải nén `Momevia_MVP_v0.3_UI_Favorites_Support.zip` và mở thư mục `momevia-mvp` trong VS Code.
3. Mở Terminal PowerShell tại thư mục `momevia-mvp`.
4. Chạy lệnh sau:

   ```powershell
   Copy-Item .env.example .env
   npm run dev
   ```

5. Mở **http://localhost:4100**.
6. Bấm **Đăng nhập** trên header, chuyển tab **Đăng ký** để tạo tài khoản email. Sau đó vào **Khám phá mẫu**, bấm nút hình trái tim và kiểm tra trang **Mẫu yêu thích** trong menu tài khoản.

Không cần Docker, XAMPP hoặc `npm install`. Dùng `Ctrl+C` để dừng các dịch vụ. **Không đưa file `.env` lên GitHub**.

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
- Chưa xác minh email, chưa có quên mật khẩu, giới hạn số lần đăng nhập, chống bot và xử lý xóa dữ liệu đầy đủ.
- Cần triển khai HTTPS, CSP chặt chẽ, giám sát, nhật ký, kiểm thử bảo mật và quyền truy cập theo vai trò.
- **Không coi bản này là đã sẵn sàng production.** Cần QA giao diện trên Chrome, Edge, Safari và các màn hình di động thật.

## 8. Ghi nhận công nghệ, thư viện và tài nguyên

- **Lucide:** SVG icon (MIT) — <https://lucide.dev/license>.
- **Google Fonts:** Plus Jakarta Sans, Inter, Lora (SIL Open Font License); tải qua Google Fonts. Không phân phối kèm tệp font.
- **Logo Momevia:** Hình 3D tạo riêng bằng công cụ tạo ảnh AI theo yêu cầu, đặt trong `web/assets/`. Không sao chép logo của thương hiệu khác.
- **Google/Zalo:** Biểu tượng nhà cung cấp ở form xác thực tải từ nguồn mạng và chịu quy định thương hiệu tương ứng. Đường dẫn nguồn nằm trong `web/js/app.js`.

## 9. Cấu trúc thư mục chính

```text
momevia-mvp/
  web/
    assets/                 logo 3D và icon
    css/                    CSS tách riêng từng vùng
      tokens.css            màu sắc, font và biến thiết kế
      auth.css              đăng nhập/đăng ký
      upgrade.css           nhận diện, active nav, favorite, support, back-to-top
    js/
      app.js                điều hướng và hành vi UI
      icons.js              Lucide SVG
      api.js                HTTP client
  services/
    identity/               tài khoản + OAuth
    catalog/                mẫu + yêu thích
    gifts/                  trải nghiệm quà
    checkout/               luồng giả lập thanh toán
    support/                liên hệ và ghi nhận phiếu
    shared/                 HTTP, lưu trữ, bảo mật
  scripts/                  smoke tests
  tests/                    unit tests
  gateway.mjs               API gateway
  dev.mjs                   khởi động các dịch vụ
  .env.example              cấu hình mẫu
```
