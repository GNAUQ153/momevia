# Phase 4.3B — Điều khiển tương tác

## Phạm vi

- Dùng token chiều cao 48px, radius 12px, padding/gap và focus chung cho nút Catalog/Pricing, trường tìm kiếm, select và bộ lọc nâng cao. Giữ CTA Hero hiện tại, bổ sung focus và giảm chuyển động. Không áp quy tắc mới cho Auth, Canvas hay Recipient.
- Search/select dùng `max(16px, 1rem)` để chữ không nhỏ hơn 16px tại viewport nhỏ; nút xóa có vùng tương tác 44×44px. Placeholder dùng màu muted; viền điều khiển dùng token đã kiểm tra tương phản ở Phase 4.2.
- Nút xóa từ khóa dùng SVG icon hiện có, nhãn i18n VI/EN và thuộc tính disabled thực sự. Không đặt button bên trong label. Khi xóa, giữ bộ lọc, đưa phân trang về 1, trả focus cho search và gọi commitCatalogFilters để đồng bộ kết quả và URL. Nút reset bộ lọc cũ và CTA empty-state giữ nguyên nghiệp vụ. Không thay API, giá, quyền hạn hay tài liệu Canvas.
- Dùng `open-me-system.css` ở cuối cascade vì đã thuộc cả bundle catalog và bundle đầy đủ. Không thêm thư viện hoặc stylesheet khác theo locale. Không dùng emoji. Font và OFL không đổi.

## Nghiệm thu

```bash
node --test tests/unit/brand-controls.test.mjs tests/unit/phase03-action-dispatcher.test.mjs
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Browser scenario trong `tests/browser/home.mjs` kiểm tra xóa search, giữ Free, focus, disabled và query URL. Nghiệm thu local/QA ở 320, 390, 680, 768, 900, 1024, 1440px, cả VI/EN; mở bộ lọc nâng cao, nhập từ khóa có dấu/không dấu, xóa, reset, reload, quay lại catalog. Kiểm tra focus bằng Tab, Enter/Space, reduced motion, zoom 200%, iOS Safari và việc không tràn ngang. So sánh Auth/Canvas với bản trước. Chưa coi kiểm tra tĩnh CSS là chứng nhận WCAG hay kiểm thử UI thật.

Phase này chưa chuẩn hóa form chuyên dụng của Creator/Admin, chưa đổi Card/Modal/Toast, không thêm loading handler toàn cục vì mỗi nghiệp vụ có cơ chế bất đồng bộ riêng. Không migration. Push main có thể kích hoạt Railway redeploy nếu cấu hình Auto Deployment.
