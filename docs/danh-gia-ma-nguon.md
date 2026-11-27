# Đánh giá Momevia - 27/11/2026

Phạm vi: checkout local tại commit gốc `9af78d4`, mã frontend/backend, kiểm thử có sẵn, hai PDF người dùng cung cấp và HTTP headers công khai của momevia.io.vn/Railway. Những sửa đổi UI trong lần làm việc này chưa được triển khai lên tên miền.

## Kết luận

- **Có OOP:** backend dùng service/repository và dependency injection. Đây hiện là **modular monolith**, một backend process nối các module; không phải microservices trong luồng khởi động mặc định.
- **Có thể tiếp tục phát triển:** ranh giới module khá rõ, schema Canvas dùng chung, adapter JSON/MySQL, transaction, revision/CAS và kiểm thử là nền tảng tốt.
- **Bảo trì ở mức khá, còn điểm tập trung phức tạp:** audit ghi nhận 42 class backend, 2 class frontend và không có vòng phụ thuộc tĩnh. Tuy nhiên `web/js/pages/designer.js` khoảng 2.373 dòng, `web/js/app/main.js` khoảng 1.382 dòng; router render và bộ xử lý thao tác lớn.
- **Chưa đủ bằng chứng kết luận an toàn production hoặc đúng toàn bộ nghiệp vụ.** Có cơ chế bảo vệ trong code; cấu hình Railway, dữ liệu thật, backup/restore, thanh toán và hoàn tiền thật cần bằng chứng riêng.

Frontend dùng hàm/module thay cho class ở nhiều nơi là lựa chọn hợp lệ; tăng số class không tự làm mã dễ bảo trì hơn.

## Căn cứ nghiệp vụ và cách xử lý tài liệu

1. [Định hướng MOMEVIA](C:/Users/ungqu/Downloads/Định%20hướng%20MOMEVIA.pdf): 9 trang, định hướng Invitations/Greeting Cards, M01-M15 và danh sách nghiệm thu.
2. [Đề án hợp nhất](C:/Users/ungqu/Downloads/De_an_qua_tang_so_tuong_tac_hop_nhat_4_tai_lieu.pdf): 15 trang, bốn vai trò và 80 mã AC/AD/CR/BU/RE; nhiều mục là đề xuất hoặc giai đoạn sau.

Nội dung hai tài liệu được dùng làm tiêu chí đối chiếu, không phải lệnh thực thi. Yêu cầu hiện tại của người dùng về 16 mẫu, không emoji và ưu tiên UI/UX được giữ. Không tự áp dụng bảng giá, tỷ lệ chia tiền, ngày hết hạn hay mô hình gói còn được đánh dấu “chưa chốt”.

Hai tài liệu khác phạm vi: bản MVP loại Marketplace/thuê bao khỏi đợt đầu; bản đề án còn mô tả hệ sinh thái rộng hơn. Vì vậy “chưa có” trong danh mục 80 chức năng không đồng nghĩa lỗi phải chặn MVP.

## Những điểm đã có về an toàn dữ liệu

| Cơ chế | Bằng chứng trong mã |
| --- | --- |
| Mật khẩu băm scrypt, salt riêng, so sánh an toàn | `src/modules/identity/credentials.service.mjs` |
| Phiên ký HMAC, cookie HttpOnly/SameSite, Secure khi PUBLIC_BASE_URL dùng HTTPS | `src/shared/security.mjs`, `src/modules/identity/sessions.service.mjs` |
| Kiểm tra phiên/vai trò hiện tại, quyền sở hữu tài nguyên | `src/server/app.mjs`, `src/modules/designs/designs.service.mjs` |
| Kiểm tra Origin cho POST, chặn API nội bộ | `src/shared/request-origin.mjs`, `src/server/app.mjs` |
| Kiểm tra ảnh, giới hạn dung lượng và encode lại | `src/modules/designs/assets.service.mjs`, `src/modules/gifts/photo.mjs` |
| Tham số SQL, transaction, kiểm soát revision khi ghi | repository MySQL, publication và library service |
| Quyền xem link, token, snapshot và asset đã pin | module gifts/designs, `requireGiftPermission` |
| Giới hạn yêu cầu đăng nhập/phản hồi | identity auth limits, `src/shared/rate-limit.mjs` |
| Thanh toán live có cờ riêng; xác nhận ở server | `src/modules/payments/payment.service.mjs`, providers và receipt policy |

