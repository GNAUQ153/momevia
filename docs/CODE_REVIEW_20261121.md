# Momevia — Kiểm toán source, nghiệp vụ, bảo mật và UI/UX

**Ngày đánh giá:** 21/11/2026
**Baseline:** `Momevia_Main_Latest_20261121.zip` do nhóm cung cấp (808 mục, có PR #18 trong README).
**Phương pháp:** đọc mã nguồn và tài liệu, rà cấu hình/API, kiểm thử unit có thể chạy độc lập; không phải pentest, không có dữ liệu giao dịch production hoặc đo hiệu năng thiết bị thật.

## 1. Tóm tắt điều hành

- **Có OOP thực tế**, dùng `class` và dependency injection cho service/repository/router, kết hợp các pure functions và ES Modules. Đây là cấu trúc _hybrid OOP + functional_ trong **Modular Monolith**, không cần chuyển Microservices.
- **Khả năng bảo trì khá tốt ở backend**, nhờ module theo nghiệp vụ và tách repository. **Frontend còn nợ kỹ thuật**: `web/js/pages/designer.js` ~2.741 dòng, `web/js/app/main.js` ~1.616 dòng và nhiều stylesheet có khai báo compact nhiều thuộc tính/một dòng.
- **An ninh thông tin có nhiều kiểm soát sẵn**, nhưng chưa đủ chứng cứ chứng nhận sẵn sàng production. Chức năng thanh toán/hoàn tiền/chi trả cần kiểm tra nghiệp vụ và bảo mật theo quy trình riêng.
- **Nghiệp vụ MVP chính đã có** (Sender tạo/chia sẻ, Recipient mở/đáp, Creator tạo mẫu/đợi duyệt, Admin duyệt/hỗ trợ). **Marketplace và tài chính vẫn Beta**: hoàn tiền thật, đối soát/chi trả Creator, subscription chưa hoàn chỉnh.
- **Giao diện đã có 3D CSS/animation**, không cần phụ thuộc WebGL ngay. Lỗi nhất quán font thực tế: trang chủ không gọi `loadAppFonts()` trong lộ trình trước đó, nên Plus Jakarta Sans/Inter có thể chỉ hiện bằng fallback; `font-serif` dùng tên tùy biến `Momevia Lora`. Bản nâng cấp này xử lý các vấn đề đó.

## 2. OOP / kiến trúc — dẫn chiếu trực tiếp

| Trách nhiệm             | Bằng chứng mã nguồn                                                                                                                | Đánh giá                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Khởi tạo module (DI)    | `src/server/app.mjs`, `src/modules/*/app.mjs`                                                                                      | Tốt: khởi tạo phụ thuộc cụ thể và module độc lập theo nghiệp vụ                |
| Abstraction lớp dịch vụ | `src/modules/catalog/catalog.service.mjs`, `src/modules/checkout/checkout.service.mjs`, `src/modules/payments/payment.service.mjs` | Có class, constructor và service operation                                     |
| Data access abstraction | `src/shared/storage.mjs`, `src/modules/checkout/mysql.repository.mjs` và các repository JSON/MySQL                                 | Tốt nhưng cần integration test bảo đảm hai adapter cùng hợp đồng               |
| Shared HTTP             | `src/shared/http.mjs` (`Router`, `HttpError`, `parseJson`)                                                                         | Có lớp và xử lý lỗi; các route nên tiếp tục chia theo use case                 |
| Canvas schema           | `web/js/shared/canvas/schema.js` cùng module renderer/editor                                                                       | Tương đối tách biệt, cần giữ backward compatibility với nội dung đã xuất bản   |
| Frontend UI             | `web/js/app/main.js`, `web/js/pages/designer.js`                                                                                   | Kích thước lớn, điều phối nhiều luồng, nên tách từng chức năng và test hồi quy |

**Không nên đánh giá OOP bằng số lượng class.** Mã ES Modules và pure functions phù hợp hơn ở nhiều lớp kiểm tra dữ liệu/format/UI. Giữ modular monolith và tiến hành refactor có kiểm chứng thay vì viết lại.

## 3. Bảo mật — kiểm soát đã thấy

- **Mật khẩu:** `src/modules/identity/credentials.service.mjs` dùng `scrypt` với salt ngẫu nhiên, so sánh bằng `timingSafeEqual`.
- **Session:** `src/shared/security.mjs` ký token HS256 HMAC; `src/modules/identity/sessions.service.mjs` có lưu/thu hồi phiên, kiểm tra `credentialVersion` khi tài khoản đổi mật khẩu.
- **Cookie:** `HttpOnly`, `SameSite=Lax`; `Secure` phụ thuộc `PUBLIC_BASE_URL` HTTPS — cần cấu hình chính xác sau reverse proxy.
- **Nguồn request:** `src/server/app.mjs` kiểm tra Origin đối với POST, từ chối `/internal` qua public API và không tin các forwarded header từ client.
- **HTTP headers:** `src/gateway/static.mjs` có CSP, `nosniff`, frame guard và referrer policy; CSP đã cho phép Google Fonts ở `fonts.googleapis.com` và `fonts.gstatic.com`.
- **Quyền:** role/owner được xác nhận từ server session, ví dụ Creator template, Admin financial report, Buyer refund. Không có căn cứ cho thấy role client có thể trực tiếp cấp quyền.
- **Thanh toán:** `src/modules/payments/providers.mjs` xử lý chữ ký nhà cung cấp, `payment.service.mjs` không công nhận callback redirect trình duyệt là bằng chứng thanh toán; repository có kiểm soát chống webhook lặp.

### Rủi ro/chưa xác minh, xếp theo ưu tiên

| Ưu tiên                             | Vấn đề                                                                                   | Việc cần làm                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **P0 trước live payment**           | Chưa có kiểm chứng đầy đủ hoàn tiền thực tế và bút toán đảo/chi trả Creator              | Xây state machine riêng, audit ledger bất biến, kiểm thử idempotency, race, dispute và webhook từ provider          |
| **P0 trước production đa instance** | JSON storage mặc định và limiter trong bộ nhớ tiến trình (`src/shared/rate-limit.mjs`)   | MySQL/Redis hoặc rate-limit ở gateway, backup + diễn tập restore, không chạy nhiều writer trên JSON                 |
| **P0 tại production**               | Cấu hình `PUBLIC_BASE_URL`, TLS, origin allowlist và bí mật runtime                      | Kiểm tra cookie `Secure`, secret rotation, webhook HTTPS thật, bảo vệ log và secrets trên hosting                   |
| **P1**                              | Kiểm thử IDOR/BOLA theo chủ sở hữu mọi endpoint, XSS cho rich templates, media isolation | Chạy bộ test động trên staging bằng user khác vai trò, fuzz URL, kiểm tra nội dung HTML/SVG được nhập từ người dùng |
| **P1**                              | Quyền riêng tư và giữ dữ liệu (gift/reply/image)                                         | Chính sách retention rõ ràng, cơ chế xóa/xuất dữ liệu, backup expiry và giới hạn truy cập link được chuyển tiếp     |
| **P1**                              | Google Fonts tải từ máy chủ ngoài                                                        | Thông báo quyền riêng tư và lựa chọn self-host khi tổ chức yêu cầu không phụ thuộc CDN; font fallback đã có         |
| **P2**                              | Phân tích dependency, observability và security review                                   | Duy trì `npm audit`/SBOM, audit log tập trung, monitoring và kiểm tra phục hồi định kỳ                              |

Các mục trên là **rủi ro hoặc điều kiện triển khai cần xác minh**, không đồng nghĩa đã tìm thấy lỗ hổng có thể khai thác.

## 4. Mức hoàn thiện nghiệp vụ theo vai trò

| Vai trò       | Đã có trong source                                                                                        | Còn thiếu/chưa đủ chứng cứ hoàn thiện                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Sender**    | Xác thực, xem mẫu, yêu thích, chỉnh thiệp, lưu nháp, phát hành, chia sẻ liên kết/QR, quản lý quà/phản hồi | Hoàn thiện full payment retry/cancel/refund trên merchant thật, xử lý lỗi thiết bị offline và chính sách lưu trữ quà          |
| **Creator**   | Canvas template/draft, phiên bản, gửi duyệt, sửa sau phản hồi, quản lý mẫu, báo cáo giao dịch chỉ đọc     | Giá và hoa hồng có thể cấu hình, số dư khả dụng, đối soát đối tác, yêu cầu chi trả/rút tiền và các tình huống hoàn trả        |
| **Admin**     | Duyệt mẫu, role, support/content moderation, payment audit, refund-review queue và CSV                    | Hoàn tiền thực tế có xác minh, đối soát cuối kỳ, ledger bút toán đảo, phân quyền tài chính nhiều cấp và chi trả Creator       |
| **Recipient** | Mở quà theo link, tương tác Canvas/legacy, phản hồi theo quyền và tương tác nhiều cảnh                    | Kiểm chứng trên mạng yếu/mobile đời cũ, chính sách quyền riêng tư và thời hạn lưu giữ, tính nhất quán đa ngôn ngữ cho mọi mẫu |

**Phân định nghiệp vụ:** Refund Review hiện là quy trình **tiếp nhận/duyệt nội bộ**, không phải tiền đã được hoàn. Pricing là giao diện giới thiệu, không chứng minh đã có subscription định kỳ. Không nên marketing chức năng tài chính này như tính năng đã sẵn sàng thanh toán thật.

**Luồng chính phù hợp:** Create → Share → Open → Reply → Keep. Cần thêm acceptance criteria có thể đo cho từng chặng và kiểm tra demo bằng đủ 4 vai trò.

## 5. UI/UX — yêu cầu và thay đổi đợt này

### Các lỗi/thực trạng quan sát được

- `web/css/tokens.css` đã khai báo `Plus Jakarta Sans` và `Inter`, nhưng trang chủ không gọi nạp stylesheet font trước khi rendering trong luồng JS cũ; trang khác nạp trễ với `display=optional`.
- Font serif trước đây là tên CSS `Momevia Lora`, chưa đồng nhất đúng yêu cầu `"Lora"`.
- `web/css/layout.css` sử dụng `--font-shell` trỏ đến IBM Plex Sans; header/footer không dùng Inter như yêu cầu.
- Có nhiều nhãn nhỏ 11–13px và file CSS compact (ví dụ `web/css/gift-runtime.css`); không thể coi toàn hệ thống đã được format một thuộc tính/dòng.
- Markup i18n có cơ chế VI/EN sử dụng cùng route/layout (`web/js/core/i18n.js`), kiểm tra khóa dịch; bộ `i18n:audit` hiện còn giới hạn phạm vi. Không nên cam kết mọi route English không còn tiếng Việt khi chưa chạy browser crawl.

### Thay đổi mã nguồn đã thực hiện

1. `web/index.html`: tải Plus Jakarta Sans và Inter sớm qua Google Fonts stylesheet cho **mọi route**, có preconnect, không phụ thuộc `onOpen` của preview. Giữ fallback khi mất mạng.
2. `web/css/tokens.css`: font stack `--font-display`, `--font-body`, `--font-serif` đúng yêu cầu; thay `--font-shell` bằng Inter. Đổi alias font Lora cục bộ thành `Lora`. Thêm token typography/motion.
3. `web/js/app/main.js`: fallback loader dùng `display=swap`, không dùng `display=optional`.
4. `web/css/brand-system.css`: typography cho site shell, Creator/Admin, Recipient CTA; màu nền tương phản, focus, hover/3D marketing nhẹ, responsive và reduced motion. CSS mới định dạng từng thuộc tính/một dòng.
5. `tests/unit/brand-system.test.mjs`: kiểm font/CSP, vị trí stylesheet, cấu trúc CSS, focus và reduced motion.
6. `CHANGELOG.md`: ghi thay đổi; không sửa dữ liệu Canvas/user content.

**Không thêm Spline/WebGL hay MUI trong bản này:** source hiện là Vanilla JavaScript và đã có CSS 3D, animation, Lucide SVG (không có emoji). Dùng WebGL ngay sẽ làm tăng bundle, memory/GPU và nợ bảo trì không cần thiết. Kỹ thuật cảm hứng: interactive invitation, CSS depth, progressive scroll reveal; không sao chép nội dung hay asset của website tham khảo.

**Giới hạn kiểm chứng:** chưa thực hiện đo CLS/LCP/INP bằng thiết bị thật hoặc browser screenshot pixel-perfect. Nạp font từ Google cần internet; offline sẽ dùng font fallback. Quy tắc CSS mới không tác động Canvas stage và dữ liệu thiệp người dùng.

## 6. Kết quả kiểm thử tại môi trường phân tích

- Unit test mới: **4/4 PASS**.
- Chạy suite `node --test tests/unit/*.test.mjs`: **451 PASS / 6 FAIL khi nạp module `sharp` do `node_modules` không có trong bản ZIP và môi trường kiểm tra**. Không có bằng chứng 6 lỗi này do code mới; cần `npm ci` trên máy phát triển/CI trước khi diễn giải.
- Quét i18n hiện có: `node scripts/quality/check-ui-i18n.mjs --check` **PASS** (phạm vi Designer và App Shell; không khẳng định tất cả route).
- Từ điển gốc của ZIP: **2.289 khóa VI/EN trùng tên**; số khóa không đồng nghĩa 100% câu đã dịch.
- Kiểm tra màu tối/nhạt của stylesheet mới trên nền trắng: tỷ lệ tương phản ví dụ `#594e68`/trắng **~7,74:1**, `#261c3d`/trắng **~15,96:1**, `#5e35c2`/trắng **~7,60:1**.
- Build/ESLint/Playwright/MySQL 8.4 staging trên **bản chỉnh sửa này chưa chạy đầy đủ trong môi trường phân tích**. Cần CI/CD xác minh sau khi merge.

## 7. Kế hoạch ưu tiên tiếp theo

1. **P0:** bảo vệ luồng nghiệp vụ trước live payment, test quyền/IDOR theo từng role, dữ liệu và backup/restore; không mở refund/payout tự động trước khi kiểm chứng provider.
2. **P0 UI:** Playwright crawl từng route ở chế độ English, chụp screenshot desktop/mobile, phân loại literal giao diện và dữ liệu user, không dịch tự động nội dung thiệp.
3. **P1:** refactor `designer.js` thành command/state/persistence/presentation module theo từng commit nhỏ; chuẩn hóa CSS compact khi chỉnh từng module, không rewrite một lần.
4. **P1:** kiểm thử responsive/keyboard/touch và Lighthouse/Core Web Vitals (LCP, CLS, INP), giảm motion trên máy yếu; theo dõi ảnh nặng/độ trễ tải font.
5. **P1:** hoàn thiện Creator/Admin finance ledger, đối soát, hoàn tiền thực tế có audit, bảo vệ dữ liệu người dùng.

## 8. Checklist nghiệm thu bản mới

- [ ] `npm ci`, `npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser` đạt trên máy.
- [ ] Mở trang chủ, Creator, Admin, Sender Studio và Recipient; chuyển VI → EN → VI mà không thay layout.
- [ ] Trong DevTools/Network xác nhận font Inter/Plus Jakarta Sans tải 200 khi có mạng; khi offline fallback vẫn đọc được, không mất glyph tiếng Việt.
- [ ] Trên mobile 320/375/768px, không tràn ngang; nút bấm không bị che; tab focus và reduced motion hoạt động.
- [ ] Kiểm tra thiết kế cũ, bản nháp, xuất bản và liên kết mở thiệp không đổi.
- [ ] Commit kèm `CHANGELOG.md`; CI/CD mới nhất PASS trước khi phát hành.
