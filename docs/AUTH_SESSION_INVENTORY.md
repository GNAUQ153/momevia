# Auth V4D.3A — Danh sách phiên đăng nhập

Menu tài khoản (desktop/mobile) → Phiên đăng nhập (`/account-sessions`). `GET /api/auth/sessions` yêu cầu session hợp lệ, trả tối đa 50 bản ghi gồm `current`, `issuedAt`, `expiresAt`; `truncated` báo còn bản ghi, `unclassifiedCount` đếm bản ghi chưa hết hạn nhưng không có credential version. Không nhận userId, không trả JWT/JTI, credential version, IP hoặc User Agent. Ngày giờ hiển thị UTC. Đây không phải danh sách thiết bị hoặc trạng thái online.

## MySQL migration

Migration 020 bổ sung hai cột nullable và một index trong `sessions`. Không sửa 001–019, không backfill phiên lịch sử, không xóa session. Cần áp dụng migration trước khi khởi động backend mới, vì INSERT session mới sử dụng hai cột này. Kiểm tra schema staging, backup, cấu hình migration user, sau đó chạy `npm run db:migrate` với đúng database; không chạy vào production từ môi trường local nếu chưa chủ động chọn. Backend cũ vẫn có thể ghi session thiếu metadata; triển khai backend mới trước frontend. Không cần migration cho JSON local.

Phiên hiện tại có JWT hợp lệ và bản ghi tồn tại nên được hiển thị cả khi thiếu metadata; phiên khác chỉ được xác định còn hiệu lực nếu chưa hết hạn và credential version khớp tài khoản. Bản ghi cũ không có version được tính riêng, không tự gán version 0 hoặc suy diễn thời điểm cấp. Bản ghi nhập qua importer cũ cũng được coi là chưa phân loại. Phiên mới ghi version và thời điểm cấp từ server. Lịch sử đăng nhập không thuộc phạm vi. Danh sách là ảnh chụp tại thời điểm kiểm tra; request đồng thời thu hồi hoặc đổi mật khẩu có thể thay đổi kết quả sau khi đọc. Không tự động thu hồi hoặc thay đổi cookie.

## Kiểm thử và tích hợp

`node --test tests/unit/session-inventory.test.mjs tests/unit/mysql-identity-catalog.test.mjs tests/unit/mysql-migration-audit.test.mjs`

Bản vá Fix tích hợp trên source Working Tree được xuất tại commit 5081f74ff17bd9a2e2b0a1f5ba150b7bee1c92d7, đã có V4D.2B, V4D.1, V4C và OAuth consent. Giữ nguyên các thay đổi trước đó. Không áp dụng bản V4D.3A cũ cùng bản Fix. Kiểm tra `git apply --check` trước khi áp dụng; nếu khác baseline thì dừng. Bản xuất TXT không có đầy đủ các module shared và test local; chỉ nghiệm thu nhóm session inventory, MySQL mock và audit migration trên bản tái dựng. Kiểm thử MySQL thật, đăng nhập email/OAuth, cookie, 2 browser profile cùng tài khoản, tài khoản khác, reset/đổi mật khẩu, refresh, route guard, migration/rollback trên staging. Không tuyên bố đã nghiệm thu production.