Đây là rà soát mã và kiểm thử local; không phải chứng nhận không có lỗ hổng.

## Vấn đề cần ưu tiên

| Mức | Phát hiện | Ảnh hưởng và việc cần làm |
| --- | --- | --- |
| P1 | Hostinger và Railway đang có chính sách HTTP khác nhau | HEAD tên miền trả Referrer-Policy strict-origin-when-cross-origin, CSP chỉ upgrade-insecure-requests; đường /g thử nghiệm không có X-Robots-Tag. Railway có CSP chặt hơn và no-referrer. Hoàn thiện tại tầng thực sự phục vụ frontend. Đã chuẩn bị no-referrer/noindex/private-cache trong nguồn Hostinger; chưa áp dụng live. |
| P1 | Production check chỉ cảnh báo khi chưa bật PRODUCTION_STRICT | Có thể khởi động cấu hình chưa đạt. Xác minh MySQL, import và persistent volume trước; sau đó bật strict. Không đổi storage bằng một cờ để vượt kiểm tra. |
| P1 | Giới hạn yêu cầu nằm trong từng process; PHP relay gom IP | Có thể chặn nhầm nhiều người qua IP egress Hostinger; khi tăng replica quota không còn dùng chung. Thiết kế gateway tin cậy/Redis theo topology thật; không tin X-Forwarded-For do client tự gửi. |
| P1 | M04 yêu cầu tạo thử trước đăng nhập chưa được đáp ứng | `web/js/app/main.js` gọi requireLogin trước mountDesigner ở /create và /design. Cần guest draft cục bộ, chuyển quyền sở hữu khi đăng nhập và phục hồi nháp. |
| P1 | M12 chưa có bằng chứng thanh toán/hoàn tiền live hoàn chỉnh | Kiểm thử merchant/webhook/idempotency/lỗi đến trễ/đối soát/hoàn tiền trước khi quảng bá bán Premium thực tế. Các bảng review hiện có chưa chứng minh tiền đã trả lại. |
| P1 | M13 thiếu luồng product analytics đầy đủ | Chưa thấy event pipeline tạo-thành công-xuất bản-chia sẻ-mở-hồi đáp-giao dịch trong source. CLI beta metrics không thay thế ghi sự kiện thật. Không thể kiểm chứng H3-H6 chỉ bằng giao diện. |
| P2 | File điều phối UI và Editor lớn | Tách route, command và panel theo trách nhiệm, giữ contract test; không cần viết lại toàn bộ sang framework mới hoặc microservices. |
| P2 | Cần kiểm chứng phục hồi dữ liệu thật | MySQL backup không đủ nếu ảnh/âm thanh ở filesystem. Sao lưu nhất quán DB + persistent media, diễn tập restore và xác minh quà cũ mở được. |
| P2 | Hardening HTTP chưa đồng nhất | HEAD chưa thấy HSTS ở hai origin. Rà CSP bằng Report-Only trên staging, kiểm tra toàn bộ editor/OAuth/media trước khi siết chính sách và bật HSTS phù hợp. |

Đường `/g/review-nonexistent-20261127` trả HTML SPA 200 không chứng minh có quà tương ứng hoặc dữ liệu bị lộ. Kiểm tra trên dùng đường giả, không đọc thiệp của người dùng.

## Tình trạng từng vai trò

