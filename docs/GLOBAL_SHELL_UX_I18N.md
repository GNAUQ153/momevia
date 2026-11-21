# Global Shell UI/UX và hàng đợi Refund — 21/11/2026

## Đã thay đổi

- `app/main.js`: thông báo giao dịch cần đối soát dùng từ điển, không hiển thị chuỗi tiếng Việt cố định khi ở English; ảnh được tải lên có `alt` động theo VI/EN.
- `refund/latest-request.js`: yêu cầu GET mới nhất mới được thay đổi hàng đợi; phản hồi cũ hoặc lỗi trễ không ghi đè danh sách hiện tại.
- `refund-review.js`: vùng trạng thái tải/lỗi có `role=status`, `aria-live=polite`. Nếu mạng lỗi, bộ lọc và danh sách trước vẫn còn, có thể thử lại.
- `refund-review.css`: dùng chung các token focus và chiều cao điều khiển 44px, hạn chế chuyển động khi người dùng chọn reduced motion.
- `check-ui-i18n.mjs`: kiểm tra thêm chuỗi tiếng Việt cố định trong `web/js/app/main.js`, ngoại trừ giá trị metadata đã lưu `Lễ hội`. Không tự động dịch các trường người dùng nhập.

## Kiểm thử thủ công

1. Đăng nhập Admin với MySQL thử nghiệm, mở `/admin/payments`, lần lượt chọn các trạng thái Refund. Kiểm tra trạng thái tải và các nút Trang trước/Trang sau.
2. Tắt mạng trong DevTools khi đang ở trang Refund, chuyển bộ lọc, xác nhận danh sách trước vẫn hiển thị và có thông báo lỗi dễ hiểu. Bật mạng và thử lại.
3. Mô phỏng phản hồi API chậm rồi đổi bộ lọc hai lần; trang không bị kết quả cũ ghi đè.
4. Chuyển VI → EN tại màn hình quà; tải ảnh lên và kiểm tra thuộc tính `alt` của preview. Đổi trở lại VI và kiểm tra alt đổi theo.
5. Ở chế độ English, mở giao dịch yêu cầu đối soát; thông báo dùng tiếng Anh. Không dùng thanh toán thật để kiểm thử.
6. Kiểm tra kích thước 375/768/1440px, Tab/Shift+Tab, focus-visible và reduced motion.

## Giới hạn

- Chưa kiểm chứng trực tiếp tất cả route/thiết bị bằng trình duyệt hoặc MySQL thật trong môi trường tạo bản vá.
- Chưa bảo đảm 100% giao diện English không còn các chuỗi Việt từ dữ liệu template, thông báo backend khác hoặc module cũ.
- Không thay đổi cơ sở dữ liệu, cách xác thực thanh toán, quyền, mutation hoàn tiền hoặc ledger.
