# Đánh giá Momevia - 28/11/2026

Phạm vi: mã nguồn tại commit `3650c1d` cộng các thay đổi trong lần làm việc này; header HTTP công khai của momevia.io.vn; hai tài liệu nghiệp vụ "Định hướng MOMEVIA" (M01–M15, nghiệm thu) và "Đề án hợp nhất" (80 mã AC/AD/CR/BU/RE).
Không có quyền vào bảng điều khiển Hostinger/Railway hay dữ liệu production. Kết luận dưới đây dựa trên mã, kiểm thử local và những gì quan sát được từ bên ngoài.

Lưu ý: bản đang chạy trên momevia.io.vn (last-modified 27/11 20:38) **cũ hơn** commit `46cd9bf`, nên giao diện trên tên miền chưa phản ánh hai lần làm mới gần nhất.

## 1. Kết luận nhanh

| Câu hỏi | Trả lời | Ghi chú |
| --- | --- | --- |
| Có dùng OOP không? | **Có, ở backend** | Service/Repository class, dependency injection (`CatalogService`, `DesignsService`, `GiftsService`, repository JSON/MySQL cùng interface). Frontend chủ yếu dùng module hàm ES, đây là lựa chọn hợp lệ, không phải lỗi. |
| Dễ bảo trì không? | **Trung bình** | Ranh giới module backend tốt; frontend có vài file điều phối quá lớn và nhiều thế hệ mẫu thiệp chồng lên nhau (chi tiết mục 3). |
| Bảo mật dữ liệu? | **Nền tảng tốt, triển khai còn hở** | Mã có scrypt, cookie HttpOnly, kiểm tra Origin, SQL tham số hóa, token link khó đoán. Hở ở tầng triển khai Hostinger → Railway (mục 4). |
| Phát triển tiếp được không? | **Được** | Schema Canvas chung, adapter JSON/MySQL, CAS revision, 1.327 unit test + browser test. Cần trả nợ kỹ thuật trước khi thêm tính năng lớn. |
| Đúng nghiệp vụ chưa? | **Phần lớn đúng hướng, còn 4 lệch quan trọng** | Xem mục 6: tạo thử trước đăng nhập, analytics, Premium, RSVP cho link dùng chung. |

## 2. OOP và kiến trúc

- Backend là **modular monolith**: một tiến trình Node, chia module theo nghiệp vụ trong `src/modules/` (identity, catalog, designs, gifts, checkout, payments, support). Không phải microservices, và với quy mô MVP thì như vậy là phù hợp.
- Lớp nghiệp vụ là class có constructor nhận repository (ví dụ `src/modules/catalog/catalog.service.mjs`), repository JSON và MySQL thay thế được cho nhau. Đây là OOP đúng nghĩa: đóng gói, đa hình qua interface repository, tiêm phụ thuộc.
- Frontend (`web/js/`) dùng hàm và module ES, ít class. Không cần ép chuyển sang class; điều cần là tách file theo trách nhiệm (mục 3).

## 3. Khả năng bảo trì: điểm cần xử lý

| Mức | Vấn đề | Bằng chứng | Đề xuất |
| --- | --- | --- | --- |
| Cao | File điều phối quá lớn | `web/js/pages/designer.js` ~2.370 dòng; `web/js/app/main.js` ~1.380 dòng chứa router, render từng trang và xử lý quà | Tách router, mỗi route một controller; tách designer thành panel/command riêng, giữ test hợp đồng hiện có |
| Cao | Nhiều thế hệ mẫu thiệp song song | `basic-templates`, `refresh-21`, `originals`, `signature`, `open-me-*`, `interactive-templates`, `event-cards`, `collection-2027` cùng trong `web/js/shared/canvas/` | Giữ code cũ chỉ để mở quà đã phát hành; mẫu mới chỉ đi qua một builder (Originals). Lên kế hoạch gom về một định dạng |
| Trung bình | Router chứa ID mẫu cố định | `main.js` có danh sách như `'club-22-invitation','cozy-christmas-invitation','tet-phong-thu'` để bật RSVP/lời đề tặng | Chuyển thành thuộc tính khai báo trong dữ liệu mẫu, router không cần biết ID |
| Trung bình | Dòng code rất dài, khó review | Nhiều dòng 500–900 ký tự trong `pages/gifts.js`, `pages/creator.js`, `catalog-actions.js`, `seed.mjs` | Format lại theo ESLint/Prettier khi chạm vào file; không cần đổi hàng loạt một lần |
| Thấp | Thư mục `docs/` hơn 130 file theo từng phase | `docs/PHASE0x_*.md` | Gom thành vài tài liệu sống (kiến trúc, vận hành, nghiệp vụ); phase cũ đưa vào lưu trữ |

