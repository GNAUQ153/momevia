# Web demo Momevia

```powershell
npm ci
npm run demo:web
```

Mở [127.0.0.1:4110](http://127.0.0.1:4110). Lệnh build web và chạy một backend JSON riêng, chỉ nghe loopback. Giữ terminal mở khi thử. Ctrl+C dừng demo. Cùng cổng mở lại dữ liệu và bản mã đã sao lúc tạo profile. Để dựng từ mã nguồn mới hoặc dùng cổng trống khác:

```powershell
npm run demo:web -- --port 4112
```

`local/web-demo-<cổng>/tai-khoan-demo.json` chứa mật khẩu ngẫu nhiên. `trang-thai-demo.json` chứa URL của các bước. Khóa phiên, tài khoản, dữ liệu và ảnh được tạo trong profile riêng. Demo tắt merchant và OAuth.

| Vai trò | Email | Điểm vào |
| --- | --- | --- |
| Creator | `creator@momevia.test` | `/creator`. Nháp Một tuổi mới rực rỡ và V2 cần sửa |
| Admin | `admin@momevia.test` | `/admin`. Điều ước lúc hoàng hôn chờ duyệt và báo cáo Support |
| Sender | `sender@momevia.test` | `/studio`. Nháp sinh nhật, nháp mẫu có giá, quà có hồi đáp |
| Người nhận | Mở link ở hồ sơ riêng | `gift`, `invite`, `privateInvite`, `revoked`, `expired` trong tệp trạng thái |

Mỗi vai trò có thể dùng một hồ sơ trình duyệt riêng. Với nháp có giá, chọn **Xem như người nhận → Gửi → Cấp quyền dùng thử**. Quyền được cấp qua đơn `demo_paid`. Sau khi trở về cùng nháp, bấm gửi lại để chọn quyền và xuất bản.

CI dùng `npm run demo:web -- --port 4111 --prepare` để khởi tạo, xác minh các trạng thái bằng API rồi dừng. Các file sinh ra nằm trong thư mục được Git bỏ qua. [Kịch bản beta và ghi tay](SENDER_CREATOR_BETA.md)
