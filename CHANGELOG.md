## Unreleased — Phase 5.5: Expanded Elements & Canvas Discovery (2026-11-19)

- Thêm 48 hình vector nội bộ thuộc sáu chủ đề; Canvas Library tăng từ 124 lên 172 elements, bảo toàn 100 mục gốc và 24 hình Phase 5.4.
- Bộ lọc Tất cả / Theo dịp / Mới thêm / Vừa dùng, tìm kiếm không dấu, thống kê kết quả và thông báo khi không tìm thấy hình.
- 12 element dùng gần nhất chỉ lưu ID vào localStorage nếu trình duyệt cho phép, không lưu dữ liệu cá nhân hoặc nội dung thiệp.
- Tối ưu Canvas library trên desktop/mobile bằng CSS độc lập, focus-visible và prefers-reduced-motion; không thêm dependency, không sử dụng emoji.
- Cập nhật test API/UI và kiểm thử schema, quyền Creator, preview SVG, Undo/Redo, giữ tương thích thiệp V1/V2.

## Unreleased — Canvas 100: Crop Quick Focus (Phase 5.3 integration)

- Giữ nguyên 100 Elements, 24 hiệu ứng và schema V1/V2 sau khi hợp nhất cập nhật Canvas mới.
- Bổ sung bảng chín vị trí trọng tâm trong crop Inspector cho ảnh thường và ảnh nằm trong khối tương tác; không lưu lại ảnh gốc.
- Bảo toàn quyền chỉnh sửa Creator, Undo/Redo, autosave; nút crop có tên truy cập và điều khiển bàn phím.

## Unreleased — Fabric Precision Align (Phase 5.2)

- Chọn nhiều layer bằng checkbox, căn trái/giữa/phải/trên/dưới và chia đều khoảng cách.
- Chỉ tịnh tiến bounding box Fabric, bảo toàn góc xoay, hành động và quyền Creator.
- CSS độc lập, ARIA và unit tests; không migration hoặc thư viện mới.

## Unreleased — Fabric Workspace (Phase 5.1)

- Thêm Layer Panel trên Fabric Studio, đổi thứ tự/ẩn hiện có lưu, khóa thao tác tạm và snap tâm/biên.
- Giữ nguyên schema v1, quyền Creator và renderer người nhận; kiểm tra patch hợp lệ bằng unit tests.
- CSS riêng cho workspace, hỗ trợ mobile, ARIA và prefers-reduced-motion.

## Unreleased — Fabric Studio nâng cao (Phase 5 beta)

- Tích hợp Fabric.js (MIT) dưới dạng công cụ thiết kế nâng cao tùy chọn: di chuyển, xoay, thay kích thước và căn chỉnh lớp chữ/hình/ảnh.
- Mọi thay đổi được chuyển về Canvas schema gốc và đi qua kiểm tra quyền sửa cùng cơ chế Undo/Redo/autosave; không ảnh hưởng trình phát quà.
- Tách CSS, giữ vendor JavaScript cục bộ và kèm license trong release; bổ sung kiểm thử adapter.

## Unreleased — Phase 4: Viral Templates & Recipient Conversion (2026-11-19)

- Thêm 10 mẫu vector Momevia Originals miễn phí trong đợt marketing (4 mùa lễ 2026–2027, 6 mẫu cảm xúc), thành 24 mẫu tích hợp. Mỗi mẫu có 3 cảnh Canvas, tùy chỉnh tên người nhận/người gửi/lời nhắn; không dùng emoji hoặc ảnh stock.
- Chèn các ID mẫu còn thiếu vào Catalog JSON/MySQL, không ghi đè mẫu đã tồn tại hoặc snapshot quà đã gửi. Không yêu cầu migration mới.
- Thêm khu vực mẫu theo mùa trên /explore; mẫu vẫn tìm được quanh năm.
- Gắn CTA “Tạo thiệp của riêng bạn”, “Khám phá thêm mẫu” và “Tạo bằng Momevia” trên cả Legacy Gift và Canvas Gift. Link không mang invite token.
- Tách CSS thành seasonal-catalog.css và recipient-viral.css, thêm SVG preview và regression tests.