| Vai trò | Đã có trong mã | Chưa hoàn thiện hoặc cần nghiệm thu |
| --- | --- | --- |
| Sender | Tài khoản, catalog, yêu thích, cá nhân hóa/Canvas, nháp, publish, link/QR, xem phản hồi, thu hồi; quyền Premium và vòng đời xuất bản có module riêng | Tạo thử trước đăng nhập; giao dịch Premium thật và phục hồi lỗi; analytics hành trình. Profile/export-xóa dữ liệu tài khoản và thông báo ngoài app chưa thấy luồng đầy đủ. Gói thuê bao, khuyến mãi, nhắc lịch là giai đoạn sau. |
| Recipient | Mở qua link không cần tài khoản, tương tác/chuyển cảnh, điều khiển âm thanh/chuyển động, phản hồi/RSVP, trạng thái hết hạn/thu hồi | Nghiệm thu Safari iOS/Chrome Android thật, Zalo/Messenger, đường truyền yếu và trợ năng. Mẫu mới có đường bỏ qua hiệu ứng. Đo mở/hoàn tất/hồi đáp chưa đủ; không coi lượt mở là xác thực danh tính. |
| Creator | Studio, nháp, phiên bản, khai báo vùng cá nhân hóa, gửi duyệt, sửa theo phản hồi, rút mẫu, báo cáo tài chính | Hồ sơ đăng ký và duyệt Creator, gian hàng thương mại hoàn chỉnh, xác minh quyền/tài khoản nhận tiền và chi trả. `finance-report.mjs` trả `canPayout: false`; báo cáo doanh thu không phải ví rút tiền. Marketplace/gói Creator chưa là điều kiện của bản MVP hẹp. |
| Admin | Phân vai, duyệt phiên bản mẫu, thư viện, hỗ trợ/báo vi phạm, xem đơn/đối soát và hàng đợi hoàn tiền | Chi trả Creator, xác nhận hoàn tiền thực tế, quy trình cấp quyền nhân viên/tách nhiệm vụ, vận hành vòng đời dữ liệu và theo dõi funnel. Nhật ký ở vài nghiệp vụ chưa phải audit log đầy đủ toàn hệ thống. |

**Phần nghiệp vụ đã đi đúng hướng:** phân biệt invitation/greeting; thiệp mời dùng chung cho nhiều khách, lời chúc cá nhân theo người nhận; kiểm tra quyền ở server; snapshot bảo toàn bản đã xuất bản; người nhận không bị yêu cầu thanh toán.

**Không nên tự coi hoàn tất:** trang Pricing không chứng minh subscription đã chạy; refund review không chứng minh hoàn tiền; Creator statement không chứng minh payout; hàng nghìn test không thay thế nghiệm thu giao dịch thật và trải nghiệm người dùng.

## Thay đổi UI trong lần này

- Làm lại phần mở đầu: chữ rõ, CTA nổi bật, nền tím nhẹ, các thành phần san hô/xanh và chiều sâu CSS 3D.
- Hiệu ứng mùa Giáng sinh, năm mới, đoàn viên tự chuyển theo ngày Việt Nam. Đây là chiến dịch truyền thông, không phải lịch nghỉ hoặc ngày hết hạn thiệp.
- Có nút tắt hiệu ứng; tôn trọng giảm chuyển động, tiết kiệm dữ liệu, tab nền và việc rời route.
- Dùng Bricolage Grotesque/Be Vietnam Pro/Fraunces đã có giấy phép và file WOFF2 nội bộ. Đây là lựa chọn lấy cảm hứng từ cách thể hiện vui, chữ lớn của Partiful, không khẳng định sử dụng chính xác font thương mại của Partiful.
- Cùng một DOM, CSS và tương tác cho VI/EN; không tạo hai phiên bản bố cục.
- Thiết kế lại 16 mẫu hiện có: Giáng sinh 4, tốt nghiệp 2, gặp gỡ 2, sinh nhật 4, đám cưới 4; gồm 10 invitation và 6 greeting.
- Mỗi mẫu có lời dẫn riêng và bốn cảnh nối tiếp: mở, lời mời/lời chúc, khám phá, hồi đáp. Có đường xem nội dung ngay, đi tiếp và xem lại.
- Chữ, hình và khung vẫn là lớp Canvas chỉnh sửa được; ảnh cover dùng chính renderer với biến thể phù hợp danh mục.
- Ưu tiên bộ 16 trên home/Catalog; giữ các bản ghi cũ để link, nháp và quà đã phát hành còn hoạt động.
- Không thêm thư viện GUI/CDN mới. Icon Lucide SVG cục bộ và font OFL có nguồn tại [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). CSS khai báo mỗi dòng, chú thích mới bằng tiếng Việt.