CSS đã đạt yêu cầu "mỗi khai báo một dòng": `check-css-style` báo 61 file, 11.127 khai báo, không có rule nén.

## 4. Bảo mật dữ liệu

Đã có trong mã:

| Cơ chế | Vị trí |
| --- | --- |
| Mật khẩu băm scrypt, salt riêng, so sánh thời gian hằng | `src/modules/identity/credentials.service.mjs` |
| Phiên ký HMAC, cookie HttpOnly/SameSite, Secure khi HTTPS | `src/shared/security.mjs`, `sessions.service.mjs` |
| Kiểm tra quyền sở hữu và vai trò ở server, không chỉ ẩn nút | `designs.service.mjs`, `gifts.service.mjs`, `src/server/app.mjs` |
| Kiểm tra Origin cho POST, chặn API nội bộ | `src/shared/request-origin.mjs` |
| Ảnh tải lên được kiểm tra, giới hạn dung lượng, encode lại bằng sharp | `designs/assets.service.mjs`, `gifts/photo.mjs` |
| SQL tham số hóa, transaction, CAS revision | repository MySQL |
| Link quà có token khó đoán; người nhận không cần tài khoản | module gifts |
| Giới hạn tần suất đăng nhập, phản hồi, RSVP | `src/shared/rate-limit.mjs`, `gifts.service.mjs` |
| `.env` không bị commit | `.gitignore`, `git ls-files` không có file bí mật |

Cần xử lý:

| Mức | Vấn đề | Ảnh hưởng | Việc cần làm |
| --- | --- | --- | --- |
| P1 | API đi qua `deploy/hostinger/api-relay.php` (PHP curl) sang Railway | Railway thấy mọi người dùng chung **một IP của Hostinger**. Giới hạn chống dò mật khẩu theo IP trở thành giới hạn chung: một người spam có thể khóa đăng nhập của tất cả mọi người, và kẻ dò mật khẩu không bị chặn riêng | Ưu tiên trỏ subdomain `api.momevia.io.vn` thẳng vào Railway (custom domain), bỏ relay. Nếu bắt buộc giữ relay: ký header IP bằng khóa bí mật chung giữa relay và backend, backend chỉ tin header khi chữ ký đúng |
| P1 | Header bảo mật trên Hostinger yếu hơn Railway | momevia.io.vn chỉ có `content-security-policy: upgrade-insecure-requests`, không có HSTS; trang quà `/g/...` không có `X-Robots-Tag: noindex` | Áp dụng `deploy/hostinger/.htaccess` đã chuẩn bị (no-referrer, noindex cho `/g/`, private cache), thêm HSTS sau khi chắc chắn mọi subdomain có HTTPS; thử CSP chặt ở chế độ Report-Only trước |
| P1 | `PRODUCTION_STRICT=false` mặc định | Server vẫn khởi động khi cấu hình production chưa đạt | Chạy `npm run check:production`, sửa hết cảnh báo, rồi bật `PRODUCTION_STRICT=true` trên Railway |
| P2 | Rate limit lưu trong bộ nhớ từng tiến trình | Tăng số replica trên Railway thì mỗi replica có quota riêng; restart là mất quota | Khi scale: chuyển bộ đếm sang Redis/MySQL |
| P2 | Sao lưu | DB MySQL và ảnh trên volume là hai nơi khác nhau | Sao lưu cả hai cùng thời điểm và diễn tập khôi phục, kiểm tra quà cũ còn mở được |

