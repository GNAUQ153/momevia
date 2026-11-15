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
| POST | `/auth/creator` | Login | Mở Creator local |
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
- Mặc định mọi POST yêu cầu `application/json` và kiểm tra Origin nếu browser gửi Origin.
- Trạng thái của đơn demo có tên `demo_paid` nhằm ngăn nhầm lẫn với một giao dịch thật.
