# Danh sách API MVP (qua Gateway `http://localhost:4100/api`)

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/auth/providers` | Public | Trạng thái cấu hình OAuth |
| GET | `/auth/me` | Public | Người dùng hiện tại hoặc null |
| POST | `/auth/register` | Public | Đăng ký email: `name`,`email`,`password`,`confirmPassword`; 201 + session |
| POST | `/auth/login` | Public | Đăng nhập email: `email`,`password`; 200 + session |
| POST | `/auth/demo` | Dev only | Đăng nhập demo; body: `name`, `deviceId` |
| POST | `/auth/demo-admin` | Dev only | Admin demo; body: `code` |
| POST | `/auth/logout` | Login optional | Xóa cookie |
| POST | `/auth/creator` | Admin | Cấp Creator cho tài khoản đích, body `userId`; chặn tự nâng role |
| GET | `/auth/admin/users` | Admin | Danh sách tài khoản công khai, không trả passwordHash |
| POST | `/auth/admin/users/:id/role` | Admin | Đổi role tài khoản đích: `sender`, `creator` hoặc `admin` |
| GET | `/auth/google` | Public | Chuyển hướng OAuth Google |
| GET | `/auth/google/callback` | OAuth callback | Đổi authorization code |
| GET | `/auth/zalo` | Public | Chuyển hướng OAuth Zalo v4 |
| GET | `/auth/zalo/callback` | OAuth callback | Đổi code với PKCE |
| GET | `/catalog/templates` | Public | Danh sách đã duyệt; query `q`,`style` |
| GET | `/catalog/templates/:id` | Public | Chi tiết mẫu |
| GET | `/catalog/creator/templates` | Creator | Mẫu của chính mình |
| POST | `/catalog/creator/templates` | Creator | Gửi mẫu: `title`,`subtitle`,`theme`,`price` |
| GET | `/catalog/admin/pending` | Admin | Mẫu chờ duyệt |
| POST | `/catalog/admin/templates/:id/approve` | Admin | Duyệt mẫu |
| POST | `/catalog/admin/templates/:id/reject` | Admin | Từ chối (body `reason`) |
| GET | `/checkout/orders` | Login | Danh sách đơn demo của bản thân |
| POST | `/checkout/orders/demo-purchase` | Dev login | Mua mẫu demo; body `templateId` |
| GET | `/gifts/gifts/mine` | Login | Món quà của bản thân |
| POST | `/gifts/gifts` | Login | Tạo quà: `templateId`,`recipientName`,`senderName`,`message`,`photoDataUrl?` |
| GET | `/gifts/gifts/:slug` | Public with secret slug | Xem quà |
| GET | `/gifts/gifts/:slug/photo` | Public with secret slug | Ảnh của quà |
| GET | `/gifts/gifts/:slug/replies` | Public with secret slug | Danh sách hồi đáp |
| POST | `/gifts/gifts/:slug/replies` | Public with secret slug | Gửi phản hồi: `name?`,`message` |

- Endpoint `/internal/...` chỉ được gọi từ service cùng máy kèm header `x-service-key`, không được proxy từ Gateway.
- Gateway chặn namespace nội bộ và bỏ `x-service-key` do client cung cấp trước khi proxy API công khai.
- Gateway ghi đè `X-Forwarded-For` bằng IP socket; Gifts/Support chỉ nhận một IP hợp lệ từ proxy loopback. Nếu thêm reverse proxy phía trước Gateway, cần cấu hình trust chain riêng để giữ IP người dùng cuối.
- Hạn mức theo tiến trình: 3 replies/quà/IP/phút, 5 phiếu hỗ trợ/IP/10 phút; tổng 300 replies/phút và 60 phiếu hỗ trợ/phút. Limiter dùng tối đa 10.000 shard hash có khóa, va chạm chia sẻ quota bảo thủ; không dùng LRU xóa quota còn hiệu lực. Đây không phải limiter phân tán.
- Xác thực: login 20 lần/IP/15 phút và 10 lần/email/15 phút; register 10 lần/IP/10 phút; demo-admin 3 lần/IP/15 phút khi demo được bật; demo 20 lần/IP/10 phút. Tổng 300 lần thử/phút/process; tính mọi lần thử, không riêng lần sai. Trả `429` và `Retry-After` khi vượt giới hạn.
- `POST /api/auth/logout` thu hồi phiên hiện tại tại Identity; token đã thu hồi không gọi được API cần đăng nhập ở service khác. Phiên khác trên cùng tài khoản vẫn còn hiệu lực. JWT cũ chưa được ghi nhận trong kho phiên yêu cầu đăng nhập lại.
- `POST /internal/session` chỉ cho service dùng khóa nội bộ; Gateway chặn namespace này. Trả trạng thái phiên cùng role hiện tại từ Identity, không sử dụng role JWT cũ làm nguồn quyết định duy nhất.
- Mỗi tài khoản chỉ lưu một role. Sender/Creator không được tự đổi role hoặc đổi role người khác; đăng ký không nhận role do client tự khai. Admin đổi role cho tài khoản đích không nhận cookie/phiên của người đó. Role mới được áp dụng khi request tiếp theo kiểm tra phiên; token mang role cũ không giữ lại đặc quyền đã bị thu hồi. Admin có thể đổi role của chính mình và sẽ mất quyền Admin nếu tự hạ role.
- Mặc định mọi POST yêu cầu `application/json` và kiểm tra Origin nếu browser gửi Origin.
- Trạng thái của đơn demo có tên `demo_paid` nhằm ngăn nhầm lẫn với một giao dịch thật.
