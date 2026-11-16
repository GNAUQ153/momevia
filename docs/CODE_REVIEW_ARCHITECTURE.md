> **Lưu trữ lịch sử (16/11/2026):** Báo cáo này mô tả baseline sáu process **trước chuyển đổi v0.6.0**. Kiến trúc hiện tại là một backend process; xem [ARCHITECTURE.md](ARCHITECTURE.md).

﻿# Báo cáo đối chiếu bảo mật và kiến trúc Momevia

> Ngày cập nhật: 16/11/2026 · Phiên bản: v0.5.0 + thay đổi chưa phát hành.
> Phạm vi: mã nguồn và kiểm thử cô lập; không phải kết quả penetration test production.
> Quyết định triển khai: hoàn thiện CI và gói phát hành, chưa deploy hosting.

## 1. Phạm vi và nguồn bằng chứng

Đối chiếu toàn bộ nhận định SEC-01 đến SEC-08 trong báo cáo ban đầu với mã nguồn hiện tại trên nhánh `fix/architecture-review`. Bản gốc được giữ ngoài Git tại `local/archive/docs/` trên máy phát triển, không phân phối cùng source/gói phát hành. Các kết luận và code mẫu cũ không phải hướng dẫn áp dụng cho hiện tại; báo cáo này ghi lại nhận định đã hiệu chỉnh.

Các nguồn chính: `src/gateway/`, `src/bootstrap/`, `src/shared/`, `src/modules/{identity,catalog,checkout,gifts,support}/`, frontend QR/privacy, `tests/unit/` và `tests/integration/architecture.mjs`. Không đưa nội dung dữ liệu nghiệp vụ/.env thực vào fixture kiểm thử. Kiểm tra tính toàn vẹn dữ liệu local chỉ đọc bytes để tính hash, không ghi lại dữ liệu.

Không gán điểm CVSS khi chưa có vector và giả định môi trường đầy đủ. Không coi việc tham chiếu OWASP/ASVS là đã kiểm định đầy đủ các tiêu chuẩn đó. Các mã bên dưới dùng để theo dõi phát hiện, không phải điểm CVSS được chứng nhận.

## 2. Kiến trúc thực tế

Gateway và năm service Node.js chạy thành sáu process, bind loopback. Mỗi service sở hữu file JSON riêng. Gifts gọi Catalog và Checkout; Checkout gọi Catalog. Gateway chặn `/internal` sau khi kiểm tra segment mã hóa, bỏ header khóa dịch vụ do client gửi và ghi đè IP chuyển tiếp từ socket.

Identity hiện sở hữu thêm kho phiên `sessions.json`. Các service xác minh chữ ký JWT rồi hỏi Identity qua endpoint nội bộ để kiểm tra phiên còn hiệu lực và lấy role hiện tại. Đây là phụ thuộc runtime mới: không cache kết quả xác thực, Identity lỗi thì yêu cầu cần kiểm tra phiên trả `503` thay vì chấp nhận token chưa kiểm tra.

### Mô hình người dùng và vai trò
- `Customer` và `Sender` là một đối tượng duy nhất trong hệ thống (được định danh kỹ thuật bằng role `sender`).
- Mỗi tài khoản lưu một role trong ba giá trị `sender`, `creator`, `admin`. Sender/Creator không được tự đổi role hoặc đổi role tài khoản khác. Chỉ Admin được đổi role qua `POST /api/auth/admin/users/:id/role`; quyền được kiểm tra bằng role hiện tại trong Identity, không tin role cũ trên JWT hoặc role tự khai trong body đăng ký. Quy tắc này áp dụng cả production.
- Endpoint cũ `POST /api/auth/creator` đã chặn tự nâng quyền: chỉ Admin gọi được, phải chỉ định `userId` để cấp Creator cho tài khoản đích. Không cấp cookie của tài khoản đích cho Admin. Giao diện đã bỏ nút tự mở quyền Creator; quản lý role hiện qua API Admin, chưa có màn hình quản lý tài khoản.
- Khi Admin đổi role, phiên của tài khoản đích vẫn giữ nguyên danh tính; quyền mới được áp dụng ở request kiểm tra phiên tiếp theo, kể cả JWT còn chứa role cũ. Tài khoản đã được cấp Creator trước bản sửa không tự bị hạ quyền hàng loạt.
- Định hướng sản phẩm chưa triển khai, cần đặc tả riêng:
  - **Mẫu của Creator (Marketplace Template):** Được niêm yết bán, hưởng chia sẻ doanh thu (hoa hồng), qua kiểm duyệt của Admin, hiển thị trên thư viện chung.
  - **Mẫu của Customer (Personal Custom Card):** Dành riêng cho nhu cầu cá nhân gửi bạn bè/người thân; đề xuất giá mặc định 0đ, lưu riêng tư và không đưa lên sàn thương mại. Hiện chưa có loại mẫu cá nhân/thuộc tính visibility; giá 0đ của mẫu hiện tại không đồng nghĩa riêng tư.

