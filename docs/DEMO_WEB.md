# Web demo Momevia

```powershell
npm ci
npm run demo:web
```

Mở [localhost:4110](http://localhost:4110) hoặc [127.0.0.1:4110](http://127.0.0.1:4110). Cả hai địa chỉ hỗ trợ đăng nhập; cookie phiên riêng theo hostname nên cần đăng nhập lại khi đổi địa chỉ. Lệnh build web và chạy một backend JSON riêng, chỉ nghe loopback. Giữ terminal mở khi thử. Ctrl+C dừng demo. Cùng cổng mở lại dữ liệu và bản mã đã sao lúc tạo profile. Để dựng từ mã nguồn mới hoặc dùng cổng trống khác:

```powershell
npm run demo:web -- --port 4112
```

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
