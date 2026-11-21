# Phase 6.5 – Marketing Depth & Motion Quality

## Mục tiêu

Bổ sung hiệu ứng ánh sáng tương tác theo vị trí con trỏ cho khung thiệp 3D trên trang chủ, đồng thời bảo vệ hiệu năng và khả năng truy cập. Không sử dụng thư viện bên ngoài, không thêm font hoặc emoji, không thay đổi nghiệp vụ tạo / gửi thiệp, Canvas Designer hay hệ thống VI/EN.

## Tệp được thay đổi

- `web/js/features/marketing/scene-motion.js`: giới hạn góc nghiêng và tọa độ hiệu ứng; gom các sự kiện pointermove vào một frame; hủy frame và trạng thái khi thoát, ẩn tab, giảm chuyển động hoặc chuyển trang.
- `web/css/marketing-immersive.css`: ánh sáng radial-gradient nằm trên nền nhưng phía sau nút xem thiệp; focus-visible cho bàn phím; vô hiệu hóa khi thiết bị cảm ứng hoặc reduced motion; chỉ bật will-change khi đang tương tác.
- `tests/unit/marketing-depth.test.mjs`: sáu bài kiểm tra mới về hình học, vòng đời, accessibility và CSS.

Không thay đổi chiều cao, padding, grid, hoặc breakpoint của Hero. CSS bổ sung nằm cuối file theo khối riêng, không làm mất phần sửa responsive trước đây.

## Giới hạn và kiểm thử

Trong môi trường tạo bản vá: `node --test tests/unit/marketing-depth.test.mjs tests/unit/marketing-motion.test.mjs` PASS 10/10; `node scripts/quality/check-locales.mjs` PASS 1.387 khóa VI/EN; `node --check` cho JS PASS.

Chưa thực hiện toàn bộ E2E Chromium của ứng dụng và full CI ở đây vì thiếu `node_modules` của dự án. Cần chạy trên máy developer và GitHub Actions trước commit/release:

```bash
npm run build && npm run check && npm test && npm run test:browser && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

QA thủ công tại 1614, 1440, 1024, 820, 768, 390 và 320 px, với VI/EN, bàn phím, chuột, cảm ứng và `prefers-reduced-motion`. Kiểm tra nút xem trước, focus ring, CTA, ảnh thiệp và khoảng cách Hero–Featured; kiểm tra chuyển tab và chuyển route trong lúc hiệu ứng đang chạy.

## Lưu ý tích hợp

Bộ cài chỉ nhận hai phiên bản CSS đã biết: nguồn từ ZIP được cung cấp hoặc bản đã qua `Momevia_UI_Fix`. Nếu đồng đội tiếp tục sửa file, bộ cài từ chối thay vì ghi đè; cần hợp nhất thủ công. Không commit thư mục backup.
