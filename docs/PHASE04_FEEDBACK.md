# Phase 4.3C — Card, Badge, Modal & Toast

- Catalog dùng chung token màu, typography và layout cho nhãn loại thiệp, giá miễn phí/thu phí, metadata và trạng thái rỗng. Không thay đổi giá, bộ lọc, URL, artwork hoặc quyền mua mẫu. Giá thu phí vẫn là số tiền đã có, không tự gắn nhãn Premium.
- Hộp thoại app shell dùng `dialog-focus.js`: ưu tiên input khả dụng, loại điều khiển ẩn/disabled/inert khỏi danh sách, giữ Tab/Shift+Tab trong dialog, fallback vào dialog nếu không có điều khiển. Giữ cơ chế Escape, inert và trả focus hiện tại. Không đổi dialog native của Canvas. Auth giữ CSS riêng; hành vi focus chung vẫn được cải thiện.
- `feedback.js` tái sử dụng một toast, dùng `setText` và binding i18n, chỉ nhận bốn trạng thái success/error/warning/info. Success/info tồn tại 4,8 giây; error/warning 8 giây. Không thay đổi nghiệp vụ gọi toast. Warning/info đã có style và API nội bộ, chưa chuyển đổi các luồng nghiệp vụ sang hai loại này.
- Giữ live region polite, không đặt nút tương tác trong toast tự biến mất. Màu đi cùng icon và nội dung. CSS hỗ trợ reduced motion, safe-area và xuống dòng dài. Chưa chứng nhận WCAG cho toàn bộ ứng dụng.

## Nghiệm thu

```bash
node --test tests/unit/brand-feedback.test.mjs
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Browser smoke có thêm kiểm tra vòng focus hộp thoại QR trên mobile. Kiểm tra thêm Catalog VI/EN ở 320/390/768/1440px, trạng thái không có kết quả, tên mẫu dài, giá miễn phí/thu phí, QR, support, payment (QA), Escape và trả focus, nhiều thông báo liên tiếp, reduced motion và screen reader. Không dùng dữ liệu production. Kiểm tra Auth và Canvas không bị hồi quy; không thay đổi font asset, database, API hoặc thanh toán. Không thêm thư viện bên thứ ba.
