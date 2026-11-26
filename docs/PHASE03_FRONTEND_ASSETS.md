# Phase 3.6D — Vòng đời tải ảnh Frontend

## Phạm vi

- `cover-loading.js`: kiểm tra ảnh còn thuộc root trước khi gán src/srcset; bỏ callback cũ khi dispose; không ghi đè ưu tiên của ảnh đã được Carousel tải chủ động. MutationObserver loại ảnh đã rời root hoặc không còn marker lazy trước khi theo dõi ảnh mới.
- `catalog-bootstrap.js`: bỏ preload dự đoán khi Save-Data hoặc prefers-reduced-data bật. Dữ liệu Catalog bootstrap vẫn còn để ứng dụng sử dụng, không chặn ảnh hiển thị hoặc yêu cầu API thông thường.
- Giữ 100px rootMargin, năm kích thước ảnh, bản dịch thuộc tính ảnh, revision, bố cục, hiệu ứng, font đang sử dụng và fallback khi không có IntersectionObserver. Không đổi backend, API, schema, dependency hay dữ liệu người dùng.

## Kiểm thử

```bash
node --test tests/unit/cover-loading.test.mjs tests/unit/client-loading.test.mjs tests/unit/phase03-frontend-regression.test.mjs
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Đo trên local/QA bằng `npm run perf:marketing` (website local đã chạy tại cổng phù hợp; mặc định 4100). Đối chiếu trước/sau cùng viewport, locale, cache và điều kiện mạng. Dùng Network trên trình duyệt để kiểm tra chuyển route nhanh, bộ lọc Catalog, Carousel, và thay đổi VI/EN; với Save-Data, ảnh cần hiển thị vẫn phải tải. Không chạy load test trên production. Kiểm tra thêm LCP/CLS/INP trên thiết bị thực trước khi kết luận cải thiện.

Không cam kết giảm băng thông, CPU/RAM hay Core Web Vitals khi chưa đo. Không hủy download đã bắt đầu. Việc đổi typography sang Bricolage Grotesque / Be Vietnam Pro / Fraunces thuộc Phase 4, cần nghiệm thu glyph, giấy phép và bố cục riêng.
