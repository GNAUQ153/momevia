# Momevia — Marketing Performance V12

## Bối cảnh

Marketing Hero có trình chiếu mẫu, hiệu ứng nghiêng và ánh sáng 3D. V11 đã tạm dừng animation khi tab ẩn, hero ngoài viewport, hoặc hệ điều hành yêu cầu giảm chuyển động. V12 bổ sung khả năng **tiết kiệm dữ liệu** trên trình duyệt hỗ trợ `NetworkInformation.saveData` hoặc media query `prefers-reduced-data`.

## Thay đổi

- `web/js/features/marketing/motion-preferences.js`: gom quyết định tiết kiệm dữ liệu/thị giác vào hàm thuần, không thêm dependency.
- `scene-motion.js`: không chạy tilt/glow 3D khi chế độ tiết kiệm dữ liệu bật. Xóa RAF chờ, dọn thuộc tính CSS của 3D và cho toàn bộ nội dung reveal hiện ra ngay để bảo đảm khả năng tiếp cận.
- `hero-templates.js`: tạm dừng đồng hồ slideshow/hiệu ứng/teaser khi tiết kiệm dữ liệu. Nút điều khiển chuyển sang nhãn **Tiếp tục trình chiếu** (sử dụng i18n VI/EN hiện có); người dùng có thể chủ động bật lại. `prefers-reduced-motion` vẫn luôn được tôn trọng dù nhấn Play.
- Theo dõi sự kiện `change` của Network Information và media query, đăng ký listener bằng `AbortSignal` để dọn khi chuyển trang.
- Không sửa artwork, CSS, font, template, Canvas, API, OAuth, dữ liệu cá nhân hoặc schema database.

## Kiểm thử

Chạy tại root repository:

```bash
npm ci --include=dev
npm run build
npm run check
node --test tests/unit/marketing-data-saver.test.mjs tests/unit/marketing-depth.test.mjs tests/unit/marketing-playback.test.mjs
npm test
npm run test:browser
npm run i18n:audit
```

Checklist trên trình duyệt thật:

1. Desktop không bật tiết kiệm dữ liệu: slideshow tự chạy; nghiêng/ánh sáng 3D hoạt động với chuột.
2. Bật Data Saver ở môi trường hỗ trợ: slideshow dừng, nút thành Tiếp tục; không làm ẩn nội dung xuất hiện khi cuộn.
3. Nhấn Tiếp tục: slideshow có thể hoạt động lại theo yêu cầu; nút Tạm dừng vẫn dừng đúng.
4. Bật **Reduce Motion**: slideshow và 3D vẫn bị tắt, kể cả người dùng nhấn Tiếp tục.
5. Chuyển tab/điều hướng SPA: không giữ RAF/listener mồ côi; bật VI/EN không đổi cấu trúc.
6. Thiết bị không hỗ trợ `navigator.connection` hoặc `prefers-reduced-data`: trải nghiệm như V11.

## Kết quả tại môi trường tạo bản vá

- 48/48 test marketing liên quan PASS.
- Toàn bộ unit: 648 PASS, 6 file test không khởi động vì môi trường thiếu dependency, chưa xác nhận toàn bộ chương trình.
- Kiểm toán i18n, CSS và cú pháp JS PASS.
- `npm run build` chưa hoàn tất do thiếu `qrcode-generator` trong node_modules của môi trường; `npm run check` không chạy trọn do thiếu `js-yaml`.
- Chưa xác minh bằng Playwright hoặc GitHub Actions cho V12. Khuyến nghị chỉ push khi môi trường máy thật PASS.

**Phân biệt:** tiết kiệm chuyển động/CPU không đồng nghĩa giảm được tổng byte tải về; muốn giảm dữ liệu thực tế cần đo network waterfall và tối ưu nguồn ảnh/nhạc riêng. Không tuyên bố tăng điểm Core Web Vitals khi chưa đo.