## Unreleased — Marketing UI & Payment Status (2026-11-18)

- Nâng cấp trang chủ phục vụ marketing: lợi ích thật, mô tả tương tác, FAQ và CTA rõ ràng.
- Tách CSS mới theo thành phần, breakpoint và màn hình thanh toán; SVG Lucide (ISC/MIT), không dùng emoji.
- Trình bày trạng thái đơn hàng pending/paid và cảnh báo không thanh toán lại khi chưa được provider xác nhận.
- Bổ sung kiểm thử nội dung, chống tràn mobile, giảm chuyển động và tài liệu giấy phép open source.
- Chưa mở API hủy/retry/refund tự động; yêu cầu kiểm thử merchant sandbox và quy trình đối soát tiền chuyển muộn.

## Unreleased — Identity Recovery & Admin Payment Operations (2026-11-18)

- Cho phép tài khoản email chưa xác minh yêu cầu đặt lại mật khẩu bằng mã 8 chữ số gửi đến chính hộp thư đăng ký; khi xác nhận hợp lệ, xác minh email, thay mật khẩu và vô hiệu hóa phiên cũ qua `credentialVersion`.
- Giữ mã một lần, hạn 15 phút, giới hạn thử nhập sai, giới hạn gửi lại và thông báo yêu cầu reset không tiết lộ sự tồn tại tài khoản.
- Thêm màn hình `/admin/payments` cho Admin để xem tối đa 100 đơn pending trên 30 phút, lọc/tìm mã đơn, xem nhật ký đối soát. Dùng các API read-only của Phase 2A; không thêm endpoint hủy/hoàn tiền/tự đánh dấu đã thanh toán.
- Bổ sung các unit test và mở rộng recovery integration journey cho tài khoản chưa xác minh; không yêu cầu migration mới.

## Unreleased — Payment Lifecycle Phase 2: Admin reconciliation review (2026-11-18)

- Thêm migration `009_payment_reconciliation_audit` để lưu metadata lần truy vấn provider (không lưu token/chữ ký/response body).
- Admin có API **chỉ đọc** để xem giao dịch chờ trên 30 phút và lịch sử đối soát; không có API tự đánh dấu paid hoặc mở khóa retry.
- Ghi nhận kết quả đối soát pending/paid/terminal/invalid/provider error; tăng regression tests xác thực quyền Admin và truy vấn có giới hạn.
- Chưa bật cancellation/retry tự động hoặc hoàn tiền. Phải kiểm thử MySQL thực tế và sandbox trước triển khai thanh toán thật.

## Unreleased — Payment reconciliation phase 1 (2026-11-18)

- Bổ sung server-side payment status inquiry cho MoMo và payOS; không tin return URL.
- Chỉ chuyển `paid` khi provider xác nhận đúng mã, số tiền và môi trường; tái sử dụng transaction cấp quyền/biên nhận hiện có.
- Giao diện payment-result có nút đối soát và giới hạn truy vấn; không tự mở khóa pending hoặc cho retry khi chưa có quy trình kiểm tra giao dịch muộn.
- Thêm regression tests và tài liệu `docs/PAYMENT_RECONCILIATION_20261118.md`.

# Unreleased — Sender, Creator và web demo

- Thiết kế 12 built-in template theo chủ đề riêng, thumbnail SVG và preview tương tác; khung polaroid nhận ảnh ready, giữ crop khi thay ảnh/nhân bản. Khởi tạo layout mới qua CAS khi client mới hơn cached server; giữ draft/gift/quyền và giá cũ.

