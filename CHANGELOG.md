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
