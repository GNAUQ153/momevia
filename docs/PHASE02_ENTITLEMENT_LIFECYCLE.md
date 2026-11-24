# Phase 2.3B — Vòng đời quyền sử dụng mẫu

## Phạm vi

- MySQL: thống kê **bản ghi entitlement**, không phải số người mua, số đơn hàng hoặc doanh thu. Đơn không có entitlement không được đếm trong báo cáo này. Nguồn được phân loại từ `orders.payment_provider`, `orders.is_test`; `live` là nguồn giao dịch ghi nhận, không phải kiểm chứng độc lập với nhà cung cấp. `unknown` cần đối soát.
- `active`: điều kiện kiểm tra quyền hiện hành; `revoked`: có `revoked_at`; `inactive`: còn lại, ví dụ đơn chưa thanh toán hoặc không khớp chủ/mẫu. Quyền free được quyết định riêng theo giá.
- JSON: `basis=legacy_orders`, chỉ là thống kê đơn, không chứng minh quyền đã thu hồi hay giao dịch thật. Chỉ `demo_paid/local_demo_only` được phân loại demo, còn lại unknown. Không dùng số liệu này để đối soát production.
- Không thu hồi quyền demo/sandbox lịch sử, không đổi giá, schema, số lượt xuất bản, dữ liệu thiệp, hay khóa giao dịch. `hasLicense` và transaction xuất bản vẫn cùng điều kiện cũ. Retry mua demo không được trả thành công nếu entitlement của đơn đó đã mất, bị thu hồi hoặc không hợp lệ; trả HTTP 409 thay vì tạo thêm quyền.

## API chỉ đọc

- `GET /api/checkout/licenses/:templateId/details`: session bắt buộc, phạm vi người dùng hiện tại và mẫu công khai. Không nhận `userId` từ client.
- `GET /api/checkout/admin/entitlements/summary`: session role admin bắt buộc; tổng hợp toàn bộ, không trả danh tính, ID đơn, payload, số tiền hay secret. Không cache. Chưa bổ sung dashboard GUI.
- Cả hai trả `basis`, `sources` (live, sandbox, demo, unknown; mỗi nguồn có active/revoked/inactive), `totals`. Endpoint theo mẫu trả thêm templateId/free/licensed. Endpoint quyền cũ giữ nguyên contract.

## Điều kiện trước khi thực thi chính sách chỉ quyền thật trên production

1. Đối soát báo cáo MySQL với đơn, receipt và thanh toán provider; xác minh nhóm unknown, demo/sandbox đang active.
2. `payment_checkout_keys` hiện có PK (user_id,template_id) không phân biệt môi trường thanh toán. Không tự xóa khóa sandbox/pending hoặc cấp lại quyền khi chưa kiểm chứng provider và trạng thái. Cần thiết kế chuyển đổi an toàn, bao gồm giao dịch đang chờ và hoàn tiền.
3. Quyết định chính sách bảo toàn quyền lịch sử với chủ sản phẩm. Khi đã chốt mới áp dụng tại mọi đường xuất bản, restyle, kiểm tra quyền và thanh toán; không làm mất quyền hợp lệ hoặc thu tiền lần hai.
4. Kiểm thử MySQL QA riêng, backup/restore và xác minh môi trường Hostinger/Railway. Không chạy fixture trên DB production.

## Kiểm thử

`node --test tests/unit/phase02-entitlement-lifecycle.test.mjs tests/unit/phase02-entitlement.test.mjs tests/unit/mysql-gifts-checkout.test.mjs`

`npm run test:canvas:mysql` dùng schema QA trống, cấu hình loopback rõ ràng theo script có sẵn; không dùng `.env` production. Ca tích hợp mới kiểm tra nguồn, quyền, thu hồi và retry trên MySQL thật khi CI chạy. Không cần migration hoặc dependency mới.
