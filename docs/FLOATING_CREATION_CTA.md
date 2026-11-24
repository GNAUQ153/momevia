# CTA nổi: tạo mới và khám phá mẫu

Đã thêm ô CTA không phải modal, neo góc dưới bên phải. Hai hành động:

- **Tạo mẫu ngay** → `/design/new`, mở luồng bắt đầu thiết kế. Khách chưa đăng nhập được đưa đến đăng nhập rồi quay đúng luồng tạo mới.
- **Khám phá mẫu ngay** → `/explore`, mở thư viện mẫu có sẵn.

Ô luôn hiện khi duyệt trang, kể cả trang nhận quà, đăng nhập và danh sách Studio. Chỉ ẩn tại `/design/:id`, `/create/:templateId` và trang chỉnh thư viện `/admin/library`; hiện lại khi rời màn hình chỉnh. Không có tự đóng theo thời gian, không lấy focus và không mang slug quà, tên người nhận hoặc invite token sang hai đích.

Desktop dùng ô hai dòng ở góc phải. Điện thoại dùng hai nút cạnh nhau ở đáy để gọn hơn; đều neo phải, tính safe-area và giữ vùng chạm ít nhất 44 px. Chừa khoảng cuối trang, dời công cụ hỗ trợ tránh chồng lên ô CTA và đưa control đang focus ra khỏi vùng bị che. Không thay palette/font chung. Hover/press nhẹ và tắt transition theo reduced motion.

Đã thử bằng Chrome trên ứng dụng MySQL cục bộ đang dùng, tại 320/390/768/1024/1440 px, VI/EN, bấm thật cả hai đích, đăng nhập/quay lại tạo, mở canvas thật và rời editor. Giao diện menu di động được dùng để đổi ngôn ngữ. Đã thử nhận quà ẩn danh: Enter mở hộp, chạm sang lời chúc, nhập và gửi hồi đáp khi ô CTA hiện. Ảnh đính kèm được chụp sau khi thư viện đã tải.

- [Bằng chứng trình duyệt](animated-elements-live-20261124/floating-cta-browser.json)
- [Desktop](animated-elements-live-20261124/floating-cta-1440.png)
- [Điện thoại 390 px](animated-elements-live-20261124/floating-cta-390.png)
- [Gửi hồi đáp](animated-elements-live-20261124/floating-cta-reply-390.png)
- [MySQL cục bộ và backup](ANIMATED_ELEMENTS_LOCAL_MYSQL.md)

Các kích thước điện thoại là mô phỏng trình duyệt, chưa xác minh bàn phím ảo hoặc thiết bị vật lý. Việc cập nhật này không bao gồm phát hành dịch vụ ngoài máy cục bộ.
