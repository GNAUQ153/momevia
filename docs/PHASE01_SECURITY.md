# Phase 1 — Security & Production Stability (24/11/2026)

Bản vá cho source 1.1.0, không đổi phiên bản phát hành, không có migration, không xóa dữ liệu hoặc thay đổi dependency. Chưa triển khai production. Không phải chứng nhận an toàn thông tin.

## Thay đổi

- Kiểm tra cấu hình production bằng `npm run check:production`: HTTPS origin, secret, storage MySQL, cờ demo, thông tin kết nối, data root và chế độ thanh toán. Startup production cảnh báo; `PRODUCTION_STRICT=true` mới từ chối khởi động nếu cấu hình chưa hợp lệ. Không in giá trị secret. Kiểm tra tĩnh không xác minh volume thật hoặc kết nối DB.
- Thiệp mới thiếu trường access mặc định chỉ Sender đọc phản hồi. Quyền thiệp cũ và lựa chọn chia sẻ công khai rõ ràng được giữ nguyên. Người nhận vẫn mở thiệp và gửi phản hồi không cần tài khoản.
- Chặn POST có Fetch Metadata cross-site nhưng thiếu Origin, chấp nhận Origin hợp lệ và giữ luồng webhook/CLI không có Fetch Metadata. Không mở rộng CORS hay tin IP tự khai.
- JSON kiểm tra media type chính xác; URL sai percent-encoding trả 400; bổ sung security header cho backend; trang `/g/` và `/success/` do Node phục vụ có noindex/no-store. Noindex không thay thế quyền truy cập.
- Xử lý lỗi stream ảnh legacy; đóng stream khi kết nối đóng.
- `MYSQL_CONNECTION_LIMIT` tùy chỉnh 1–20, mặc định 5 theo mỗi pool (không phải toàn bộ server). Không tự ý giảm trên production.

## Triển khai an toàn (Hostinger + Railway)

1. Tạo branch riêng, backup DB và thư mục media tại cùng mốc; kiểm tra restore ở môi trường riêng. Giữ nguyên tất cả secret hiện có (không rotate chỉ vì cập nhật source).
2. Kiểm tra các biến `*_STORAGE` đang dùng và dữ liệu thật trên Railway. Chỉ dùng MySQL khi dữ liệu đã chuyển đầy đủ; tuyệt đối không đổi flag để vượt preflight. Kiểm tra `MOMEVIA_DATA_DIR` đang chứa dữ liệu và volume đã mount đúng; nếu phải chuyển đường dẫn, dừng writer và sao chép/đối chiếu media trước. Việc đặt biến không tự tạo persistent volume. Không đặt giá trị mẫu vào môi trường thật.
3. Kiểm tra `NODE_ENV=production`, `PUBLIC_BASE_URL=https://momevia.io.vn`, `HOST=0.0.0.0` và Railway cung cấp `PORT`. Giữ topology/API proxy hiện tại nếu đang hoạt động; frontend gọi `/api` cùng origin. Không đổi sang API subdomain/CORS khi chưa xác minh proxy/cookie/OAuth callback.
4. Chạy `npm ci`, `npm run build`, `npm run check`, `npm test` và `npm run check:production` với cấu hình đích qua terminal an toàn. Không gửi nội dung .env hoặc secret qua chat. Sau khi preflight đạt và đã xác minh volume, bật `PRODUCTION_STRICT=true`. Nếu strict gây lỗi do cấu hình thực tế, sửa cấu hình đúng; không đổi kho dữ liệu tùy tiện. Không bật demo trên production.
5. Railway redeploy backend sau khi CI đạt. Hostinger chỉ cần cập nhật frontend nếu build/source frontend thay đổi; phase này không sửa frontend. Áp dụng header cho URL thiệp tại Hostinger, vì header Node không tự xuất hiện trên HTML do Hostinger phục vụ. Mẫu `deploy/hostinger/private-headers.conf` là đoạn tham khảo Apache/LiteSpeed, không ghi đè .htaccess hiện có; kiểm tra khả năng hỗ trợ mod_headers, mod_setenvif.
6. Smoke test: đăng nhập/đăng xuất, 401 khi không xác thực, 404 khi người khác đọc hộp thư của Sender, thiệp cũ mở được, tạo thiệp mới không truyền access, người nhận gửi lời đáp, chỉ Sender đọc được, tạo thiệp chọn public vẫn đọc được. Kiểm tra header và media sau redeploy; kiểm tra payOS/MoMo bằng môi trường test hợp lệ, không tự phát sinh giao dịch thật.
7. Nếu có lỗi, rollback commit/backend release và cấu hình đã xác minh. Không đổi data root, không downgrade DB, không xóa volume. Thiệp được tạo trong phase này giữ access đã ghi.

## Kiểm tra thực hiện trong môi trường bàn giao

- Node 22.16.0: 20/20 test mục tiêu (production config, permission, origin, parser, Router, MySQL pool, static headers).
- Lần chạy toàn bộ unit trước khi bổ sung 2 ca test cuối: 718 pass, 7 file test không load được do dependency thiếu; không có kết luận toàn bộ unit đạt. npm ci không hoàn tất trong thời gian chạy.
- CSS checker PASS: 9 file, 3099 declaration. i18n Designer/App Shell checker PASS (phạm vi công cụ có sẵn).
- Preflight khi chưa có .env: exit 1 đúng kỳ vọng. Test cấu hình hợp lệ giả lập đạt.
- Chưa chạy được build/check đầy đủ, browser/E2E, MySQL integration, npm audit trực tuyến, live payment, backup/restore và test production. Những việc này còn là release gate, không tuyên bố đã hoàn tất Phase 1.

## Còn lại

Xác minh reverse proxy và cookie/CORS thực tế, rate limit IP sau proxy Railway (không tin forwarded header mù quáng), TLS DB, volume/backup, secret scanning, dependency audit, upload và thanh toán end-to-end, Admin MFA, security headers Hostinger và production regression. Không triển khai thêm service ở phase này.
