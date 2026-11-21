# Refund Queue (Beta) — hàng đợi đối soát yêu cầu hoàn tiền

## Mục đích

Admin có thể lọc và duyệt từng trang hồ sơ Refund Review đã có, thay vì chỉ thấy tối đa 50 yêu cầu mới nhất. Đây là hàng đợi **chỉ đọc**. Chức năng thay đổi trạng thái và ghi nhật ký vẫn dùng API `refund-requests/:requestId/transition` hiện có.

## API

`GET /checkout/payments/admin/refund-queue?filter=active&limit=20[&cursor=...]`

- `filter`: `active` (mặc định; gồm `submitted`, `in_review`, `awaiting_provider`), một trạng thái cụ thể, hoặc `all`.
- `limit`: mặc định 20, từ 1 đến 100; mọi tham số đều được kiểm tra trước khi thực thi SQL.
- `cursor`: token phân trang từ response trước, gắn với bộ lọc; không dùng offset. Token không chứa dữ liệu cá nhân nhưng không phải token cấp quyền.
- Response: `{ "page": { "requests": [...], "nextCursor": "..." | null } }`.
- Kiểm tra session và quyền `admin` tại server. Cấu hình lưu trữ `CHECKOUT_STORAGE=mysql` là bắt buộc.

API cũ `GET /checkout/payments/admin/refund-requests` vẫn hoạt động để bảo đảm tương thích ngược.

## Hạn chế cần lưu ý

- Dữ liệu nhiều trang là **hàng đợi vận hành thời điểm truy cập**, không phải snapshot bất biến. Nếu Admin khác thay đổi trạng thái hoặc có yêu cầu mới, nên làm mới trang để có danh sách cập nhật.
- Không thay thế kiểm tra MySQL thực tế, kiểm tra bảo mật API, quy trình hoàn tiền được nhà cung cấp xác nhận hoặc chi trả Creator.
- Không có chức năng cấp quyền rút tiền, hoàn tiền thật, sửa ledger, thu hồi quà hoặc thay đổi biên nhận.
- Theo dõi số hồ sơ chưa xử lý và xác nhận hiệu năng query/index khi dữ liệu lớn.

## Chạy kiểm thử

```bash
npm ci
npm run build
npm run check
node --test tests/unit/refund-review.test.mjs tests/unit/refund-queue.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
```

Kiểm thử giao diện `/admin/payments` với tài khoản Admin trong môi trường MySQL thử nghiệm. Kiểm tra lọc, trang trước/tiếp, trường hợp không có hồ sơ và việc không còn hồ sơ cũ bị ẩn khi vượt 50 yêu cầu.