- DOM editor cho blank/template: draft CAS, save/reload/edit, asset IDs/crop, history/scenes/layers, preview dùng chung player.
- Source/policy/provenance server-owned, registry/schema v1 strict, immutable publication/revision/hash/idempotency, link/QR và recipient anonymous/reply.
- JSON authoritative aggregate/recovery; MySQL migration006 + cùng-connection UnitOfWork, asset pins, entitlement/revoke và many-context checkout resume.
- Giữ payment/webhook/receipt v1.1; methods/pending/receipt-error riêng, không tự publish/thu lại khi retry.
- Cá nhân hóa nhanh, chia sẻ qua thiết bị, QR tải xuống, quyền link mời, hộp thư hồi đáp và thu hồi quà.
- Creator Studio thiết kế canvas, submit/duyệt phiên bản cố định, cấp ảnh demo, giữ nguồn cho nháp Sender và snapshot cho quà.
- Backup JSON và khôi phục MySQL/ảnh trong QA. Báo cáo Support theo đối tượng, người xử lý và kết quả. [Vận hành](docs/OPERATIONS.md)
- Bộ khởi tạo demo nhiều vai trò, hướng dẫn pilot ghi tay và GitHub Release theo tag sau các gate kiểm thử. [Web demo](docs/DEMO_WEB.md)

# 1.1.0 — Payment Gateway & Receipt Foundation

- Credential-gated payOS VietQR (chuyển khoản ngân hàng) và MoMo sandbox/live.
- Webhook được xác thực chữ ký SDK/IPN, đối chiếu amount/provider/order, replay-safe MySQL transaction.
- Chỉ cấp quyền khi webhook hợp lệ; không tin redirect/click client hoặc ảnh chụp chuyển khoản.
- Biên nhận thanh toán có quyền truy cập theo người mua, không tự nhận là hóa đơn VAT.
- Bật bằng PAYMENT_ENABLED; mặc định tắt. Cần merchant account, HTTPS và kiểm thử provider thật.

# Changelog

## 1.0.0 (MySQL Gifts & Checkout demo)

- MySQL adapters cho quà, phản hồi, đơn hàng demo và quyền sử dụng mẫu.
- Migration 004 tạo khóa duy nhất demo purchases và FK; transaction cấp entitlement không lặp, rollback khi lỗi.
- Reply SQL transaction ghi phản hồi và tăng `reply_count` nguyên tử; bảo toàn API public.
- Công cụ dry-run/import JSON Gifts & Checkout theo transaction và từ chối overwrite.
- Hai cờ `GIFTS_STORAGE` / `CHECKOUT_STORAGE` mặc định JSON để bảo toàn dữ liệu; ảnh vẫn local.
- Đây KHÔNG phải tích hợp thanh toán thật, không ghi nhận doanh thu/payout Creator.

## 0.9.0 — MySQL Identity & Catalog (candidate)

- MySQL repositories cho Users, Sessions, Templates và Favorites; async HTTP routing, JWT jti được tra từ MySQL, role lấy từ database.
- Migration 003 đặt provider_id case-sensitive, giảm xung đột ID demo/OAuth.
- Công cụ import JSON Identity/Catalog theo transaction: dry-run mặc định, từ chối ghi đè bảng có dữ liệu, bảo toàn JSON.
- Giữ nguyên API, tiếp tục hỗ trợ JSON qua IDENTITY_STORAGE và CATALOG_STORAGE.
- Lưu ý chưa xác minh E2E trên MySQL server trong môi trường phát triển patch; chạy checklist local trước khi deploy.

## v0.8.0 — MySQL 8.4 LTS foundation + Support adapter

- Thay migration/schema PostgreSQL bằng MySQL 8.4 LTS sử dụng InnoDB và utf8mb4.
- Bổ sung Docker Compose, công cụ chuẩn bị SQL snapshot JSON cho MySQL và bước xác minh schema/migrations.
- Thêm MySqlClient kết nối pool/transaction bằng mysql2/promise và adapter Support tùy chọn qua `SUPPORT_STORAGE=mysql`.
- Giữ JSON mặc định, thêm bridge ID Identity để không mất tham chiếu khi chuyển riêng Support.
- Chưa có MySQL runtime cho các module khác; chưa bật thanh toán thật.
- Cần chạy `npm install mysql2@3 --save-exact` để cập nhật lockfile trước khi commit và kiểm thử MySQL thực tế.

## v0.7.0 — PostgreSQL foundation (chưa chuyển runtime)

