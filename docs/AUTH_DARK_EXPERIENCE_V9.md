# Momevia — Auth Experience V9

## Mục tiêu thiết kế

Tham khảo hình số 3 của người dùng (giao diện tối, nội dung bên trái và biểu mẫu bên phải), **chỉ tham khảo bố cục**, không sao chép thương hiệu, màu đỏ, chương trình ưu đãi hay logo của nguồn tham khảo.

V9 sử dụng nền tối tím–mận (#100d1d), gradient + grid nhẹ, thẻ marketing translucent bên trái, thẻ login/register glass-card bên phải, CTA tím–hồng theo nhận diện Momevia. Hình 3D Momevia từ source hiện tại được giữ với kích thước nhỏ, không chiếm không gian nhập liệu.

## Thay đổi kỹ thuật

- `web/css/auth-pages.css`: chuẩn hóa lại toàn bộ quy tắc Auth, mỗi khai báo một dòng; giảm CSS override từ các theme khác. Bố cục responsive: hai cột trên desktop, một cột ở tablet/mobile dưới 990px.
- `web/js/app/main.js`: thêm body class `is-auth-entry` **chỉ** trên `/login` và `/register`; header được thu gọn nhưng giữ localeControl gốc ở header. Footer tạm ẩn trên hai route này; `/recover` và `/verify-email` giữ giao diện cũ.
- `web/js/pages/auth.js`: giữ form xác thực, route, input attributes và endpoint OAuth; đặt hai nút Google/Zalo sau submit. Nút vô hiệu hóa có chú thích nếu chưa cấu hình; không tạo URL OAuth giả.
- `web/index.html`: cập nhật version query của CSS Auth để tránh người dùng giữ stylesheet V8 trong cache.
- Không bổ sung thư viện, font, ảnh bên thứ ba, emoji, migration, logic thanh toán hay thay đổi về quyền.

## Kiểm tra thủ công bắt buộc

1. Mở `/login` và `/register` tại 360, 390, 768, 1024, 1440 px, zoom 100% và 200%.
2. Kiểm tra logo/header, VI/EN chung, CTA chính, link `/register`, `/login`, `/recover`, hỗ trợ và điều khoản; không có thanh cuộn ngang.
3. Đăng nhập sai mật khẩu, nhập email sai, toggle password bằng bàn phím và xem thông báo lỗi; thử Tab/Shift+Tab, reduced motion.
4. Google và Zalo: xác minh button `disabled` khi `/api/auth/providers` trả `false`; chỉ khởi tạo OAuth khi flag `true`, callback đúng domain đã đăng ký.
5. Mở form đăng ký đủ các trường, thử lỗi xác nhận mật khẩu và hoàn tất tài khoản thực bằng server local.
6. Đổi VI ⇆ EN ở header, kiểm tra văn bản và layout không đổi cấu trúc.

## Giới hạn xác minh

Đã chạy kiểm tra JS, unit test Auth, CSS checker và i18n checker. Browser screenshot/E2E thực tế chưa thể xác minh trong môi trường phân tích vì Chromium bị chính sách môi trường chặn mở trang; cần chạy Playwright cùng kiểm tra thủ công trên máy người dùng. CI/CD V9 chưa được chạy trước khi push.

## Lưu ý bảo mật

Cả Google/Zalo phụ thuộc config server; `state.providers.google/zalo === false` là trạng thái chưa được kích hoạt, không phải lỗi UI. Không đưa `CLIENT_SECRET`, Zalo App Secret hoặc session token vào HTML, repo hay trình duyệt. API vẫn chịu trách nhiệm bảo vệ session, OAuth state và kiểm tra quyền.
