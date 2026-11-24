# Phase 2.4B4 — Mua thêm lượt xuất bản (QA)

## Phạm vi

- Baseline: bản ZIP main sau PR #27; không thay đổi các module chuyển động, thư viện element hoặc CTA nổi.
- Chỉ mở khi `PUBLICATION_QUOTA_QA_ENABLED=true`, `PAYMENT_SCOPED_CHECKOUT_ENABLED=true`, MySQL QA cô lập và MoMo Sandbox khả dụng. Giữ cả hai cờ tắt trên production. Không dùng credential hoặc tunnel Railway.
- Migration 019 bổ sung bảng `publication_repurchases` sau 017/018. Không sửa khóa cũ, không backfill, không thu hồi quyền cũ. Cần migration đầy đủ trên QA trước khi thử.

## Nghiệp vụ

1. Khi đã tiêu hao một credit từ đơn MoMo Sandbox còn hiệu lực, và không còn quyền khác, backend có thể đề xuất ID đơn đã dùng.
2. `GET /api/checkout/payments/repurchase/:templateId` yêu cầu session, trả `{previousOrderId: null | string}`. Chỉ đọc đơn của session hiện tại. `/payments/methods` chỉ thêm `repurchaseAvailable: true` khi cấu hình QA cho phép.
3. `POST /api/checkout/payments/create` hỗ trợ `previousOrderId` tùy chọn. Thiếu trường này giữ hành vi cũ. Có trường này phải là UUID, MoMo Sandbox và đúng scope QA.
4. Transaction khóa user, kiểm tra đơn gốc thuộc user/mẫu, đã thanh toán, credit đã dùng, chưa thu hồi. Nếu có liên kết từ đơn gốc, trả đúng intent cũ. Nếu chưa có, kiểm tra không còn quyền hoặc đơn pending khác, tạo order/intent mới và liên kết trong cùng transaction.
5. Mỗi đơn gốc có tối đa một intent mua tiếp; retry cũ kể cả sau khi tiêu hao lượt mới không được tạo thêm đơn. Đơn đã kết thúc vẫn bị chặn ở service. Không tự giải phóng pending theo timeout.
6. Webhook đã xác thực cấp credit theo Phase 2.4B3. UI dùng cùng form Checkout Canvas/Legacy và giữ context thiết kế, không thay đổi layout/animation. Khi đã tiêu hao lượt mới, backend đề xuất đơn mới làm khóa lần mua sau.
7. Link provider được gộp trong cùng backend process cho lần mua thêm. Retry sau mất ACK vẫn sử dụng mã order/request cũ; chưa chứng minh tính exactly-once tại provider qua nhiều process hoặc mất kết nối. Không chạy giao dịch thật trong QA.

## Kiểm thử

- `node --test tests/unit/phase02-repurchase.test.mjs`
- `npm run build`, `npm run check`, `npm test`, `npm run test:canvas:browser`
- `npm run test:canvas:mysql` chỉ trên schema QA trống theo guard hiện có. Fixture bổ sung cạnh tranh hai pool, cấp credit sau webhook, retry sau tiêu hao và mua lần ba.

## Giới hạn

Không hỗ trợ mua thêm với JSON demo, quyền demo local đã tiêu hao, Live payment, hủy đơn pending, hoàn tiền hay quyền lịch sử không giới hạn. Không áp dụng quota production hoặc tự động chạy migration Railway. Nghiệm thu MySQL/Browser/provider Sandbox trước khi xem xét release. Không xóa bảng 019 để rollback sau khi có dữ liệu; tắt cờ QA và giữ lịch sử đối soát.
