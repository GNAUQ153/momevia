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