- Bổ sung lược đồ PostgreSQL cho Identity, Catalog, Gifts, Checkout, Support.
- Thêm constraints, index, bảng dự kiến payment events, entitlements, ledger và outbox.
- Thêm công cụ kiểm tra JSON và chuẩn bị snapshot SQL an toàn theo transaction (không tự import).
- Thêm Docker Compose cho DB thử nghiệm và hướng dẫn cài đặt trên Windows.
- Giữ nguyên ứng dụng chạy JSON Storage; chưa kích hoạt thanh toán hoặc PostgreSQL runtime.

## v0.6.0 — Modular Monolith (kiến trúc, chưa migrate DB)

- Gộp Gateway và năm module vào **một backend Node.js process**; vẫn dùng cổng public 4100.
- Giữ đường dẫn API và cấu trúc OOP, thay HTTP service-to-service bằng giao tiếp module qua dependency injection.
- Kiểm tra phiên/role bằng Identity module trong process; logout và thay đổi role có hiệu lực ngay.
- Duy trì proxy/service cũ dưới `dev:legacy` phục vụ so sánh hồi quy.
- Đổi `test:architecture` sang fixture một process; giữ bài test topology cũ riêng.
- Chưa thay JSON Storage, chưa tích hợp thanh toán thật/worker.

## Chưa phát hành — Sửa lỗi sau đối chiếu kiến trúc (16/11/2026)

- Chuyển nguyên bản ba tài liệu lịch sử về local, gỡ khỏi cây Git hiện hành; cập nhật ignore cho output/cache và đồng bộ chính sách loại trừ khi đóng gói/xác minh release.
- Tổ chức mã backend trong `src/modules`, tách app/route/service/repository/client; tách Gateway khỏi bootstrap và phần dùng chung. Giữ entrypoint cũ, cổng/API và vị trí dữ liệu local.
- Tách frontend thành app/core/pages/ui/features; phân nhóm unit/integration/browser/smoke và script build/quality/release/dev. Bổ sung ESLint kiểm tra định danh và import, kiểm thử view/OAuth state và browser fixture.
- Bổ sung đánh giá JSON storage, modular monolith và PostgreSQL/SQLite; chưa gộp process, migrate DB hoặc thay dữ liệu nghiệp vụ.
- Chặn Sender/Creator tự đổi role; thêm API Admin đổi role cho tài khoản đích mà không cấp nhầm phiên. Bỏ nút tự mở quyền Creator, kiểm tra lại quyền sau hạ role kể cả JWT cũ và cấu hình production.
- Sửa mô tả Redis/introspection theo kiểm thử thực tế; đánh dấu mẫu cá nhân, TTL theo mẫu và license theo lượt là backlog chưa triển khai, giữ dữ liệu/quyền cũ.
- Kiểm tra hai secret tại mọi service; production từ chối khóa mẫu và không phụ thuộc riêng launcher.
- Giới hạn login/register/demo-admin, giới hạn số scrypt đồng thời, bộ nhớ limiter cố định theo shard hash có khóa và quota tổng cho Support/replies.
- Ghi nhận phiên tại Identity, thu hồi phiên hiện tại khi logout và kiểm tra ở mọi service; JWT cũ yêu cầu đăng nhập lại.
- Đặt HTTP/upstream timeout rõ ràng, giảm giới hạn body ở endpoint nhỏ.
- Encode lại ảnh mới bằng sharp để bỏ EXIF, kiểm tra định dạng thực và giới hạn pixel; không sửa ảnh cũ.
- Tạo QR tại trình duyệt bằng module tự host, bỏ phụ thuộc QR Server API và cập nhật nội dung quyền riêng tư.
- CI Node 22/24 trên Windows/Linux; tạo gói có manifest SHA-256 và kiểm thử lại gói trước khi upload artifact. Chưa deploy hosting.
- Chặn đăng ký đồng thời trùng email trong tiến trình Identity hiện tại.
- Sửa URL ảnh thiệp trong dữ liệu public và danh sách quà của người gửi.
- Chặn namespace API nội bộ qua Gateway và bỏ header khóa nội bộ do client gửi.
- Xác lập IP tại Gateway, sửa hạn mức phản hồi bị dùng chung và chống giả IP ở Support.
- Thêm limiter có thu hồi key hết hạn và giới hạn số bucket theo tiến trình.
- Bổ sung kiểm thử HTTP trên bản sao cô lập, đưa vào CI và cập nhật báo cáo kiến trúc.

