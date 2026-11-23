# Marketing Occasion Discovery V13 — Đường vào thư viện thiệp theo dịp

Ngày: 23/11/2026

## Mục tiêu

Người truy cập từ marketing trang chủ không cần mở trang Explore rồi chọn bộ lọc thủ công để tìm mẫu cho Sinh nhật, Đám cưới, Giáng sinh, Tết hoặc các dịp đang hiện hữu. Thêm các liên kết ngữ cảnh ngay phía trên danh sách mẫu nổi bật để giảm số thao tác từ trang chủ tới danh mục đã lọc.

## Phạm vi thay đổi

- Tạo module `web/js/features/marketing/occasion-shortcuts.js`: tính các nhóm dịp và số lượng từ mẫu hiện có, chọn tối đa 6 dịp, ưu tiên dịp đang trong mùa theo `vietnamDay()` và `isInSeason()`.
- Mỗi liên kết sử dụng **giá trị category gốc** cho `/explore?occasion=...`; đây là hợp đồng URL đang được `readCatalogUrl()` và `filterTemplates()` dùng. Không dùng nhãn tiếng Anh làm giá trị lọc.
- Chỉ hiện nhóm thuộc danh sách khóa dịch `templates.meta.category.*` có dữ liệu thực tế. Những danh mục tự do không có bản dịch vẫn có thể xem tại `/explore` qua liên kết danh mục đầy đủ.
- Thêm nhãn truy cập song ngữ: `home.featured.occasionBrowse` và `home.featured.occasionAction` (plural 1/other).
- Dùng chip liên kết tối thiểu 46px trên desktop và vùng cuộn ngang nội bộ trên mobile. Không ép toàn bộ trang phải cuộn ngang. Các biểu tượng sử dụng module Lucide hiện có, không dùng emoji.
- Không bổ sung API request, cookie, localStorage, dữ liệu tracking, migration hay thư viện ngoài.

## Kiểm thử

Chạy tại root dự án:

```bash
npm ci --include=dev
npm run build
npm run check
node --test tests/unit/marketing-occasion-discovery.test.mjs
node --test tests/unit/marketing-*.test.mjs tests/unit/template-order.test.mjs
npm test
npm run test:browser
npm run i18n:audit
```

### UAT / kiểm thử trực quan

1. Mở trang chủ ở 1440px, 1024px, 768px, 390px và 320px, cả VI và EN. Kiểm tra không tràn trang và các chip không che thẻ mẫu.
2. Từ trang chủ bấm một dịp có sẵn; URL phải là `/explore?occasion=<giá trị được URL-encode>`; bộ lọc dịp và danh sách phải đúng.
3. Đổi VI → EN → VI và kiểm tra nhãn đổi theo ngôn ngữ nhưng URL vẫn giữ mã dữ liệu gốc.
4. Bật chế độ Data Saver / reduced motion: các chip vẫn hiển thị và bấm được, không phụ thuộc animation.
5. Khi Catalog đang tải, lỗi hoặc trống: không xuất hiện số liệu giả; CTA **Xem thư viện mẫu** vẫn hoạt động.
6. Nếu Creator thêm category tự do chưa có bản dịch: không đưa category ấy lên dải marketing cho tới khi thêm khóa dịch, nhưng không khóa đường dẫn Explore hoặc API.

## Đánh giá chất lượng

- 7/7 bài unit test V13 đạt; toàn bộ test Marketing + template order 59/59 đạt.
- `scripts/quality/check-ui-i18n.mjs --check` và `scripts/quality/check-css-style.mjs` đạt.
- Toàn bộ unit test: 655 ca đạt, 6 file không khởi động do thiếu `sharp` trong môi trường kiểm tra; không phải assertion V13.
- `npm run build` và `npm run check` toàn phần không xác nhận được tại môi trường kiểm tra do thiếu `qrcode-generator` và `js-yaml` trong `node_modules`.
- Chưa có số đo chứng minh tăng conversion hoặc Core Web Vitals. Cần đo bằng instrumentation phù hợp sau khi phát hành; không thêm analytics tự động trong V13.
