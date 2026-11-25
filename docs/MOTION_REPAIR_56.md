# Icon chuyển động Studio

Thư viện có 50 vector và 6 mẫu ảnh. Mỗi icon vẫn là một vật thể để chọn, kéo, đổi cỡ và nhân bản; các dòng chuyển động có công tắc riêng.

## Dữ liệu và cách dựng

- Định nghĩa vector nằm ở `web/js/shared/canvas/animated-elements.js` và `motion-revision-20261125.js`; ảnh ở `natural-elements.js` và `natural-motion-revision.js`.
- Giữ 56 ID. Tên hiển thị dùng “Mặt dây chuyền trái tim”, “Bồ câu mang nhành lá”, “Sao nghiêng nhẹ”; từ khóa cũ vẫn tìm được.
- Lượt chèn tim mới mặc định chỉ đập, xoay là tùy chọn. Quà và giấy mở một lượt; tia cát dừng cùng lượng cát ở giây 9.
- Assembly 2 hỗ trợ tư thế đồng cấu, vùng che theo biên, tư thế nghỉ và ba tài nguyên ảnh nội bộ đã duyệt. Giới hạn vẫn là 3 dòng, 12 phần, 24 track và 16 mốc mỗi track.
- Bộ phận con nhận chuyển động của cha trước chuyển động cục bộ. Ngòi và nét mực dùng chung đường và tiến độ chiều dài. Renderer chọn nội suy đường có sẵn hoặc cập nhật hình theo cùng đồng hồ khi trình duyệt không hỗ trợ.

Nháp và quà đã lưu giữ cấu hình riêng; thay thư viện chỉ ảnh hưởng lần chèn mới. Gói cập nhật được tạo bởi `createMotionRepairRollout` và kiểm revision/fingerprint qua `library-rollout.mjs`; không ghi đè thay đổi thư viện bên ngoài gói.

## Kiểm tra hồi quy

- `npm test`: hợp đồng dữ liệu, lưu/đọc, bản cũ, vùng che, tài nguyên được phép và gói cập nhật.
- `npm run test:motion:browser`: kiểm quan hệ hình học của 56 icon trên renderer thật, gồm ngòi–mực, điểm gắn, thứ tự tác động và giải phóng chuyển động.
- `npm run test:motion:browser -- --webkit`: cùng phép kiểm trên WebKit.

Bài kiểm trình duyệt tự mở máy chủ tạm tại cổng trống, không dùng tài khoản, DB, phiên cục bộ hay xuất ảnh/video/báo cáo vào repo. Trên Windows, mặc định dùng Chrome; môi trường khác dùng Chromium do Playwright cung cấp. WebKit cần được cài qua Playwright. Kiểm tự động không thay cho nghiệm thu Safari trên thiết bị thật hoặc trình đọc màn hình.