## 5. Vai trò nào chưa hoàn thiện

| Vai trò | Đã có | Còn thiếu so với tài liệu |
| --- | --- | --- |
| **Sender** (người tạo thiệp) | Tài khoản, thư viện, yêu thích, Editor Canvas, nháp tự lưu, xuất bản, link/QR, xem phản hồi, thu hồi link | **M04: tạo thử trước khi đăng nhập** (hiện `/create` gọi `requireLogin` trước khi mở Editor). **M09: xuất ảnh** mới có nút tải PNG một cảnh trong Fabric Studio của Editor; chưa có xuất ảnh dọc từ trang quà đã xuất bản. **M12: mua Premium thật** chưa sẵn sàng. Hồ sơ cá nhân, xuất/xóa dữ liệu tài khoản (AC04, AC06) chưa có |
| **Recipient** (người nhận) | Mở link không cần tài khoản, tương tác, bật/tắt nhạc và chuyển động, phản hồi, RSVP, trạng thái hết hạn | RSVP chỉ chạy khi gửi theo **danh sách khách/link riêng**; link dùng chung một thiệp mời cho nhiều khách (đúng quy tắc nghiệp vụ 5.4) chỉ còn ô phản hồi văn bản. Chưa kiểm thử trên Safari iOS/Chrome Android/Zalo thật |
| **Creator** (nhà sáng tạo) | Studio, nháp, phiên bản, khai báo vùng cá nhân hóa, gửi duyệt, sửa theo phản hồi, rút mẫu, báo cáo doanh thu chỉ đọc | **Ít hoàn thiện nhất.** Thiếu hồ sơ đăng ký và duyệt Creator, gian hàng công khai, khai báo tài khoản nhận tiền, chi trả (`finance-report` trả `canPayout: false`). Theo tài liệu MVP, Marketplace thuộc nhóm Won't (W05), nên đây là phạm vi sau MVP chứ không phải lỗi chặn |
| **Admin** | Phân vai, duyệt mẫu, thư viện, ticket hỗ trợ, báo vi phạm, xem đơn/đối soát/hàng đợi hoàn tiền | Chi trả Creator, xác nhận hoàn tiền thật, nhật ký kiểm toán đầy đủ, **dashboard funnel** (M13) |

Tóm lại: so với MVP (tài liệu "Định hướng"), **Sender và nền tảng đo lường** là nơi thiếu ảnh hưởng nhiều nhất tới việc kiểm chứng giả thuyết. So với đề án đầy đủ, **Creator** là vai trò thiếu nhiều nhất.

## 6. Đối chiếu nghiệp vụ

Đúng hướng:

- Phân biệt thiệp mời / thiệp chúc mừng; thiệp mời có ngày, giờ, địa điểm (M06).
- Người nhận không cần tài khoản hay thanh toán; link không công khai, khó đoán (5.4).
- Quyền được kiểm tra ở server; bản đã xuất bản được "chụp" lại nên sửa/gỡ mẫu gốc không làm hỏng quà đã gửi (đề án 5.3).
- Thanh toán live tắt mặc định, xác nhận ở server, có idempotency (rủi ro "thanh toán không ổn định").

Lệch hoặc chưa đủ để kiểm chứng giả thuyết:

| Mức | Lệch | Giả thuyết bị ảnh hưởng | Đề xuất |
| --- | --- | --- | --- |
| P1 | Không có sự kiện analytics (bắt đầu tạo → hoàn thành → xuất bản → chia sẻ → mở → phản hồi → thanh toán) | H3, H4, H5, H6 không đo được | Thêm bảng `events` tối giản ở backend, ghi tại các điểm đã có sẵn trong service; tách thiệp mời/chúc mừng trong báo cáo |
| P1 | Bắt buộc đăng nhập trước khi thử tạo | H2 (≥70% tự hoàn thành), quy tắc 5.1 | Nháp khách lưu ở trình duyệt; chỉ hỏi đăng nhập khi lưu/xuất bản, thông báo trước |
| P1 | **Sau lần này, cả 16 mẫu trong thư viện đều Miễn phí** | H5 (10–20 giao dịch trả phí), M12 | Cần quyết định: mẫu nào là Premium và quyền lợi Premium là gì (tài liệu ghi "chưa chốt"). Mẫu trả phí cũ vẫn mua được qua link trực tiếp nhưng không còn hiển thị |
| P2 | RSVP không có cho link dùng chung | M11, UC01/UC02 | Cho khách tự nhập tên khi RSVP trên link dùng chung, có giới hạn chống spam |
| P2 | Thời hạn link | Quy tắc "không để thiệp mời hết hạn trước ngày sự kiện" | Khi có ngày sự kiện, hạn link ≥ ngày sự kiện + vài ngày; hiển thị rõ trước khi xuất bản |

