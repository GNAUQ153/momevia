# Momevia — Visual System & CSS Quality V5

Ngày: 22/11/2026 · Baseline: Music Occasion V4, workflow CI/CD `45012202020` PASS.

## Mục tiêu

Chuẩn hóa các stylesheet giao diện chứa nhiều khai báo trên cùng một dòng, giảm sai sót khi chỉnh UI, giữ nguyên thứ tự cascade, cấu trúc selector, cách tải CSS, font và hiệu ứng hiện có.

## 1. Các file được chuẩn hóa

- `admin-library.css`: quản trị thư viện Canvas của Admin.
- `template-library.css`: trang chi tiết mẫu, hộp thoại xem trước.
- `editor-conflict-review.css`: xem lại xung đột phiên bản.
- `editor-recovery-center.css`: khôi phục bản nháp.
- `gift-runtime.css`: trải nghiệm mở quà của Recipient.
- `editor.css`: CSS lõi Canvas Editor.
- `upgrade.css`: các trang nâng cấp trước đây.

Bảy stylesheet có **2.237 khai báo CSS** sau khi cải thiện. Mọi rule/chỉ thị được giữ nguyên thứ tự. Các phần chỉ thay định dạng được so sánh bằng AST CSS (selector, thuộc tính, giá trị, `!important`, cấu trúc `@media` và `@keyframes`) trước/sau; không phát hiện thuộc tính trùng trong cùng rule.

## 2. Các thay đổi UI có chủ đích

- Template Preview mobile: nút từ **12px** lên **14px**; vẫn giữ min-height 44px.
- Admin Library: nhãn badge lên 13px, trạng thái lưu lên 13px, tab mobile 14px và cho phép xuống dòng khi chuỗi VI/EN dài.
- Admin Library mobile: thanh lưu có `env(safe-area-inset-bottom)` để tránh sát mép màn hình có vùng an toàn.
- Recovery Center: nút điều khiển đạt min-height **44px**.
- Conflict Review: chữ trạng thái lớp lên **14px**.

Các thay đổi được áp dụng trên cùng selector hiện có, không tạo thêm class hoặc quy tắc đè chồng. Vẫn dùng `--font-display` Plus Jakarta Sans, `--font-body` Inter và `--font-serif` Lora hiện hành; bản VI/EN dùng chung một stylesheet. Không thêm emoji, font hay thư viện.

## 3. Kiểm soát chất lượng tự động

Thêm `scripts/quality/check-css-style.mjs` vào `npm run check`:

1. Báo lỗi khi nhiều khai báo CSS trên cùng dòng hoặc selector và khai báo gộp cùng một dòng.
2. Báo lỗi thuộc tính lặp **trong cùng một rule**.
3. Không nhầm dấu chấm phẩy trong string, comment, data URL hoặc function CSS.
4. Không chặn selector được lặp tại **media query khác nhau**; cascade intentional phải được giữ.
5. Kiểm tra tính cân bằng dấu ngoặc/comment/chuỗi.

Công cụ hiện **chỉ giám sát 7 file đã chuẩn hóa**. Không khẳng định toàn bộ 46 stylesheet sạch; các file còn lại là technical debt cần xử lý theo đợt nhỏ. Bộ kiểm tra này cũng **không thay thế** công cụ phân tích CSS/browser engine hoặc kiểm toán độ tương phản tự động.

## 4. Hiệu năng và tương thích

Phép đo gzip cấp file trên bảy stylesheet: tổng trước **19.612 byte**, sau **19.613 byte** (không đáng kể). Không thêm thư viện, API, JS runtime hay request từ trang web. DOM, Canvas schema, thanh toán, nhạc theo dịp và session không thay đổi.

## 5. Kiểm thử bắt buộc trên máy phát triển

```bash
npm ci
npm run build
npm run check
node --test tests/unit/css-style-quality.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
npm run i18n:audit
```

Kiểm tra thủ công ở màn 320, 390, 768, 1024, 1440px: trang chủ, chi tiết mẫu, Canvas Designer, Admin Library, trang mở quà, Recovery Center, Conflict Review và Pricing. Với cả VI/EN, kiểm tra focus, chữ không bị cắt, các nút vừa vùng chạm, scroll panel, Safe Area và `prefers-reduced-motion`.

## 6. Giới hạn xác minh trong môi trường đóng gói

- `node --test tests/unit/*.test.mjs`: **578 PASS**, 6 file test không khởi động do thiếu `sharp`; không có assertion lỗi ở những bài test đã chạy.
- `npm run build` chưa hoàn tất vì thiếu `qrcode-generator`; `npm run check` chưa hoàn tất vì thiếu `js-yaml` (dependency chưa cài trong môi trường phân tích).
- Chạy trực tiếp kiểm toán VI/EN và `node scripts/quality/check-css-style.mjs`: PASS.
- CI/CD V5 và browser regression thực tế cần được xác minh sau khi áp dụng lên repo `main`.

## 7. Kế hoạch tiếp theo

Chuẩn hóa tiếp các module UI còn viết CSS dồn dòng (`ui-polish.css`, `editor-fabric` và các file còn lại) theo từng đợt, không thay hàng loạt selector khi chưa có visual regression. Sau đó nâng Marketing Motion theo budget hiệu năng và `prefers-reduced-motion`, không thay dữ liệu cá nhân hoặc thao tác thanh toán.