Không có database ACID, HA, service discovery, thanh toán thật hoặc rate limit phân tán. Đây vẫn là MVP, chưa sẵn sàng vận hành thương mại.

## 3. Kết quả đối chiếu và xử lý

| Mã | Kết luận đã hiệu chỉnh | Thay đổi hiện tại | Giới hạn còn lại |
|---|---|---|---|
| SEC-01 | Limiter cũ chặn key mới khi hết chỗ; không đồng nghĩa chặn toàn bộ người dùng. Không dùng LRU xóa quota còn hiệu lực. | Bucket được ánh xạ vào tối đa 10.000 shard bằng HMAC có khóa ngẫu nhiên theo process. Không reset quota bằng thay danh tính; không có bước prune toàn bộ mỗi lần gặp key mới. Support/replies có thêm quota tổng. | Va chạm hash chia sẻ quota bảo thủ; lưu lượng đủ lớn vẫn có thể gây từ chối dịch vụ. Reset khi restart, không đồng bộ giữa process. |
| SEC-02 | Login/register thiếu bảo vệ là rủi ro thật. Demo-admin chỉ tồn tại khi demo bật và có mã, bị tắt ở production. | Hạn mức theo IP/email, quota tổng xác thực, `429` và `Retry-After`. Chỉ tối đa bốn scrypt đồng thời trong Identity, quá tải trả `503`. | Chưa CAPTCHA, WAF hoặc cơ chế chống credential stuffing phân tán. Hạn mức tính mọi lần thử, gồm thành công. |
| SEC-03 | Kịch bản hai request cùng process làm mất reply/order trong báo cáo cũ không đúng với đoạn đọc-sửa-ghi đồng bộ hiện tại. | Giữ mô hình writer hiện tại và kiểm thử ba reply đồng thời, 20 purchase đồng thời. Giữ double-check đăng ký sau scrypt. | Nhiều process/seed cùng ghi file vẫn không an toàn; gifts và replies chưa có transaction chung. |
| SEC-04 | Fallback secret là rủi ro; JWT mặc định còn có thể dẫn đến giả mạo role. Endpoint nội bộ chỉ đọc không tự cấp license, và loopback không mặc nhiên truy cập được từ container khác. | Mọi service gọi kiểm tra hai secret riêng, ít nhất 32 ký tự; production từ chối khóa mẫu. Chạy trực tiếp service cũng fail trước tạo repository khi thiếu khóa. Launcher chỉ tạo khóa tạm ngẫu nhiên khi thiếu trong môi trường không production. | Chưa secret manager, quy trình rotation/key-ring. Độ dài và chặn placeholder không chứng minh entropy của khóa tự nhập. |
| SEC-05 | Node có timeout mặc định; không cấu hình tường minh không có nghĩa không timeout. Các số RAM trong báo cáo cũ chưa được đo. | Gateway/service đặt headers 10 giây, request 30 giây, keep-alive 5 giây; upstream inactivity timeout 30 giây và hủy khi client ngắt. JSON từ chối body quá lớn và top-level không phải object; endpoint nhỏ dùng mức body thấp hơn. | Chưa load test/Slowloris test hoặc đo heap production. JSON parse và disk I/O vẫn có phần đồng bộ. |
| SEC-06 | Giữ nguyên ảnh có thể giữ EXIF; không phải ảnh điện thoại nào cũng có GPS. Hậu quả crash cụ thể chưa được tái hiện. | sharp kiểm tra định dạng thực, tối đa 2 MB/16 triệu pixel/cạnh 8192 pixel, từ chối ảnh động; encode lại và tự xoay ảnh, bỏ metadata. Tối đa hai tác vụ xử lý ảnh đồng thời. | Chỉ ảnh mới tải lên. Không tự thay hoặc xóa ảnh lịch sử; chưa có pipeline media tách riêng. |
| SEC-07 | JWT cũ không thể thu hồi khi logout là nhận định đúng. Chưa có chức năng đổi mật khẩu nên không mô tả đó là luồng hiện hữu. | JWT mới có `jti`; Identity chỉ chấp nhận phiên đã ghi nhận. Logout xóa phiên hiện tại, các service kiểm tra lại mỗi request; trạng thái thu hồi tồn tại qua restart Identity. JWT thiếu/hỏng exp hoặc thiếu jti bị từ chối. | JWT trước cập nhật cần đăng nhập lại. Chưa màn hình quản lý hoặc thu hồi toàn bộ phiên; chưa reset mật khẩu. Kho phiên vẫn là JSON. |
| SEC-08 | Bản cũ có bước người dùng đồng ý gửi link; không có bằng chứng khẳng định cách bên thứ ba lưu log. | Tạo QR ngay trong browser bằng qrcode-generator tự host, bỏ QR Server API khỏi luồng và CSP. Cập nhật nội dung quyền riêng tư. | Browser QA còn riêng; font và logo nhà cung cấp đăng nhập vẫn dùng tài nguyên mạng ngoài. |

