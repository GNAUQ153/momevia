# Phase 2.3A — Kiểm soát cấp quyền mẫu

- `GET /api/checkout/licenses/:templateId` yêu cầu đăng nhập, lấy người dùng từ session, chỉ trả `{ templateId, free, licensed }`. Không cho truy vấn quyền của user khác. Mẫu không công khai trả lỗi theo Catalog.
- Mẫu miễn phí không cần đơn hàng. Mẫu trả phí kiểm tra `CheckoutService.hasLicense` (MySQL: entitlement chưa thu hồi và đơn tương ứng; JSON: lịch sử đơn của môi trường thử nghiệm).
- `POST /api/checkout/orders/demo-purchase` và thông báo `demoPurchaseAvailable` sử dụng cùng chính sách: `DEMO_AUTH_ENABLED=true`, `DEMO_TEMPLATE_CHECKOUT_ENABLED=true`, không production, không bật `PAYMENT_ENABLED` hoặc `PAYMENT_LIVE_ENABLED`. Không đổi cấu hình production để bật demo.
- Form tạo thiệp legacy chỉ hiển thị CTA mua thật/mua demo khi API xác nhận khả dụng; nếu không đọc được quyền thì không suy đoán. Canvas tiếp tục dùng preflight có sẵn và backend vẫn xác minh quyền khi xuất bản.
- Không hồi tố quyền đã cấp, không thay đổi schema, giao dịch, số dư hoặc snapshot. Các entitlement demo/sandbox cũ chưa được phân loại lại; cần rà soát dữ liệu test trước khi đặt chính sách production. Chưa áp dụng giới hạn một lượt xuất bản; phải chốt chính sách quyền cũ trước khi đổi.
- Triển khai backend trước frontend mới; frontend legacy mới không cho mua khi endpoint chưa có. Không bật thêm Railway service.

## Kiểm thử
- `node --test tests/unit/phase02-entitlement.test.mjs`
- `npm run build && npm run check && npm test`
- `npm run test:architecture` và `npm run test:canvas:browser` (fixture độc lập, không dùng production).
