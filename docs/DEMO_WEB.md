# Web demo Momevia

```powershell
npm ci
npm run demo:web
```

Mở [localhost:4110](http://localhost:4110) hoặc [127.0.0.1:4110](http://127.0.0.1:4110). Cả hai địa chỉ hỗ trợ đăng nhập; cookie phiên riêng theo hostname nên cần đăng nhập lại khi đổi địa chỉ. Lệnh build web và chạy một backend JSON riêng, chỉ nghe loopback. Giữ terminal mở khi thử. Ctrl+C dừng demo. Mỗi lần chạy đều lấy mã nguồn mới và giữ dữ liệu đã tạo ở cùng cổng. Để dùng cổng trống khác:

```powershell
npm run demo:web -- --port 4112
```

Mặc định script theo dõi `web`, `src`, `dev.mjs`, `package.json` và hai helper `web-demo-client.js`, `web-demo-server.mjs`. Lưu HTML/CSS/JS/ảnh sẽ cập nhật bản demo; sửa backend sẽ tự khởi động lại backend thử. Tài khoản, phiên, ảnh tải lên, nháp, quà và các URL đã tạo không bị sao lại hay seed lại. File nguồn bị xóa cũng được gỡ khỏi bản mã demo. Nếu sửa chính launcher `web-demo.mjs` hoặc bộ đồng bộ `web-demo-sync.mjs`, hãy dừng rồi chạy lại lệnh demo.

Trang chủ, thư viện, chi tiết mẫu, bảng giá và giới thiệu tự tải lại sau cập nhật. Khi đang nhập vào ô hoặc mở preview, việc tải lại đợi tới lúc bạn rời ô/đóng preview. Các trang chỉnh thiệp, đăng nhập, quản trị và quà người nhận **không tự tải lại**; hãy lưu công việc rồi tải lại bằng trình duyệt. Tài nguyên demo dùng `no-store` để tránh giữ mã/ảnh cũ. Ứng dụng thông thường giữ chính sách cache hiện có.

Để tắt theo dõi file, dùng `npm run demo:web -- --no-watch`. Lần khởi động sau vẫn cập nhật mã mới. Chế độ `--prepare` chỉ chuẩn bị/kiểm tra rồi dừng, không theo dõi file. Thay đổi dependency trong `package.json` cần cài dependency trước; script không tự chạy cài đặt.

Khi dùng **Ports → Forwarded Address** của VS Code, cho phép URL HTTPS đầy đủ của cổng đó khi khởi động (thay URL ví dụ bên dưới bằng địa chỉ của bạn):

```powershell
npm run demo:web -- --port 4112 --allowed-origin "https://your-tunnel-4112.asse.devtunnels.ms"
```

Có thể lặp lại `--allowed-origin` cho nhiều URL hoặc đặt `ALLOWED_ORIGINS` trong môi trường. Server không tự tin `Host`/`X-Forwarded-Host` và không cho phép toàn bộ domain tunnel. Các URL khác vẫn bị chặn. Với ứng dụng thông thường, đặt `PUBLIC_BASE_URL` theo địa chỉ chia sẻ chính để các link quà tạo mới dùng đúng domain; `ALLOWED_ORIGINS` chỉ thêm địa chỉ được phép thao tác, không đổi link quà đã có.

`local/web-demo-<cổng>/tai-khoan-demo.json` chứa mật khẩu ngẫu nhiên. `trang-thai-demo.json` chứa URL của các bước. Khóa phiên, tài khoản, dữ liệu và ảnh được tạo trong profile riêng. Demo tắt merchant và OAuth.

| Vai trò | Email | Điểm vào |
| --- | --- | --- |
| Creator | `creator@momevia.test` | `/creator`. Nháp Một tuổi mới rực rỡ và V2 cần sửa |
| Admin | `admin@momevia.test` | `/admin`. Điều ước lúc hoàng hôn chờ duyệt và báo cáo Support |
| Sender | `sender@momevia.test` | `/studio`. Nháp sinh nhật, nháp mẫu có giá, quà có hồi đáp |
| Người nhận | Mở link ở hồ sơ riêng | `gift`, `invite`, `privateInvite`, `revoked`, `expired` trong tệp trạng thái |

Mỗi vai trò có thể dùng một hồ sơ trình duyệt riêng. Với nháp có giá, chọn **Xem như người nhận → Gửi → Cấp quyền dùng thử**. Quyền được cấp qua đơn `demo_paid`. Sau khi trở về cùng nháp, bấm gửi lại để chọn quyền và xuất bản.

CI dùng `npm run demo:web -- --port 4111 --prepare` để khởi tạo, xác minh các trạng thái bằng API rồi dừng. Các file sinh ra nằm trong thư mục được Git bỏ qua. [Kịch bản beta và ghi tay](SENDER_CREATOR_BETA.md)