### Hạn mức hiện tại theo process

- Login: 20 lần/IP/15 phút và 10 lần/email/15 phút.
- Register: 10 lần/IP/10 phút; demo-admin: 3 lần/IP/15 phút; demo: 20 lần/IP/10 phút.
- Tổng xác thực: 300 lần thử/phút. Mọi lần thử được tính; không gọi đây là số lần nhập sai.
- Replies: 3 lần/quà/IP/phút và 300 lần/phút toàn Gifts.
- Support: 5 lần/IP/10 phút và 60 lần/phút toàn Support.
- Tạo quà: 10 lần/tài khoản/10 phút để giới hạn ghi dữ liệu và xử lý ảnh.

Mỗi limiter dùng số shard hữu hạn; các danh tính va chạm có thể dùng chung quota. Quota tổng là chính sách quá tải có chủ ý, không phải cam kết mọi khách hợp lệ luôn được phục vụ. Chưa có số liệu tải thực tế để coi các ngưỡng này là tối ưu.

## 4. Các nhận định cần loại bỏ khỏi báo cáo ban đầu

1. Không áp dụng mẫu LRU: với hai bucket, chuỗi a → b → c → a có thể cấp lại quota cho a trong cùng cửa sổ sau khi bị đẩy khỏi Map.
2. Không gán lỗi mất cập nhật cùng process cho các thao tác JSON đồng bộ liên tục không có await. Phân biệt với crash giữa hai file và nhiều writer.
3. Không khẳng định socket tồn tại vô hạn do thiếu cấu hình timeout. Runtime Node 24.14.0 trước sửa có requestTimeout 300.000 ms, headersTimeout 60.000 ms, keepAliveTimeout 5.000 ms.
4. Không dùng các số 14 MB/request, 1,4 GB/100 ảnh hoặc 6,4 GB VRAM như kết quả đo. Đây chưa phải bằng chứng sử dụng tài nguyên của ứng dụng/browser thực tế.
5. Không đồng nhất môi trường local, container giả định và production. Không coi SSRF là lỗ hổng đã xác nhận khi chưa chỉ ra đường khai thác cụ thể.
6. Ma trận cũ dùng VULN-01…09 khác danh sách SEC-01…08. Điểm 8.8 không phải Critical và 4.3 không phải Low theo CVSS 3.1; bản hiện tại bỏ điểm số chưa có vector.

## 5. Kiểm thử và giới hạn chứng minh

### Unit và HTTP cô lập