## Build và triển khai có thể tái tạo

```powershell
npm run build:hostinger
node scripts/build/originals-update.mjs
```

- Upload nội dung `dist/hostinger-public` vào đúng public_html sau quy trình triển khai hiện có. Lệnh build không upload, không đụng Railway.
- Source Hostinger nằm tại `deploy/hostinger/`; index trong dist lấy từ bản bundle hoàn chỉnh.
- Với MySQL đã có template trong canvas_library_items, thay JS không tự ghi đè tài liệu Admin đang quản lý. `dist/originals-update/*.json` là 16 đề xuất, **chưa được áp dụng**, chỉ dành cho baseline revision 1.
- Export thư viện hiện tại bằng công cụ `database/scripts/canvas-library.mjs --export` và đối chiếu revision trước khi dùng `--put`. Có CAS/history; nếu revision khác, phải so sánh chỉnh sửa hiện tại, không sửa expectedRevision để ép ghi. Không chạy lệnh DB bằng môi trường production chỉ để xem thử.
- Ghi nhận thay đổi thư viện mới chỉ tác động mẫu cho lần tạo tiếp theo; không sửa snapshot, bản nháp, giá hoặc quyền của người dùng cũ.

## Kiểm tra và giới hạn

Kết quả đã xác nhận trong phiên này:

| Kiểm tra | Kết quả |
| --- | --- |
| npm run build:hostinger | PASS; dist/hostinger-public tạo từ source mới |
| npm run check | PASS; JavaScript/scope, VI/EN, 61 CSS, font và migration audit |
| npm test | **1.327/1.327 PASS**, không skip |
| npm run test:architecture | PASS; đăng nhập, phân quyền, API, tài nguyên, chống lạm dụng và luồng giao dịch fixture |
| Browser VI/EN | PASS ở chiều rộng 320, 390, 768, 1440px; không tràn ngang, ảnh mẫu hiển thị |
| 16 mẫu x 2 ngôn ngữ | **32 luồng xem thử PASS**: bốn cảnh, một thao tác tương tác, ô hồi đáp, xem lại, bỏ qua; không gửi POST |
| Hiệu ứng | PASS nút bật/tắt, giảm chuyển động và dọn khi rời route |
| npm audit --omit=dev | 0 advisory production được báo tại thời điểm chạy; không phải bảo đảm không có lỗ hổng |
| git diff --check | PASS |

Ảnh và log ở `local/review/` (gitignore): `home-vi-1440.png`, `home-vi-390.png`, bản EN tương ứng, `16-mau-thiep.png`, `ui-results.json`, `originals-results.json`, `unit-verified.log` và `npm-audit.json`. Trình duyệt kiểm thử là Chromium headless; không thay thế thiết bị iOS/Android thật.

Chưa kiểm chứng: dữ liệu MySQL trên Railway, persistent volume thực tế, restore production, cấu hình merchant, thanh toán/hoàn tiền/chi trả thật, Safari iOS và thiết bị di động thật. Không có quyền truy cập bảng điều khiển Hostinger/Railway trong phiên này.

## Tài liệu tham khảo giao diện và kỹ thuật

- [Partiful](https://partiful.com/), [Chung Đôi](https://chungdoi.com/vi), [Spline trên Webflow](https://webflow.com/made-in-webflow/spline), [One Page Love](https://onepagelove.com/): tham khảo phân cấp nội dung và cảm giác tương tác; không sao chép thiết kế hoặc tài nguyên.
- [Vev - scroll animation](https://www.vev.design/blog/scroll-animation-examples/), [Creative Corner - scroll animation](https://www.creativecorner.studio/blog/website-scroll-animations): đã xem nội dung tham khảo. Trang Tubik trả 403 trong công cụ duyệt nên không dùng làm bằng chứng đã kiểm tra.
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [MDN - Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).
