# Auth V5.2A — Production preflight (Hostinger + Railway)

## 1. Cấu hình tĩnh

Chạy `npm run check:production` trong môi trường cấu hình đích được kiểm soát. Nếu muốn nghiệm thu đầy đủ Google, Zalo và email recovery, chạy `npm run check:production -- --auth-ready`. Chế độ thường cho phép tắt hoàn toàn từng provider; chế độ `--auth-ready` yêu cầu cả ba. Lệnh không gọi provider, không kết nối DB, không in giá trị secret. Startup giữ nguyên chính sách warn/`PRODUCTION_STRICT`; không tự bật strict.

Với kiến trúc Hostinger `/api` relay sang Railway, dùng `PUBLIC_BASE_URL=https://momevia.io.vn`, `GOOGLE_CALLBACK_URL=https://momevia.io.vn/api/auth/google/callback`, `ZALO_CALLBACK_URL=https://momevia.io.vn/api/auth/zalo/callback`. Đăng ký đúng URI trong portal provider; không dùng URL Railway riêng cho callback khi cookie được cấp tại origin Hostinger. Cấu hình mỗi cặp ID/secret đầy đủ. Email relay cần URL HTTPS và token riêng; không gửi token qua chat, không ghi OTP vào log. Kiểm tra `ALLOWED_ORIGINS` chỉ chứa origin HTTPS thực sự cần thiết. Giữ nguyên JWT_SECRET và INTERNAL_SERVICE_KEY nếu chưa có kế hoạch rotation. Nếu hai biến được đổi, phiên hiện tại có thể mất hiệu lực.

## 2. Nghiệm thu local/staging trước release

- `npm run build && npm run check && npm test`; `npm run test:auth`; `npm run test:browser`. Không bỏ assertion khi test thất bại.
- Kiểm tra `npm run db:audit` offline. Trên DB đích đã xác nhận và có backup, chạy `npm run db:audit -- --live --require-latest --indexes --auth-schema` (chỉ đọc). `--auth-schema` kiểm tra marker 020, kiểu và null/default của hai cột cùng cấu trúc index chính xác; exit khác 0 nếu thiếu hoặc sai. Xem `AUTH_ACCEPTANCE.md` để nghiệm thu các hạng mục còn lại. Không tự thêm cột hoặc đánh dấu migration đã chạy nếu chưa xác minh schema.
- Nếu còn migration, thử trên staging và kiểm tra backup/restore trước khi chạy `npm run db:migrate` trên DB đích; không chạy migration chỉ để hết lỗi preflight. Không backfill credential version giả cho session cũ.
- Nghiệm thu HTTPS thực tế, cookie Secure/HttpOnly/SameSite, header no-store, Google/Zalo login + đăng ký mới với consent, OAuth callback đúng origin, logout, đổi/reset mật khẩu, xác minh email, thu hồi từng phiên, phân quyền. Dùng tài khoản QA và hộp thư kiểm thử; không thực hiện thanh toán thật.

## 3. Triển khai có kiểm soát

Backend mới cần schema 020 trước khi khởi động. Không đổi storage flag, volume hoặc secret để vượt kiểm tra. Sau CI và nghiệm thu staging, triển khai Railway rồi cập nhật gói Hostinger chứa `deploy/hostinger/api-relay.php` đã sửa. Kiểm tra bản relay thực tế chuyển tiếp `Origin`, `Sec-Fetch-Site`, Cookie, các Set-Cookie riêng và không follow OAuth redirect. Không tự tin vào X-Forwarded-For từ trình duyệt. Cả hai phía cần được cập nhật và kiểm tra; PHP lint không chứng minh relay production chạy đúng.

Chỉ bật `PRODUCTION_STRICT=true` sau khi preflight, DB/volume và provider đã xác minh. Nếu lỗi, rollback code/config đã biết tốt, giữ dữ liệu và migration additive; không downgrade DB hoặc xóa volume. Rate limiter hiện vẫn trong tiến trình; Hostinger relay có thể gom IP người dùng thành một IP egress. Theo dõi lỗi 429, không nâng giới hạn hoặc tin header IP mù quáng. Chính sách consent vẫn là draft; cần duyệt nội dung và quy trình xử lý thu hồi trước phát hành chính thức.

## 4. Phạm vi bằng chứng

Static preflight và unit test không chứng minh domain, TLS, provider approval, email delivery, schema production hay backup đã đạt. Không tự redeploy, bật strict, gọi provider hoặc thay đổi database bằng bản vá này.