- Kiểm tra secret và service chạy trực tiếp thiếu secret.
- Đăng ký đồng thời cùng email chỉ tạo một tài khoản; giới hạn scrypt không tạo hàng đợi không giới hạn.
- Quota theo cửa sổ, giới hạn bộ nhớ shard và không reset quota khi va chạm.
- JWT xác minh, thu hồi một phiên không thu hồi phiên khác; role được đọc lại từ Identity.
- Sender/Creator không tự đổi role hoặc đổi role người khác; Admin đổi role hợp lệ, không nhận phiên của tài khoản đích. Token Creator/Admin cũ mất quyền sau khi bị hạ role; kiểm thử lại sau restart Identity với NODE_ENV=production.
- HTTP parser kiểm tra kiểu/bytes, server đặt timeout tường minh.
- Ảnh hợp lệ được bỏ EXIF, chặn định dạng giả/pixel flood/file hỏng/dung lượng lớn.
- QR được decode lại đúng link gốc bằng jsQR, không cần gọi dịch vụ QR.
- Bộ HTTP chạy sáu process trên cổng riêng, bỏ .env/data nguồn; kiểm tra Gateway, IP spoofing, đăng ký đồng thời, ảnh, bốn smoke suite, ba reply và 20 purchase đồng thời.
- HTTP xác minh login/register/demo-admin bị giới hạn; đổi X-Forwarded-For không vượt quota.
- Sau logout, replay token bị từ chối ở Gifts/Catalog/Checkout/Support; sau restart Identity vẫn bị từ chối; Identity tắt thì API cần kiểm tra phiên trả 503.

Các kiểm tra này chưa chứng minh an toàn nhiều writer, crash consistency, DDoS resistance, OAuth thật hoặc khả năng vận hành production. Browser regression có phạm vi riêng bên dưới; không suy rộng thành QA toàn bộ trình duyệt/màn hình.

### CI và gói phát hành

Workflow kiểm tra Node 22/24 trên Windows/Linux. Sau toàn bộ ma trận đạt, trên main tạo gói nguồn có manifest SHA-256, cài dependency và chạy lại kiểm thử trên bản đóng gói, rồi upload artifact. Loại trừ .env thật, data, node_modules và file tạm. Không deploy hosting theo lựa chọn hiện tại. Xem [CI_RELEASE.md](CI_RELEASE.md).

Chỉ gọi GitHub CI/nhánh bảo vệ/hosting là đã hoạt động sau khi có bằng chứng thực tế từ GitHub/môi trường đích; sửa workflow trong working tree không tương đương một lần chạy CI thành công.

## 6. Công việc kiến trúc còn lại trước production

### Bằng chứng local ngày 16/11/2026

- Windows / Node 24.14.0: 46/46 unit tests PASS; HTTP regression và bốn smoke suite PASS sau refactor, gồm Admin-only đổi role, JWT cũ sau hạ role, view modules và OAuth state/PKCE nội bộ.
- Windows / Node 22.23.5: 46/46 unit tests PASS, HTTP regression và bốn smoke suite PASS sau refactor; không đại diện cho runner Linux.
- Bản đóng gói: cài mới bằng npm ci, kiểm tra cú pháp/YAML, unit tests và HTTP regression trước khi nén.
- actionlint 1.7.12 kiểm tra workflow, không có lỗi; npm audit runtime không phát hiện lỗ hổng tại thời điểm kiểm tra.
- Browser thật: Playwright/Edge trên Windows, đăng ký/đăng nhập, thư viện/yêu thích, Sender không có form Creator, xuất bản quà và QR cục bộ PASS trên fixture; không có lỗi JavaScript/tài nguyên HTTP nội bộ. Có kiểm tra screenshot QR ở viewport 390px. Không kiểm chứng OAuth, font/logo mạng ngoài hoặc toàn bộ responsive.
- GitHub Actions/runner Linux/upload artifact: chưa chạy trên GitHub. Linux/Node 24 đã cấu hình browser gate, chưa có bằng chứng chạy từ GitHub. OAuth thật/load test: chưa chạy.
- Bảy file dữ liệu local trước/sau refactor có cùng SHA-256. Không di chuyển hoặc ghi lại dữ liệu.

### Phạm vi sắp xếp mã và đồ thị

