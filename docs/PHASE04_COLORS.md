# Phase 4.2 — Hệ màu nhận diện

## Phạm vi

`web/css/tokens.css` là nguồn token màu dùng chung cho VI/EN. Màu hành động và màu trạng thái cũ giữ nguyên giá trị qua alias; các nền và chữ mới ưu tiên marketing. Tím đậm là CTA chính, chữ trắng; hồng và đào dùng trang trí hoặc đi với chữ tối. Các cặp màu trạng thái mới (success/warning/error/info) là bảng màu chuẩn để áp dụng dần ở component, chưa thay toàn bộ badge/alert hiện có.

- `marketing.css`, `marketing-immersive.css`, `marketing-journey.css`: nền Hero, section, CTA, bộ lọc theo dịp và bước hành trình.
- `open-me-website.css`, `open-me-system.css`: đồng bộ lớp cascade cuối, không để CTA quay về vàng cũ; giữ layout, chuyển động và hành vi hiện có. Tăng line-height cho tiêu đề có dấu tiếng Việt.
- `index.html`: đổi phiên bản URL CSS để giảm cache cũ khi triển khai. Không đổi font, file SVG/ảnh mẫu, dữ liệu Canvas, API, Auth dark theme, giá, thanh toán hoặc database.
- Không thêm thư viện, icon hoặc tài nguyên ngoài. Giữ các ghi nhận nguồn hiện tại trong THIRD_PARTY_NOTICES.md.

## Kiểm thử

```bash
node --test tests/unit/brand-colors.test.mjs
npm run fonts:check
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Kiểm thử màu dùng công thức tương phản WCAG trên cặp sRGB đục: tối thiểu 4.5:1 với chữ thường, 3:1 với viền điều khiển/focus đã chọn. Không chứng minh tất cả gradient, alpha, hover, overlay hoặc toàn bộ website đạt WCAG. Trước phát hành kiểm tra DevTools computed style (bao gồm cascade cuối), focus, hover và disabled ở cả VI/EN; kiểm tra Chrome Android/Safari iOS, desktop, 320/390/768/1440 px và zoom 200%. Kiểm tra Hero, CTA tạo thiệp, chuyển mẫu, danh mục, hành trình, modal và reduced-motion; so sánh thiệp fixture cũ. Không đổi nghiệp vụ hay dùng dữ liệu thật để kiểm thử.

Triển khai frontend đồng bộ sau CI và nghiệm thu giao diện, không chạy migration. Push main có thể kích hoạt redeploy Railway nếu đã bật auto-deployment.