## 7. Thay đổi trong lần làm việc này

### 16 mẫu thiệp thiết kế lại theo góc nhìn người nhận

Trước đây 16 mẫu sinh ra từ **một khung chung**, chỉ đổi màu, một hình minh họa và một biến thể khung, nên trông giống nhau và giống biểu mẫu. Nay mỗi mẫu là một câu chuyện riêng:

1. **Bìa tối, gây tò mò**: tên người nhận và một vật thể 3D phải chạm để mở. Có 6 cơ chế mở dùng hoạt ảnh sẵn có của runtime: hộp quà kéo nơ, phong thư bẻ dấu sáp, cửa đôi mở ra, máy ảnh in ảnh, tờ lịch bóc nhãn, ống kính lấy nét.
2. **Lời mời / lời chúc**: thiệp mời có "vé sự kiện" với ngày, giờ, địa điểm và trang phục; thiệp chúc mừng có khung ảnh nghiêng.
3. **Khám phá**: tương tác riêng từng mẫu (lau tuyết, chọn hộp quà, thắp nến, ghép tim, gấp thư chương trình, lật bưu thiếp...).
4. **Hai nhánh** ở 3 mẫu (Bắc Đẩu, Cà phê, Lát bánh): lựa chọn của người nhận dẫn tới lời nhắn khác nhau.
5. **Hồi đáp**: lời kết gắn với câu chuyện, ô phản hồi, hiệu ứng không khí theo dịp.

| Dịp | Mẫu |
| --- | --- |
| Giáng sinh | Đêm trong quả cầu tuyết (mời), Hộp quà mùa yêu thương (chúc), Bữa tối dưới sao Bắc Đẩu (mời, 2 nhánh), Bưu thiếp mùa đông (chúc, lịch Mùa Vọng) |
| Tốt nghiệp | Khoảnh khắc trưởng thành (mời), Trang lưu bút dành cho bạn (chúc) |
| Gặp gỡ | Hẹn nhau bên tách cà phê (mời, 2 nhánh), Hẹn nhau ở chợ đêm (mời) |
| Sinh nhật | Hộp điều ước (chúc), Bữa tiệc bóng bay (mời), Miếng bánh bí mật (chúc, 2 nhánh), Sinh nhật dưới trời sao (mời) |
| Đám cưới | Lời hẹn trong vườn (mời), Cuốn album lời chúc (chúc), Lời hẹn dưới trăng (mời), Mùa hoa hạnh phúc (mời) |

Mọi lớp vẫn là đối tượng Canvas chỉnh sửa được trong Editor. Luôn có nút "Xem nội dung ngay" để bỏ qua hiệu ứng (M07/M10). VI và EN dùng **cùng bố cục, cùng khóa**, chỉ khác chữ.

File liên quan:

- `web/js/shared/canvas/originals-data.js`: dữ liệu 16 mẫu (màu, cơ chế mở, tương tác).
- `web/js/shared/canvas/originals-rigs.js`: 6 cơ chế mở bìa 3D và họa tiết nền theo dịp.
- `web/js/shared/canvas/originals.js`: dựng câu chuyện theo từng cảnh.
- `scripts/build/originals-copy.mjs`: nội dung VI/EN, ghi vào `web/assets/locales/*.json`.

### Sửa lỗi và nghiệp vụ đi kèm

