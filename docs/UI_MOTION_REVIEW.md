# Momevia — UI Motion & Static Security Review

Nguồn tham chiếu: `Momevia_Main_Latest_20261120(1).zip` do chủ dự án cung cấp ngày 20/11/2026.

## Mục tiêu và phạm vi thay đổi

- Nâng cấp phần giới thiệu trang chủ thành bố cục giàu chiều sâu (CSS perspective, nổi lớp, ambient gradient), có tương tác chuột với giới hạn góc nhỏ.
- Duy trì **một giao diện DOM duy nhất** cho tiếng Việt/Anh: các chuỗi có sẵn dùng `text(...)` hoặc `attr(...)` thay vì tự tạo 2 bố cục.
- Hỗ trợ `prefers-reduced-motion`, bàn phím, mobile và fallback khi không có JavaScript/IntersectionObserver.
- Giữ nút xem thử và đường dẫn CTA thực tế, không thêm số liệu marketing giả hoặc phụ thuộc 3D từ xa.
- Bổ sung kiểm tra tệp thường trong static server và xử lý lỗi stream đọc file; không thay đổi auth, DB, payments hoặc contract API.
- Thay glyph emoji cũ ở sticker/interaction/control bằng đường vector nội bộ hoặc ký hiệu hình học đơn sắc; giữ nguyên ID và schema của Canvas.

## File thay đổi

| File | Vai trò |
| --- | --- |
| `web/js/pages/home.js` | HTML ngữ nghĩa cho hero marketing, CTA, lợi ích thật và thẻ thiệp demo |
| `web/js/features/marketing/scene-motion.js` | Hiệu ứng nghiêng nhẹ bằng mouse và hiển thị section khi cuộn, có cleanup |
| `web/css/marketing-immersive.css` | Visual 3D giả lập với CSS, responsive và reduced-motion, mỗi thuộc tính một dòng |
| `web/js/app/main.js` | Mount/dispose hiệu ứng theo vòng đời route |
| `web/index.html` | Tải CSS mới sau các stylesheet cũ |
| `src/gateway/static.mjs` | Chặn đường dẫn thư mục/symlink thoát web root, bắt lỗi đọc stream |
| `docs/THIRD_PARTY_NOTICES.md` | Sửa ghi nhận license Lucide (ISC) |
| `web/js/shared/canvas/artwork.js`, `registry.js`, `interactions.js` | Đường vẽ vector sticker legacy và loại ký tự emoji |
| `web/js/features/gift-runtime/renderer.js` | Dùng vector có sẵn cho nút mở phong bì/hộp quà |
| `tests/unit/icon-consistency.test.mjs` | Test vector legacy và ký tự icon |
| `tests/unit/marketing-motion.test.mjs` | Test cấu trúc trang chủ, bilingual keys, motion và CSS |
| `tests/unit/static-security.test.mjs` | Regression test GET thư mục (404) và tệp hợp lệ (200) |

## Kết quả QA đã thực hiện trong môi trường phân tích

- Node.js `--check` cho các tệp JS sửa đổi: thành công.
- `node --test` cho marketing cũ/mới, static security và web views: **20/20 PASS**.
- Gói ZIP được kiểm chứng đúng định dạng, không chứa `.env` vận hành hay `services/**/data/`.
- Chưa chạy Full CI / Playwright thật: môi trường phân tích không hoàn tất `npm ci`. **Không được coi test thủ công và full regression là đã PASS.**

## Giới hạn, an toàn dữ liệu

- Đây là 3D bằng CSS, **không phải Spline/WebGL scene thực**. Có ưu điểm không tải scene lớn, không cần third-party runtime, giảm rủi ro vận hành.
- Nội dung sử dụng chính bản mẫu đang có của Momevia, không sao chép website tham khảo.
- Không sửa toàn bộ Studio, Designer, gift runtime hoặc màn hình Admin trong patch này. Những trang đó cần một đợt UI/UX riêng có kịch bản QA theo từng vai trò.
- Cơ chế nâng cấp kiểm tra hash của tệp gốc; nếu Lộc đẩy code mới khiến khác bản tham chiếu, installer từ chối ghi đè.

## Nguồn tham khảo và giấy phép

- [Chung Đôi](https://chungdoi.com/vi/help/cach-tao-thiep-cuoi-online): tham khảo hành trình chọn mẫu → nhập thông tin → xem thử → gửi, không dùng ảnh/code của họ.
- [Webflow × Spline](https://webflow.com/made-in-webflow/spline): tham khảo cách xây dựng chiều sâu, foreground/background, chuyển động khi tương tác, không tích hợp asset có bản quyền.
- [One Page Love](https://onepagelove.com/): tham khảo nhịp kể chuyện landing page, cấp bậc tiêu đề và CTA.
- [Web.dev animation performance](https://web.dev/articles/animations-guide): ưu tiên `transform`/`opacity` và tôn trọng `prefers-reduced-motion`.
- [Lucide Icons](https://lucide.dev/license): ISC, tiếp tục dùng SVG đã có trong source; một số icon có nguồn Feather/MIT. **Không bổ sung dependency khác**, không chép icon/font từ bên ngoài.

## Checklist trước khi merge

1. `git status -sb` và `--check` để tránh ghi đè code đồng đội.
2. Cài bản patch; chạy unit, build, check, browser tests, packaging và GitHub CI.
3. QA trên 320 / 390 / 768 / 1024 / 1440px, bao gồm tiếng Anh có chữ dài, tab focus, reduced motion.
4. Đảm bảo nút preview mở đúng demo và điều hướng bằng `data-link` không bị ảnh hưởng.
5. Kiểm tra CSP, scan dependency, SEO, LCP/CLS/INP và thiết bị thật trước public marketing.
