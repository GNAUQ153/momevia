# Phase 3.4E — Hồi quy kiến trúc Frontend

Baseline: `445c892` (ZIP sau PR #29, gồm Phase 3.4D).

## Thay đổi có phạm vi hẹp

- Featured Carousel không chủ động preload thẻ kế tiếp khi điều kiện chạy không thỏa mãn (ví dụ Save-Data, Reduced Motion, tab ẩn, offscreen, focus bàn phím).
- Bỏ qua callback IntersectionObserver đến sau dispose; dispose idempotent, không tạo timer hoặc đổi thứ tự DOM sau hủy.
- Không thay đổi chu kỳ 5 giây, hiệu ứng 650 ms, cấu trúc thẻ, phiên bản mẫu, API, giá, CSS, font, i18n hoặc schema. Không đăng ký ba mẫu Open Me mới vào catalog.
- Không hủy request ảnh hoặc decode đã bắt đầu; không thay đổi cover loader chung. Trình duyệt vẫn có thể tải ảnh hiển thị theo cơ chế hiện hành.

## Ma trận nghiệm thu

| Nhóm | Kiểm thử | Điều kiện đạt |
| --- | --- | --- |
| Architecture | `npm run check:architecture` | Không có cycle hoặc cạnh vi phạm mới |
| Action dispatcher | `phase03-action-dispatcher.test.mjs` | Handler, alias và guard checkout nhất quán |
| Canvas | `phase03-designer-events`, `phase03-designer-panels`, `canvas-editor`, `canvas-clipboard`, `canvas-tab-sync` | Selection, undo/redo, mutation và đồng bộ không hồi quy |
| Lifecycle | `phase03-editor-lifecycle`, `phase03-frontend-regression` | Hủy tài nguyên đúng vòng đời, không mount muộn hoặc callback cũ |
| Carousel | `featured-carousel`, `phase03-frontend-regression`, `tests/browser/featured-carousel.mjs` (qua `test:browser`) | Thẻ thật, giữ DOM, focus, timer, motion preference |
| Mẫu Open Me | `open-me-templates`, `open-me-catalog` | Schema, binding, sự kiện và trạng thái catalog nhất quán |
| i18n/CSS | `npm run check` | Kiểm tra VI/EN và quy tắc CSS |
| Browser | `npm run test:browser`, `npm run test:canvas:browser`, `npm run test:sfx` | Kiểm tra trên browser thật, gồm các luồng editor và marketing |

## Cách kiểm tra

```sh
node --test tests/unit/phase03-frontend-regression.test.mjs
npm run check:architecture
npm run build && npm run check && npm test
npm run test:architecture && npm run test:browser && npm run test:canvas:browser && npm run test:sfx
```

Chỉ chạy integration trên môi trường local/QA, không dùng MySQL production. Test vòng đời mới dùng DOM/timer/observer fixture, không đo heap, CPU, network hoặc WCAG đầy đủ. Cần kiểm tra trên trình duyệt thật và lưu baseline hiệu năng trước khi triển khai. CI PASS không đồng nghĩa với nghiệm thu mọi thiết bị, giao dịch Live hay release production.

## Các bước còn lại

- Kiểm tra mobile, chuyển đổi VI/EN, điều hướng bàn phím, reduced motion và tiêu thụ tài nguyên thực tế; bổ sung cơ chế dừng carousel chủ động nếu cần để đáp ứng accessibility.
- Hoàn tất kiểm thử tích hợp và trình duyệt trước khi build một bản frontend đồng bộ cho Hostinger.
- Không bật các cờ QA hoặc sửa dữ liệu tài chính production.
