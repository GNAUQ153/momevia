# API Momevia

Các đường dẫn dưới đây tương đối với `/api` trên cùng origin với ứng dụng. Các cổng service riêng chỉ dùng cho topology legacy.

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
- POST JSON yêu cầu `application/json`; riêng canvas image upload dùng binary `image/png|image/jpeg|image/webp` với giới hạn 2 MiB và `X-Mutation-Id`. Mọi POST giữ kiểm tra Origin nếu browser gửi Origin.
- Trạng thái của đơn demo có tên `demo_paid` nhằm ngăn nhầm lẫn với một giao dịch thật.

## Canvas Sender và payment v1.1

Các path dưới đây tương đối với `/api`. Methods vẫn GET/POST; error mới giữ `error` legacy, thêm `code`, `message`, `details` an toàn. `409` giữ local, không tự ghi chồng revision. List trả metadata allowlist, không trả draft/snapshot/storage metadata riêng.

| Method | Endpoint | Quyền / body chính |
| --- | --- | --- |
| GET | `/designs/health` | Readiness/capability/profile, không secrets |
| GET | `/designs/designs?offset=0&limit=50` | Owner list; limit1–100, trả designs/nextOffset |
| POST | `/designs/designs` | Owner; source blank/template, presetId?, title?, mutationId UUID; source/version/policy do server xác lập; replay theo owner/key/hash |
| GET | `/designs/designs/:id` | Owner detail, revision/documentHash/document/policy UI |
| POST | `/designs/designs/:id/save` | Owner; expectedRevision, mutationId, title, document; ACK designId/mutationId/savedRevision/documentHash/replayed |
| POST | `/designs/designs/:id/duplicate` | Owner; mutationId, giữ nguồn/quyền, remap IDs/targets |
| POST | `/designs/designs/:id/archive` | Owner; tombstone, không xóa quà/ảnh đã pin |
| POST | `/designs/designs/:id/assets` | Owner; raw binary image + X-Mutation-Id; asset DTO ready, không path/base64 |
| GET | `/designs/designs/:id/assets/:assetId` | Owner private bytes; guest/B trả401/404 |
| POST | `/designs/designs/:id/preflight` | Owner; expectedRevision; allowed/needs_template_license/denied hoặc unavailable503, node blockers/hash; không charge/publish |
| POST | `/gifts/gifts/from-design` | Owner; designId/expectedRevision/expectedDocumentHash/idempotencyKey và access.open/send/read; 201 mới/200 replay, request khác cùng key trả 409 |
| GET | `/gifts/gifts/:slug/assets/:assetId` | Public gift pin + TTL; không login; không phải endpoint owner library |
| POST | `/checkout/payments/orders/:orderId/design-contexts` | Owner order/design; designId/expectedRevision/expectedDocumentHash/mutationId |
| GET | `/checkout/payments/orders/:orderId/design-contexts` | Owner list metadata, offset pagination; một order nhiều context |
| GET | `/checkout/payments/orders/:orderId/design-contexts/:contextId` | Owner context verified, resumePath nội bộ/currentRevision/changed |
| GET | `/checkout/payments/methods` | Public provider availability; profile demo có thể trả demoPurchaseAvailable |
| POST | `/checkout/payments/create` | Login, templateId/method; amount server; provider có điều kiện cấu hình |
| GET | `/checkout/payments/orders/:orderId` | Owner status server; không tin return/cancel URL |
| GET | `/checkout/payments/orders/:orderId/receipt` | Owner paid receipt; lỗi receipt không đổi paid status |
| POST | `/checkout/payments/webhooks/payos` hoặc `/momo` | Provider signature, giữ settlement/receipt foundation |

Document/schema v1 và canonical hash giữ array order, sắp xếp object keys; `sha256:` digest UTF-8. `expectedDocumentHash` chỉ là điều kiện so khớp, không cấp quyền. Quy tắc data/source/budget và rollout tại [CANVAS_SENDER_GUIDE](CANVAS_SENDER_GUIDE.md).

## Creator, Admin và quản lý quà

| Method | Endpoint | Quyền / mô tả |
| --- | --- | --- |
| GET/POST | `/catalog/creator/workspaces` | Creator; danh sách mẫu của mình hoặc tạo nháp với title, subtitle, mutationId |
| POST | `/catalog/creator/workspaces/:id/duplicate` | Creator sở hữu; mutationId |
| POST | `/catalog/creator/workspaces/:id/submit` | Creator sở hữu; expectedRevision, bindings, photoId, rights |
| POST | `/catalog/creator/workspaces/:id/withdraw` | Chủ mẫu hoặc Admin; dừng lượt dùng mới |
| GET | `/catalog/admin/version-queue` | Admin; danh sách phiên bản đang chờ |
| GET/POST | `/catalog/admin/templates/:id/versions/:version` | Admin; mở bản cố định hoặc gửi action approve/revise, reason và rightsConfirmed |
| GET | `/catalog/templates/:id/versions/:version` | Preview phiên bản đang được công khai |
| GET | `/gifts/gifts/:slug/status` | Người có quyền mở quà; 410 khi hết hạn hoặc thu hồi |
| GET | `/gifts/gifts/mine/:slug` và `/replies` | Chủ quà; link và hộp thư |
| POST | `/gifts/gifts/mine/:slug/revoke` | Chủ quà; thu hồi link, gọi lặp ổn định |
| POST | `/support/requests` | Báo cáo qua reportKind, reportId và invite nếu cần |
| GET | `/support/admin/requests` | Admin; xem trạng thái và người xử lý |
| POST | `/support/admin/requests/:id/resolve` | Admin; action claim hoặc resolve cùng resolution |

Quyền link mời được áp dụng cho quà, ảnh và hồi đáp. Creator/Admin xem ảnh demo theo phiên bản. Ảnh cá nhân của Sender dùng endpoint nháp riêng và chỉ xuất hiện trong quà được pin.
