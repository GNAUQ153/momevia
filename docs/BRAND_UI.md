# Hướng dẫn UI/UX và thương hiệu Momevia v0.5

## Nhận diện

- **Tên đề xuất:** Momevia — Gửi điều thương, giữ kỷ niệm.
- **Logo:** Hộp quà/phong bì 3D với trái tim và dải ruy-băng tím–san hô.
- **Font:** `--font-display: "Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif;` ; `--font-body: "Inter", system-ui, -apple-system, sans-serif;` ; `--font-serif: "Lora", Georgia, serif;`.
- **Màu chủ đạo:** tím `#6136df`, hồng san hô `#f45278`, mực `#221a39`, nền kem `#fff7f6`.
- **Logo ảnh:** `web/assets/momevia-logo-3d.png` và `web/assets/momevia-icon-128.png`.

## Header

- “Trang chủ” có nhãn rõ và active ở `/`.
- “Cách hoạt động” active khi đang xem `/#how-it-works`.
- “Khám phá mẫu” active ở danh mục, chi tiết mẫu, cá nhân hóa mẫu.
- “Cho nhà sáng tạo” active ở `/creator`.
- “Về chúng tôi” active ở `/about`.
- Người chưa đăng nhập thấy **một nút Đăng nhập** dẫn đến `/login`; đăng ký dùng trang `/register` riêng, có liên kết chuyển giữa hai trang.
- Người đã đăng nhập thấy khu vực cá nhân và menu avatar.

## Yêu thích

Trái tim ở mỗi thẻ mẫu và chi tiết mẫu là một nút độc lập với link điều hướng. Khách chưa đăng nhập được yêu cầu xác thực. Sau khi xác thực, thao tác lưu được áp dụng vào đúng tài khoản. Trang `/favorites` tập hợp các mẫu đã lưu.

## Liên hệ và Back to top

Nút liên hệ cố định góc phải dưới, mở biểu mẫu có xác thực trường. Nút lên đầu trang xuất hiện sau khi cuộn quá 420 px. Các nút hỗ trợ bàn phím và tên truy cập (`aria-label`).

## Kiểm thử trực quan cần thực hiện trước phát hành

- Header active ở desktop 1440, 1280, 1024, mobile 390/375/320 px.
- Trang `/login` và `/register` dùng bố cục responsive và cuộn trang trên màn hình thấp; tránh cuộn lồng nhau làm che trường nhập hoặc nút gửi.
- Nút yêu thích không che nút Xem mẫu; không bị mất trạng thái sau đăng xuất/đăng nhập.
- Nút hỗ trợ và back-to-top không che CTA chính ở mobile.
- Font tiếng Việt không mất dấu trên Chrome, Edge, Safari.

Nguồn giao diện hiện tại: `web/js/ui/layout.js` cho header/footer, `web/js/pages/auth.js` cho đăng nhập/đăng ký và các file CSS theo vùng trong `web/css/`.
