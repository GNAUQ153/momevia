# Momevia V14 — Preview to Create

## Mục tiêu

Giảm thao tác giữa xem thử và tạo thiệp: người dùng có thể chọn **Dùng mẫu** ngay trong hộp thoại xem thử trên trang chủ và trang chi tiết. Không đổi giao diện tổng thể hoặc API, không thêm hình/nhạc và không tạo request ghi dữ liệu khi xem thử.

## Phạm vi

- `templateCreateUrl(template)` là hàm thuần trả về route `/create/{id}?mode=quick` và tùy chọn `&version={versionId}`; mã hóa từng thành phần URL.
- `templatePreviewDialog()` hiển thị CTA dùng mẫu, dùng lại `catalog.detail.use` có bản dịch VI/EN.
- `mountTemplatePreview()` cập nhật `href` theo `activeTemplate = getTemplate()` **mỗi lần mở**. Tránh lỗi hero đang hiển thị mẫu thứ hai/thứ ba nhưng CTA lại trỏ về mẫu đầu.
- `catalog.js` dùng chung helper tạo URL cho nút ở trang chi tiết.
- Toolbar của preview có liên kết cao tối thiểu 44px, focus rõ và tự xuống dòng khi thiếu chiều rộng.
- Không thay đổi role, payment, Auth/Zalo, runtime âm nhạc, versioning hay dữ liệu Canvas.

## Kiểm thử

Từ thư mục gốc repo:

```bash
npm ci --include=dev
npm run build
npm run check
node --test tests/unit/template-preview-create-v14.test.mjs tests/unit/css-style-quality.test.mjs
npm test
npm run test:browser
npm run i18n:audit
```

### UAT bắt buộc

1. Trang chủ: chọn từng slide `hai-phong-bi`, `birthday-radiance`, `proud-of-you`, mở xem thử và kiểm tra link `Dùng mẫu` trỏ đúng ID.
2. Trang chi tiết mẫu Creator có `versionId`: preview phải giữ đúng `version` khi mở Designer.
3. Người dùng chưa đăng nhập: bấm CTA mở luồng login, sau khi login trở lại mẫu đang chọn.
4. Người dùng đã đăng nhập: bấm CTA chuyển sang Quick Designer đúng mẫu (không tạo nháp khi chưa bấm CTA).
5. VI/EN, 390px/768px/1440px: nhãn dịch đúng, link hiển thị và sử dụng được bàn phím, modal Escape/Close trả lại focus.
6. Không có POST API khi chỉ xem thử; không thay đổi Canvas JSON.

## Trạng thái xác minh trong môi trường kiểm tra

- 10/10 unit test V14 mới đạt; cùng test CSS liên quan đạt 17/17.
- Bộ unit test toàn source: 665 ca đạt, 6 file chưa khởi động được vì thiếu `sharp` và/hoặc dependency build trong bản sao này. Đây không phải xác nhận toàn bộ kiểm thử production.
- Kiểm toán CSS và Designer/App Shell i18n đạt.
- `npm run check` bị chặn bởi `js-yaml`; `npm run build` bị chặn bởi `qrcode-generator` trong môi trường kiểm tra. Cần xác nhận CI/CD sau khi áp dụng.

## Kiến trúc và an toàn

Route `/create/` đang có kiểm soát `requireLogin` và load Designer ở client, các API server vẫn là lớp phân quyền bắt buộc. CTA dùng anchor có `data-link` (điều hướng SPA), không gọi trực tiếp API ghi. Không thêm tracker hay gửi dữ liệu người dùng ra ngoài.
