# HTTPS bằng chứng chỉ và chạy trên máy chủ riêng

Cloudflare Quick Tunnel đã được ngắt ngày 21/11/2026 theo yêu cầu. Lệnh `demo:https` đã chuyển sang HTTPS trực tiếp; không tạo tunnel, URL Internet hoặc kết nối Cloudflare.

## Kiểm tra tại máy phát triển

```powershell
npm run demo:https
```

Dùng lại cổng **4110**, giữ đúng profile cũ và loại kho dữ liệu đã cấu hình. Cổng 4100 không bị thay đổi. Lệnh dùng chứng chỉ thử trong `local/certificates`, có SAN `localhost` và `127.0.0.1`, hạn 30 ngày. Chứng chỉ tự ký **chưa được trình duyệt tin cậy**; có thể gặp cảnh báo. Không tự cài CA vào máy, không tắt xác minh TLS toàn cục, không công bố máy cá nhân ra Internet.

Mở `https://127.0.0.1:4110`. Đây là HTTPS cục bộ. `localhost` trên điện thoại là chính điện thoại; chưa có địa chỉ Internet để mở từ xa.

Có thể cấp cặp chứng chỉ riêng:

```powershell
npm run demo:https -- --cert "C:\certificates\fullchain.pem" --key "C:\certificates\privkey.pem"
```

Lệnh cần cổng demo chưa chạy hoặc PID thuộc đúng profile để chuyển chế độ. Ctrl+C dừng demo. Để chạy HTTP, dừng HTTPS rồi `npm run demo:web`.

Tạo chứng chỉ thử riêng bằng `npm run cert:local`; cần OpenSSL (Windows có thể dùng OpenSSL đi kèm Git hoặc chỉ định `OPENSSL_BIN`). Khóa được lưu trong `local/`, bị Git và gói phát hành loại trừ. Chứng chỉ thử hết hạn phải được tạo lại trong thư mục mới hoặc thay bằng chứng chỉ thật; script không ghi đè một cặp tệp còn thiếu/mất khớp.

## Máy chủ thật với tên miền riêng

Chưa cấp chứng chỉ công khai hoặc triển khai VPS vì hiện chưa có tên miền, IP máy chủ và quyền truy cập môi trường đích. Mua tên miền và cấp chứng chỉ là hai bước riêng với việc đưa ứng dụng lên máy chủ chạy liên tục.

Đã chuẩn bị `deploy/https/Caddyfile` và `deploy/https/momevia.service`. Mô hình là:

```text
Điện thoại → https://tên-miền-của-bạn:443 → Caddy trên VPS → Momevia 127.0.0.1:4100
```

Caddy xin và tự gia hạn chứng chỉ Let's Encrypt trên VPS, không cần tunnel hoặc máy cá nhân. HTTP cổng 80 tự chuyển sang HTTPS. [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https).

Khi đã có VPS Linux và tên miền:

1. Trỏ DNS A/AAAA vào IP của VPS; bản ghi AAAA chỉ dùng khi IPv6 thực sự tới đúng VPS. Cho phép cổng 80/443 tới Caddy. [Điều kiện cấp chứng chỉ](https://caddyserver.com/docs/quick-starts/reverse-proxy).
2. Đặt mã ứng dụng tại `/opt/momevia`, cài đúng Node trong `package.json`, `npm ci`, `npm run build`; chuẩn bị tài khoản hệ thống `momevia` và quyền ghi kho dữ liệu/ảnh. Sao lưu và chuyển dữ liệu qua quy trình đã kiểm chứng; cấu hình chứng chỉ không tự chuyển dữ liệu khỏi máy hiện tại.
3. Tạo `/etc/momevia/momevia.env` với quyền đọc giới hạn cho dịch vụ; đặt `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=4100`, `PUBLIC_BASE_URL=https://<tên-miền-thật>`, khóa phiên riêng bền vững và cấu hình kho dữ liệu đích. Tắt `DEMO_AUTH_ENABLED`, `DEMO_TEMPLATE_CHECKOUT_ENABLED`, `TEST_ACCOUNT_ENABLED`. Với TLS tại Caddy, để trống `HTTPS_CERT_FILE` và `HTTPS_KEY_FILE` trong ứng dụng.
4. Chỉnh đường dẫn Node/ứng dụng trong `momevia.service` cho khớp máy chủ. Cài service, bật khởi động cùng hệ thống và tự khởi động lại khi lỗi. Đây mới là cấu hình mẫu, chưa cài trên máy chủ nào.
5. Cài Caddy trên VPS. Đặt `MOMEVIA_DOMAIN` thành tên miền thật, `ACME_EMAIL` thành email quản lý trong môi trường của dịch vụ Caddy; dùng Caddyfile đã chuẩn bị. Kiểm `caddy validate --config /etc/caddy/Caddyfile` trước khi nạp. Giữ thư mục dữ liệu chứng chỉ Caddy bền vững và để dịch vụ tự gia hạn.
6. Xác minh qua domain: chứng chỉ được tin cậy, HTTP chuyển HTTPS, `/api/designs/health`, đăng nhập, link/QR và quà đã gửi. Chỉnh callback Google/Zalo theo domain thật nếu dùng OAuth.

## Nạp PEM trực tiếp, không dùng reverse proxy

Ứng dụng cũng hỗ trợ HTTPS trực tiếp bằng chứng chỉ đã được cấp:

```text
PUBLIC_BASE_URL=https://<domain>:<port>
HOST=0.0.0.0
PORT=<port>
HTTPS_CERT_FILE=/etc/momevia/tls/fullchain.pem
HTTPS_KEY_FILE=/etc/momevia/tls/privkey.pem
```

Chạy ứng dụng bằng `npm start` trên máy chủ. Cần cả hai tệp PEM; khóa phải khớp chứng chỉ. Thiếu/hỏng hoặc mất khớp thì khởi động thất bại, không tự hạ xuống HTTP. Link và cookie lấy từ `PUBLIC_BASE_URL`; cookie dùng `Secure`, `HttpOnly`, `SameSite=Lax`. Sau khi thay chứng chỉ, khởi động lại ứng dụng để nạp cặp tệp mới. Với dịch vụ công khai lâu dài, mẫu Caddy ở trên quản lý gia hạn và cổng 80/443 thuận tiện hơn.

## Bằng chứng trong lượt setup

- Đã dừng tiến trình cloudflared của Momevia, trạng thái tunnel cũ là `stopped`.
- Đã chạy HTTPS trực tiếp trên 4110 với chứng chỉ localhost; không đổi cổng 4100 và không tự cài chứng chỉ vào kho tin cậy hệ điều hành.
- `npm run test:https`: kiểm tra handshake bằng CA chỉ định, cookie Secure, origin lạ bị từ chối, lưu nháp/phát hành/link HTTPS/người nhận ẩn danh, từ chối chứng chỉ hoặc khóa sai, từ chối HTTP trên cổng HTTPS. Không dùng bỏ qua xác minh TLS.
- Caddyfile và systemd là cấu hình bàn giao cho VPS tương lai, chưa chạy với tên miền thật và chưa có chứng chỉ công khai được cấp.
