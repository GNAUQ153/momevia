# Phase 4.4A – Hero Visual Depth

## Phạm vi
- Sân khấu Hero giữ nguyên kích thước, năm lớp mẫu, nút xem trước và CTA tạo thiệp.
- Phong bì CSS nguyên bản của dự án gồm hai nếp gấp, phối cảnh và bóng đổ; không dùng tài nguyên hay thư viện ngoài.
- Dùng token màu thương hiệu đã có, không sửa font, Canvas, database hay API.
- Nhãn minh họa không mang thông tin nghiệp vụ; ẩn khi cột hẹp để tránh che thiệp. Không thêm nhãn dịch.
- Giữ animation đổi mẫu và tilt có sẵn; tắt transform tương tác và transition của ảnh khi bật reduced motion. Hình phong bì vẫn có phối cảnh tĩnh.

## Nghiệm thu
- Chạy `node --test tests/unit/brand-hero-depth.test.mjs` và các test marketing/brand.
- Chạy `npm run build && npm run check && npm test` và `npm run test:browser` trên môi trường fixture độc lập.
- Kiểm tra VI/EN, các viewport 320–1614px, chế độ reduced motion, tab tới nút xem trước, chọn mẫu và CTA tạo thiệp.
- Không kết luận WCAG toàn website hoặc cải thiện conversion/performance khi chưa đo production.
