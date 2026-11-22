# Marketing 3D — Tối ưu xử lý con trỏ (2026-11-22)

## Hiện trạng và nguyên nhân

`scene-motion.js` trước đây gọi `stage.getBoundingClientRect()` trong mỗi sự kiện `pointermove`. Trên màn hình tần số quét cao, một animation frame có thể nhận nhiều sự kiện chuột, gây nhiều phép đo bố cục không cần thiết. Đây là *điểm tối ưu tiềm năng*, không phải kết quả đo FPS thực tế.

## Thay đổi

- Thêm module thuần `latest-frame.js` để gom các sự kiện đến trước animation frame vào một lần xử lý; chỉ lấy tọa độ mới nhất.
- Đưa `getBoundingClientRect()` vào callback `requestAnimationFrame`; tối đa một lần đo cho mỗi callback được xử lý.
- Hủy frame chờ khi rời vùng 3D, giảm chuyển động, ẩn tab hoặc đóng module; callback đến trễ không cập nhật giao diện.
- Không thay đổi công thức nghiêng 3D, màu, layout, font, liên kết, trạng thái VI/EN hay API.

## Kiểm chứng

Chạy `node --test tests/unit/marketing-frame-scheduler.test.mjs tests/unit/marketing-motion.test.mjs`, sau đó `npm run check`, `npm run test:browser`. Bài test mới kiểm tra burst 100 sự kiện, hủy frame và chống callback trễ. Để xác nhận hiệu quả người dùng thật, cần đối chiếu Chrome DevTools Performance trước/sau và theo dõi thời gian scripting/layout tại trang chủ.

## Giới hạn

Chưa có benchmark CPU, FPS, Core Web Vitals hoặc kiểm thử điện thoại thực tế cho đợt này. Không tuyên bố tăng hiệu năng định lượng khi chưa đo.