## v0.5.0 — Cải thiện trải nghiệm xác thực và phân trang

- Thiết kế lại hoàn toàn `/login` và `/register` với bố cục riêng biệt, tương thích desktop/mobile, không có cuộn lồng nhau.
- Xử lý xung đột CSS `.auth-page` cũ gây giới hạn 500px.
- Bổ sung thông báo lỗi ngay trong form, giữ biểu tượng email/khóa/mắt và nút Google/Zalo cân đối.
- Thư viện mẫu và Mẫu yêu thích được phân trang 9 mẫu/trang; trang tự điều chỉnh khi dữ liệu thay đổi.
- Khi tìm kiếm, đổi phong cách, chọn mẫu miễn phí hoặc đặt lại lọc: về trang 1 và cập nhật tổng kết quả.
- Thêm unit tests cho phân trang và tài liệu triển khai phiên bản cập nhật.

# Changelog

## v0.4.0 — 2026-11-16

- Chuyển xác thực email từ modal sang hai route `/login` và `/register` riêng.
- Cải thiện giao diện xác thực: logo, icon email/khóa/mắt, nút Google/Zalo chia hai cột bằng nhau, liên kết qua lại giữa hai form.
- Thay chip phong cách bằng dropdown tự xây từ dữ liệu mẫu, thêm lọc miễn phí riêng và cập nhật số mẫu phù hợp đúng với kết quả lọc.
- Bổ sung trang Quy định chung, Thanh toán, Bảo mật, Nội dung & Bản quyền; đưa liên kết vào footer. Nội dung hiện ở dạng dự thảo.
- Thêm script phát sinh tài khoản QA ngẫu nhiên (không hardcode tài khoản trong repository).
- Thêm unit tests cho filter, chính sách và smoke HTTP kiểm tra route.
- Giữ nguyên các microservices, API đăng ký/đăng nhập, OAuth và dữ liệu tài khoản hiện có.

---

## 0.3.0 — Đổi thương hiệu và cải thiện trải nghiệm

- Đổi Mira thành Momevia, logo 3D bản gốc.
- Header có Trang chủ, active navigation; chỉ giữ nút đăng nhập ở khách.
- Yêu thích lưu theo tài khoản, trang `/favorites`.
- Biểu mẫu liên hệ và Support Service; Back-to-top.
- Icon trong đăng ký/đăng nhập, ẩn scrollbar (vẫn cuộn được).
- Bỏ nhãn local/demo khỏi giao diện người dùng; mô tả minh bạch trạng thái thanh toán.
- Đã bổ sung kiểm thử yêu thích và hỗ trợ.

# Momevia MVP — Nhật ký cập nhật

## v0.2.0 — 15/11/2026

- Đổi toàn bộ thiết kế chữ sang Plus Jakarta Sans, Inter và Lora theo ba biến CSS được yêu cầu; không đóng gói font.
- Nâng độ tương phản và sắc độ của CTA, hero, card, header và section; bố cục responsive.
- Bổ sung tab Đăng ký và Đăng nhập bằng email/mật khẩu, lưu hash scrypt có salt trên backend.
- Thêm nút hiện/ẩn mật khẩu, xác nhận mật khẩu và thông báo lỗi đăng ký.
- Dùng logo thương hiệu Google/Zalo thực tế trên các nút OAuth; cần Internet và cấu hình để kích hoạt đăng nhập thật.
- Thêm Về chúng tôi trong header và menu mobile; mở rộng nội dung trang giới thiệu.
- Phân chia CSS theo auth.css, about.css và các tệp chức năng sẵn có, khai báo theo từng dòng.
- Thêm unit tests cho CredentialsService và smoke test đăng ký API.

**Chưa có:** xác minh email, quên mật khẩu, CAPTCHA, giới hạn login, liên kết tài khoản OAuth/email, backend database production, kiểm thử trình duyệt đầy đủ.
