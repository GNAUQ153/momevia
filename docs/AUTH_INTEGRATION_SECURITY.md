# Auth V5.1A — Nghiệm thu tích hợp và bảo mật

Baseline: gói `Momevia_Current_Full.tar.gz`, CHANGELOG ở V4D.3B, có migration 020 và các module Auth/Privacy trước đó.

## Kiểm soát cập nhật mật khẩu

- `CredentialsService.changePassword` nhận callback commit đã xác thực thay cho callback kiểm tra phiên rời rạc. Route truyền `sessions.mutateAuthenticated(token, update)`; không nhận định danh tài khoản đích từ client.
- JSON kiểm tra phiên và mutate đồng bộ trong một tiến trình. MySQL kiểm tra phiên dưới cùng transaction ghi user, khóa user rồi session như `revokeOne`/`revokeOthers`. Scrypt vẫn ngoài transaction. Nếu phiên đã bị thu hồi trước khi lấy khóa thì không được cập nhật; credential version đổi đồng thời cũng trả 401. Request đã hoàn tất trước thu hồi không bị đảo ngược.
- Form đổi mật khẩu khai báo `method="post"` để tránh đưa mật khẩu lên URL nếu listener không chạy. Không đổi chính sách mật khẩu hay phiên OAuth.

## Kiểm thử

`node --test tests/unit/auth-integration-security.test.mjs tests/unit/password-change.test.mjs tests/unit/session-security.test.mjs tests/unit/session-revocation.test.mjs tests/unit/session-inventory.test.mjs`

HTTP dùng cổng loopback ngẫu nhiên, JSON tạm và mail giả lập; không dùng `.env`, tài khoản thật hoặc production. MySQL được kiểm tra bằng mock thứ tự câu lệnh, không chứng minh hành vi lock thật trên nhiều kết nối. Không thay đổi schema, không cần migration ngoài 020 đã có.

Trước phát hành: chạy npm ci, build, check, npm test, browser E2E, MySQL staging (kiểm tra logout/đổi mật khẩu cạnh tranh hai kết nối), OAuth Google/Zalo và relay mail staging. Rate limiting hiện là theo tiến trình; chính sách consent vẫn dự thảo; chưa nghiệm thu production. Các test HTTP mới gọi Identity trực tiếp, chưa kiểm tra gateway, CSRF, TLS, cấu hình cookie hoặc Hostinger/Railway.
