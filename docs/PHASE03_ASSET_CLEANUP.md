# Phase 3.7C — Chuẩn hóa CSS và kiểm kê tài nguyên

## Phạm vi

- Quality Gate tự phát hiện toàn bộ file `.css` trực tiếp trong `web/css/`, kể cả file mới; kiểm tra descriptor `@font-face` và giữ phân biệt hoa/thường của custom property. Đây là bộ kiểm tra định dạng nhẹ, không thay thế parser CSS của trình duyệt.
- Tách khai báo viết dồn dòng trong artwork, components, gift, marketing, preferences, seasonal-catalog và sound-editor. Giữ selector, thứ tự rule, media query, thuộc tính và giá trị; không đổi font hay giao diện Auth.
- Không đổi package-lock, dependency, schema hoặc runtime backend. CSS production vẫn qua pipeline build/minify hiện tại.

## Kiểm kê chỉ đọc

```bash
npm run audit:assets
mkdir -p dist/reports
npm run --silent audit:assets > dist/reports/asset-audit.json
```

Báo cáo gồm số file, byte theo nhóm, nhóm SHA-256 trùng nhau và dung lượng lặp lý thuyết; kiểm tra checksum/kích thước của font trong `web/assets/fonts/app/manifest.json`. Bỏ qua `web/assets/app` (bundle sinh ra), đường dẫn bị loại theo release policy; từ chối symlink trong phạm vi quét. Không chạy trong production runtime, không tự động xóa hay sửa file. Exit code khác 0 nếu manifest font không khớp hoặc audit không hoàn thành. Số liệu không phải kích thước release ZIP, lưu lượng truy cập hay chi phí Railway.

Baseline ZIP sau PR #30 + Phase 3.7B: 653 file, 159.444.322 byte, 63 nhóm trùng SHA-256, 6.698.402 byte lặp lý thuyết; 11 font app khớp manifest. Không xóa các biến thể SVG `-catalog`/`-seasonal` hoặc đường dẫn VI/EN: cần xác minh builder, URL và tương thích trước khi deduplicate. Manifest không bao phủ mọi font Canvas/cover, không phải kiểm tra glyph hoặc license pháp lý toàn bộ.

## Dependency

Rà soát tham chiếu trong source/build/test: PayOS (payment providers), mysql2 (MySqlClient), sharp (xử lý ảnh), fabric (vendor build), qrcode-generator (QR build), fflate/read-excel-file (XLSX), acorn (AST), esbuild (bundling), eslint/globals/js-yaml (quality gate), jsqr/playwright (test và browser). Giữ cả 14 dependency/devDependency trực tiếp; tham chiếu không chứng minh toàn bộ phiên bản/transitive dependency tối ưu hoặc an toàn. Chạy `npm audit` khi có registry và lockfile đúng.

## Kiểm thử và triển khai

```bash
node --test tests/unit/css-style-quality.test.mjs tests/unit/asset-audit.test.mjs
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Nghiệm thu browser VI/EN, Auth, Catalog, Canvas và hộp thoại âm thanh trước khi upload frontend mới lên Hostinger. Không chạy migration; push main có thể kích hoạt redeploy Railway nếu bật auto-deploy.
