# Phase 5.6 — Không gian của tôi (Studio Space)

## Phạm vi
- Duy trì route `/studio`, endpoint và các hành động gửi quà, tiếp tục nháp, nhân bản, thu hồi, xem hồi đáp và biên nhận.
- Tăng độ rõ ràng của tiêu đề, bổ sung hành động nhanh, điều hướng mục, tìm kiếm không dấu và lọc theo nhóm.
- Chỉ lọc trên các bản ghi **đã tải vào trang**; không khẳng định tìm kiếm toàn bộ dữ liệu server.
- Tách style `web/css/studio-space.css` và logic `web/js/features/studio/studio-space.js`.
- Dọn observer/listeners khi route bị tháo khỏi SPA.

## Phạm vi ảnh và elements
- Vector SVG: hình khối, icon, artwork cần đổi màu và scale không vỡ nét.
- PNG/WebP nền trong suốt: sticker vẽ tay, ảnh 3D, texture; giữ lớp ảnh riêng để xoay, phóng thu, crop.
- GIF/WebP động/Lottie: chỉ nên triển khai sau khi định nghĩa serialization và rendering tương thích ở editor, preview và trang người nhận.
- Asset nguồn ngoài: phải có quyền tái sử dụng, kiểm tra MIME/kích thước, bảo vệ XSS, CORS và metadata giấy phép. Không sao chép assets chưa rõ nguồn.

## QA thủ công
1. `/studio`: tải nháp, quà đã gửi và biên nhận; không lỗi console.
2. Tab Tất cả / Bản nháp / Quà đã gửi / Biên nhận hiển thị đúng từng mục.
3. Tìm tên người nhận có/không dấu. Khi không có kết quả, hiển thị thông báo rõ ràng.
4. Bấm Xóa bộ lọc, chuyển về Tất cả, danh sách hiện lại.
5. Kiểm tra các nút Nhân bản, Lưu trữ, Ngừng chia sẻ, Hồi đáp và Xem biên nhận hoạt động bình thường.
6. Kiểm tra 320, 375, 390, 768 và 1440px, bàn phím, màn hình đọc và reduced-motion.
7. Đổi route và quay lại `/studio`, không có observer nhân đôi hoặc lỗi khi dữ liệu tải chậm.
8. Trường hợp dữ liệu trống hoặc API lỗi, vẫn hiển thị thông báo và nút Thử lại hiện có.

## Giới hạn
- Mới có progressive UI; không thay đổi thư viện Canvas, schema hoặc dịch vụ tải ảnh.
- Cần chạy Browser E2E/Full CI trên checkout mới nhất trước commit.