Đã chuyển logic vào `src/modules`, tách route/service/repository/app/client và adapter media. Gateway và phần dùng chung tách riêng. Frontend tách app/core/pages/ui/features; test và script phân nhóm. Entry point/URL cũ giữ tương thích. Xem [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

Đồ thị AST code-only được xây trước/sau tại `local/graphify-before` và `local/graphify-after`, không dùng LLM semantic (0 token), bỏ data/.env/dependency/assets/vendor. Graphify có cảnh báo một cạnh dangling, self-loop và cạnh cùng endpoint bị gộp, cùng một số file không có symbol được mô hình hóa; đồ thị chỉ dùng điều hướng. Nhận định được đối chiếu trực tiếp source và kiểm thử, không dùng graph làm bằng chứng độc lập.

Mô hình chạy vẫn sáu process; JSON storage vẫn giữ. [ARCHITECTURE_OPTIONS.md](ARCHITECTURE_OPTIONS.md) đề xuất modular monolith và đánh giá DB, chưa phải thay topology/migrate đã thực hiện.

### Hạng mục còn lại

- Chọn database và migration có kế hoạch backup/restore; unique constraint email, idempotency đơn hàng và transaction cho reply/counter. Chưa tự chọn hoặc chạy migration trong đợt này.
- Mỗi service hiện chỉ được có một writer JSON; không chạy seed cùng ứng dụng, không scale nhiều instance chung file. Atomic rename không thay transaction nhiều file.
- Đo tải và độ trễ event loop: JSON đọc/ghi toàn file, endpoint trả danh sách chưa có pagination backend và chưa có quota dung lượng dữ liệu tổng.
- Thiết kế session service có HA và lưu trữ phù hợp: Identity đơn tiến trình hiện là điểm lỗi đơn của các API cần kiểm tra phiên. Đã thử lại: Identity dừng thì các API đó trả 503, sau restart phiên đã logout vẫn bị từ chối và role hiện tại vẫn có hiệu lực. Chưa có load test để định lượng điểm nghẽn hiệu năng. Đánh giá session store dùng chung (ví dụ Redis) và phương án giảm phụ thuộc introspection bằng số đo; không mặc định phải dùng Redis Cluster hoặc khẳng định triệt tiêu độ trễ. Chỉ thay JSON bằng Redis vẫn giữ HTTP nếu không đổi luồng gọi. Nếu dùng blacklist hoặc cache phải giữ yêu cầu thu hồi phiên, cập nhật role/trạng thái tài khoản, và xác định hành vi khi store/failover lỗi. Đợt này chưa cài hay benchmark Redis.
- Thiết kế trust chain khi thêm reverse proxy: Gateway hiện dùng socket IP trực tiếp, cần bổ sung cấu hình danh sách proxy tin cậy (Trusted Proxies CIDR) khi đặt sau Cloudflare/Nginx/AWS ALB để trích xuất đúng IP người dùng cuối, tránh gom mọi client vào IP của proxy.
- TTL theo mẫu (`validityDays`) và dọn ảnh hết hạn là backlog chưa triển khai. Hiện GIFT_TTL_DAYS áp dụng chung khi ghi expiresAt; hết hạn trả 410, không tự xóa ảnh. Trước triển khai cần chốt mốc bắt đầu tính hạn, ảnh hưởng khi sửa thời hạn mẫu, chính sách giữ kỷ niệm/ảnh và dữ liệu đã phát hành. Không thay thời hạn hay xóa ảnh lịch sử trong đợt sửa này.
- License theo lượt phát hành (Credit/Token) là đề xuất nghiệp vụ cần chốt và đặc tả trước triển khai. Hiện quyền mua demo theo user/template được dùng lại, không trừ lượt; vẫn có quota kỹ thuật tạo quà 10 lần/tài khoản/10 phút. Cần xác định cách trừ/hoàn lượt khi thất bại, idempotency và xử lý quyền của đơn cũ. Không tự chuyển giấy phép cũ sang credit.
- Secret manager/rotation, HTTPS, monitoring, audit log, backup và diễn tập khôi phục.
- Thanh toán thật, webhook được xác minh/idempotency, OAuth thật, xác minh email và reset mật khẩu.
- Browser QA desktop/mobile, accessibility và kiểm thử tải/bảo mật theo môi trường triển khai.

## 7. Tài liệu đối chiếu

- [Node.js HTTP timeout](https://nodejs.org/api/http.html#serverrequesttimeout)
- [FIRST CVSS 3.1](https://www.first.org/cvss/v3.1/specification-document)
- [sharp constructor và limitInputPixels](https://sharp.pixelplumbing.com/api-constructor/)
- [sharp output và metadata](https://sharp.pixelplumbing.com/api-output/)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
- [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)
- [Redis latency và chi phí giao tiếp](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/)
