# Momevia — Marketing UI v1 (2026-11-18)

## Mục tiêu

Xây dựng trang chủ có độ nhận diện cao, dễ chuyển đổi sang khám phá mẫu, nhưng minh bạch về phạm vi MVP/Beta. Trang chủ mới **không** tự nhận có lượt tải, đánh giá, số giao dịch, thương hiệu đối tác hay doanh thu chưa có bằng chứng.

## Các thay đổi

| File | Vai trò |
|---|---|
| `web/js/pages/home.js` | Trang chủ: lợi ích cốt lõi, demo tính năng, FAQ, lời kêu gọi hành động |
| `web/css/marketing.css` | Design tokens cục bộ, các section marketing, animation, focus states |
| `web/css/marketing-mobile.css` | Breakpoint 1050/760/520/360px để tránh CSS dồn một chỗ |
| `web/index.html` | Tải CSS theo thứ tự, giữ Google Fonts và fallback font hệ thống |
| `web/js/pages/payment-status.js` | Thông tin trạng thái thanh toán cho người mua, không chứa logic ghi tiền |
| `web/css/payment.css` | Bố cục thanh toán, alert, nút đối soát, bản in |
| `web/js/app/main.js` | Kết nối component thanh toán vào route `/payment-result/:id` |
| `web/js/ui/icons.js` | Ghi nguồn và giấy phép icon chính xác hơn |
| `tests/unit/marketing-home.test.mjs` | Test nội dung, accessibility, fallback mẫu, CSS tổ chức rõ |
| `tests/unit/payment-status-ui.test.mjs` | Test hành động read-only/đối soát, escape HTML và cảnh báo |
| `scripts/docs/log-ui.mjs` | Ghi mục Unreleased idempotent để README Auto Sync cập nhật đúng |
| `tests/unit/marketing-log.test.mjs` | Kiểm tra script không ghi CHANGELOG trùng |

### Quy chuẩn code

- Tên file ngắn, thể hiện nhiệm vụ; lớp marketing có prefix `mkt-` để hạn chế va chạm.
- Mỗi thuộc tính CSS có một dòng riêng, nhóm section theo block comment tiếng Việt.
- JavaScript bổ sung theo ES Modules, không thay framework, không phát sinh npm dependency mới.
- Icon SVG đồng bộ kích thước qua `icon()` có `aria-hidden="true"`; không dùng emoji.
- Chữ tiếng Việt viết UTF-8 với fallback `system-ui/Arial`; không giả định CDN fonts luôn hoạt động.
- Mobile tối thiểu kiểm tra 320, 390, 768, 1440 px; không tràn chiều ngang; 44px là kích thước mục tiêu tương tác khuyến nghị.
- FAQ dùng `<details>`/`<summary>` có thể hoạt động mà không cần JS.
- Giữ `prefers-reduced-motion`; hiệu ứng chỉ hỗ trợ truyền tải hình ảnh, không ảnh hưởng nghiệp vụ.
- Các nút điều hướng phải đi đúng route và giữ thuộc tính `data-link` của SPA.

## Open source, ghi nguồn và tuân thủ license

**Không tích hợp MUI hoặc Font Awesome** trong bản này vì frontend dùng HTML/CSS/vanilla JS và đã có icon SVG.

1. **Lucide SVG icons**, nguồn https://lucide.dev/license — giấy phép **ISC** cho Lucide, và **MIT** với một số icon kế thừa Feather. Tác giả/credit: Lucide Icons and Contributors; Feather icons: Cole Bemis. Trong source, các path SVG hiện được duy trì ở `web/js/ui/icons.js`. Khi phân phối lại, bảo lưu thông báo copyright và nội dung giấy phép tương ứng.
2. **Plus Jakarta Sans, Inter và Lora**, tải qua Google Fonts trong `web/index.html`. Các font này thuộc **SIL Open Font License 1.1**, xem thông tin license từ Google Fonts / Google Fonts GitHub. Không đóng gói font binary; nếu sau này self-host cần kèm license và kiểm tra subset tiếng Việt.
3. **Mã QR** giữ thư viện `qrcode-generator` đang có trong project (MIT), thông báo nguồn tại `docs/licenses/qrcode-generator-MIT.txt`.

Bản sửa không bổ sung thư viện hoặc tài nguyên ngoài mới. Các hình quà minh họa mới tạo bằng CSS và SVG nguồn đã có; không sử dụng ảnh stock có watermark.

## QA và giới hạn

- `node --test tests/unit/marketing-home.test.mjs tests/unit/payment-status-ui.test.mjs tests/unit/marketing-log.test.mjs tests/unit/web-views.test.mjs tests/unit/pricing-ui.test.mjs`
- Sau khi áp dụng patch, chạy `node scripts/docs/log-ui.mjs` rồi stage `CHANGELOG.md` cùng code mới. README Auto Sync lấy mục Unreleased này sau khi CI xanh.
- Chạy Full CI do project yêu cầu và kiểm thử thật trên Chrome/Firefox/Safari, Android/iOS, tốc độ chậm và trình đọc màn hình trước khi mở marketing công khai.
- Kiểm tra anchor `/#how-it-works`, `/explore`, `/creator`, `/pricing`, `/about` và `/payment-result/:id`.
- Kiểm thử font tiếng Việt sau khi CDN bị chặn; không tự tải font khác mà chưa xác nhận giấy phép.
- Kiểm tra ảnh preview chính xác từ dữ liệu thật của thư viện mẫu, không chỉ từ fixture test.
- Các file CSS cũ có thể còn cú pháp một dòng; bản sửa **chỉ áp dụng chuẩn format mới** cho file mới, chưa refactor toàn bộ legacy CSS.