- Thư viện và trang chủ chỉ liệt kê 16 Originals + mẫu do Creator đăng. 28 mẫu hệ thống cũ (nhiều mẫu tên tiếng Anh) **vẫn mở, tạo và xuất bản được** qua link trực tiếp, nên nháp và quà đã gửi không bị ảnh hưởng.
- Chip dịp trên trang chủ khớp số mẫu thật và có thêm Tốt nghiệp, Gặp gỡ.
- Đồng hồ đếm ngược tự lấy ngày giờ của thiệp mời: Sender chỉ nhập một lần, người nhận không thấy ô đếm ngược trống.
- Bản xem thử dùng ví dụ sự kiện trông như thật, không còn chữ "(minh họa)" trên thiệp.
- Nút trong thiệp tự chọn màu chữ tối/sáng theo màu nền (trước đây luôn là chữ trắng, khó đọc trên nền sáng).
- Ảnh bìa đang tải không còn hiện chữ alt như ảnh lỗi.

### Chưa làm trong lần này

- Trang chủ đã được làm mới ở commit `46cd9bf` (font Bricolage Grotesque/Be Vietnam Pro có giấy phép OFL, hiệu ứng mùa Giáng sinh → Năm mới → Tết tự chuyển, chiều sâu CSS 3D); lần này chỉ sửa dữ liệu hiển thị. Partiful dùng font thương mại riêng, nên dự án dùng font mã nguồn mở có cảm giác tương tự thay vì sao chép.
- Chưa thêm thư viện 3D (Three.js/Spline) vì sẽ tăng dung lượng tải trang thiệp, trái mục tiêu "nội dung chính trong 3 giây trên di động". Hiệu ứng 3D hiện dùng CSS/WAAPI và tôn trọng "giảm chuyển động".
- Chưa có hiệu ứng tuyết rơi riêng; mẫu Giáng sinh dùng hiệu ứng sao trôi và họa tiết bông tuyết trên bìa.
- Chưa kiểm thử trên điện thoại thật.

## 8. Kiểm tra đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` | PASS, tạo lại 47 ảnh bìa |
| `npm run check` (JS, i18n VI/EN, CSS một khai báo một dòng, font, audit kỹ thuật) | PASS |
| ESLint trên các file đã sửa | PASS |
| `npm test` | 1.327/1.327 PASS |
| `npm run test:templates` (44 mẫu tạo, lưu, xuất bản, ảnh bìa) | PASS |
| `npm run test:browser` (bộ browser của CI) | PASS |
| 16 mẫu × VI/EN validate ở chế độ xuất bản | 32/32 PASS; mọi cảnh đều tới được từ bìa |

## 9. Triển khai lên momevia.io.vn

1. `npm run build:hostinger`, upload `dist/hostinger-public` theo quy trình hiện có.
2. Deploy backend lên Railway như bình thường.
3. Nếu production dùng thư viện mẫu trên MySQL (`canvas_library_items`), bản lưu trong DB **được ưu tiên hơn code mới**. Khi đó chạy `node scripts/build/originals-update.mjs` để tạo 16 đề xuất trong `dist/originals-update/`, export thư viện hiện tại, đối chiếu revision rồi mới áp dụng bằng `database/scripts/canvas-library.mjs --put`. Không sửa `expectedRevision` để ép ghi.
4. Quà đã phát hành giữ nguyên bản cũ; chỉ thiệp tạo mới dùng thiết kế mới.

## 10. Thứ tự ưu tiên đề xuất

1. Bỏ relay PHP, trỏ API thẳng vào Railway; áp dụng header bảo mật trên Hostinger (mục 4).
2. Quyết định mẫu Premium và quyền lợi; hoàn tất thanh toán sandbox → live (H5).
3. Ghi sự kiện analytics cho funnel (H3–H6).
4. Cho tạo thử không cần đăng nhập (H2).
5. RSVP trên link dùng chung, xuất ảnh dọc từ quà đã xuất bản.
6. Kiểm thử trên điện thoại thật (Safari iOS, Chrome Android, mở từ Zalo/Messenger).
7. Tách `main.js`/`designer.js`, gom các thế hệ mẫu cũ.
