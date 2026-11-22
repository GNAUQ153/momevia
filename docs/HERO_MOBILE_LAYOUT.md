# Sửa lỗi CI — vị trí điều khiển Hero trên mobile

## Bằng chứng
Run `44934481494` thất bại trong `npm run test:browser`, tại `tests/browser/hero-templates.mjs:90`, ở kiểm thử màn hình `390 × 844` bật Reduced Motion. `The three indicators sit below the artwork` trả về `false`.

## Phân tích
`web/css/marketing-immersive.css` dùng `grid-template-rows: minmax(0, 1fr) auto` cho `.mkt-hero__artwork`, trong khi khung `.mkt-stage` đặt `min-height` theo breakpoint. Khi không gian phân bố bị giới hạn, hàng `1fr` có thể co dưới kích thước tối thiểu của khung và phần tử tràn lên hàng nút. Đây là nguy cơ được xác định từ source, không phải bằng chứng đo pixel trực tiếp từ CI.

## Thay đổi
- Đổi track đầu thành `minmax(min-content, 1fr)` để tính chiều cao tối thiểu của khung.
- Giữ nguyên assertion `controlsTop >= frameBottom` để vẫn phát hiện lỗi bố cục thực tế. Bổ sung đo đồng thời hai rect và tọa độ/độ cao hàng grid trong thông báo lỗi.
- Thêm unit test đảm bảo cấu hình và assertion không bị bỏ.
- Không sửa API, dữ liệu Canvas, nghiệp vụ thanh toán hoặc logic slideshow.

## Xác minh bắt buộc
`npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser`. Kiểm tra màn hình 390px VI/EN, Reduced Motion bật và tắt; ba nút chọn mẫu luôn dưới khung và có thể bấm bằng touch/keyboard. Chưa xác nhận Playwright trên GitHub cho bản sửa này.
