# Momevia MVP v0.5 — Cập nhật giao diện đăng nhập và phân trang

## 1. Phạm vi cập nhật

- Route `/login` và `/register`: thiết kế lại toàn bộ theo phong cách nhất quán Momevia, bố cục chia hai cột desktop; biểu mẫu một cột trên mobile.
- Khắc phục CSS cũ ở `gift.css` từng đặt `.auth-page` `width: min(100%, 500px)` dẫn đến trang bị ép hẹp. Quy tắc mới trong `auth-pages.css` ghi đè chính xác mà không làm hỏng các giao diện khác.
- Email, mật khẩu, xác nhận mật khẩu, icon, thao tác hiện/ẩn mật khẩu và Google/Zalo vẫn giữ nguyên nghiệp vụ. Thông báo lỗi xác thực hiển thị ngay trong form.
- Thư viện `/explore` và danh sách `/favorites`: giới hạn **9 mẫu/trang**. Chọn trang, Trước/Tiếp; số mẫu, tổng trang và dải mẫu hiển thị đều tính sau khi lọc.
- Lọc theo phong cách, miễn phí, tìm kiếm hoặc đặt lại bộ lọc: quay về trang 1. Danh sách yêu thích khi bớt mẫu tự điều chỉnh số trang.

## 2. Cách áp dụng lên repository đang dùng

1. Dùng bản **Update Only**, tạo nhánh Git từ `main` mới nhất.
2. Chép đè đúng các file trong gói vào thư mục dự án, không xóa thư mục `.git` và không chạm `.env`.
3. Chạy `npm test`, sau đó `npm run dev`.
4. Truy cập `http://localhost:4100/login`, `http://localhost:4100/register` và `http://localhost:4100/explore`.
5. Kiểm tra cả desktop (1280px trở lên) và mobile (360px, 390px), thử nhập sai mật khẩu, nhấn con mắt, đổi style và chuyển trang.
6. Tạo Pull Request vào `main`; chờ CI và code review.

## 3. Các file cần thiết

- `web/js/app.js`: màn xác thực và sự kiện phân trang.
- `web/js/catalog-filter.js`: hàm phân trang thuần, dễ kiểm thử.
- `web/css/auth-pages.css`: giao diện mới, CSS dễ đọc.
- `web/css/pagination.css`: style phân trang, responsive và keyboard focus.
- `web/index.html`: bổ sung stylesheet phân trang.
- `tests/pagination.test.mjs`: các ca kiểm thử mới.
- `scripts/smoke-ui.mjs`: xác nhận tài nguyên phân trang truy cập được.
- `package.json`, `CHANGELOG.md`, `README.md`: thông tin phiên bản.

## 4. Kết quả và giới hạn kiểm thử

- Đã chạy unit tests, kiểm thử xác thực API, các bước smoke test backend và tải route/tài nguyên.
- Môi trường thử nghiệm không cho phép trình duyệt Chromium điều hướng tới địa chỉ web local hoặc tên miền mô phỏng (`ERR_BLOCKED_BY_ADMINISTRATOR`). Vì vậy chưa xác nhận được ảnh chụp UI trên Chrome thật; cần kiểm tra trực quan trên máy người phát triển.
- Google và Zalo chỉ hoạt động thật khi có cấu hình OAuth hợp lệ; bản cập nhật này không thay đổi OAuth.

## 5. Không thay đổi

- Không đổi microservices, API hoặc cơ sở dữ liệu.
- Không đổi font Plus Jakarta Sans, Inter, Lora.
- Không chứa `.env`, bí mật OAuth, dữ liệu người dùng, file CI hoặc `.git`.
- Không cần thêm package npm.
