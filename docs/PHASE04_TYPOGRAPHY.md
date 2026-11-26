# Phase 4.1 — Typography

- Heading: Bricolage Grotesque (normal 400–800); body: Be Vietnam Pro (normal 400/500/600/700/800, italic 400/600); artistic: Fraunces (normal/italic 400–800).
- Tải các subset latin, latin-ext, vietnamese từ Google Fonts và OFL 1.1 từ kho google/fonts. Các nguồn và SHA-256 được ghi trong manifest; không sửa binary gốc. Font cũ được giữ cho Canvas và fallback.
- Tách token UI và token nội dung Canvas. Không sửa schema, preset, SVG, tài liệu đã lưu, file Lora cover hoặc Fabric font mapping. Chưa nghiệm thu pixel parity cho mọi thiệp.
- Tiêu đề marketing dùng font display, đoạn ví dụ dùng artistic; tăng line-height cho dấu tiếng Việt. Chưa thay màu hay bố cục Auth.

## Cài đặt trên máy phát triển (chỉ thực hiện một lần)

```bash
npm run fonts:install
npm run fonts:check
npm run audit:assets
```

Cần mạng đến fonts.googleapis.com, fonts.gstatic.com và raw.githubusercontent.com. Không tải mạng trong CI/build/runtime. Nếu lỗi tải, dừng; không bỏ qua gate. Kiểm tra `git status`; commit CSS sinh ra, manifest, WOFF2 và OFL cùng patch. Không sửa tên file thủ công. Nếu lỗi ghi đĩa giữa chừng, khôi phục riêng các file font/CSS/manifest phát sinh theo diff rồi chạy lại. Lần cài đầu chọn phiên bản hiện tại từ nguồn chính thức; các lần build dùng snapshot đã commit, không tự cập nhật phiên bản.

```bash
node --test tests/unit/app-typography.test.mjs tests/unit/brand-system.test.mjs tests/unit/auth-layout-v7.test.mjs tests/unit/client-loading.test.mjs
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

## Nghiệm thu thủ công trên local/QA

- Kiểm tra DevTools Network: không có request Google Fonts khi sử dụng UI; không có 404 font. Kiểm tra Rendered Fonts cho heading/body/artistic có dấu thực tế (Đường phố, Ấm áp, Ừ, ễ, ộ, ự, ỹ).
- Trang chủ, Catalog, Pricing, Login/Register, Sender, Recipient, Creator, Admin ở VI/EN; viewport 320/390/768/1024/1440 px; zoom 200%; không cắt dấu, tràn chữ hoặc mất CTA. So sánh với PR #30, giữ dark Auth và responsive.
- Mở bản nháp và thiệp đã xuất bản bằng fixture QA, so sánh kích thước/dòng chữ và lựa chọn font trong inspector; không ghi dữ liệu production. Đo LCP/CLS trước/sau và kiểm tra fallback khi font lỗi.
- Kiểm tra công cụ offline xác minh header WOFF2, checksum, OFL, manifest, CSS và phạm vi Unicode khai báo, không chứng minh cmap/glyph hoặc hình dáng dấu trong browser. Fixture test không phải font thật.

## Triển khai

Sau khi CI PASS và QA giao diện đạt, dùng gói frontend đầy đủ (CSS đã build, assets/fonts và manifest) theo quy trình Hostinger hiện tại. Không cần migration, biến môi trường mới hay thay đổi MySQL. Push main có thể kích hoạt Railway redeploy theo cấu hình hiện có.
