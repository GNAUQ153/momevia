# Phase 2.4B2 — Khóa checkout theo môi trường

## Phạm vi

- Migration `017_payment_scope_keys` chỉ tạo bảng mới, có khóa chính `(user_id, template_id, is_test)` và unique intent. Không xóa/sửa bảng cũ, không backfill hoặc thu hồi entitlement.
- `PAYMENT_SCOPED_CHECKOUT_ENABLED=false` (mặc định): luồng tạo checkout giữ nguyên và không cần bảng 017. Khi bật, repository kiểm tra marker migration trước mọi ghi dữ liệu, khóa hàng users theo chủ tài khoản, đọc cả khóa theo scope và khóa lịch sử, kiểm tra owner/template/scope của đơn, rồi tạo order + intent + khóa trong cùng transaction. Giữ anchor cũ cho lần mua đầu để runtime cũ không tạo lại đơn khác. Không giải phóng khóa pending theo thời gian.
- Checkout cùng scope tiếp tục trả intent cũ; khác scope có thể tạo intent độc lập nếu chưa có khóa cho scope đó. Chính sách `PaymentService.hasLicense` vẫn giữ nguyên: nếu có entitlement đang active, không mua lại. Không ép khách đã mua hoặc có quyền lịch sử trả tiền thêm. Không cho phép tạo lượt mua thứ hai trong cùng scope; chưa có quota.
- Webhook và đối soát vẫn dùng chính sách 2.4B1; cấu hình provider tại một thời điểm chỉ xác thực một môi trường. Không dùng tính năng này như cơ chế chuyển credential khi còn giao dịch chưa đối soát.

## Kiểm thử và triển khai theo hai bước

1. Giữ `PAYMENT_SCOPED_CHECKOUT_ENABLED=false` hoặc chưa khai báo trên Railway. Build, unit test, CI đầy đủ. Có thể deploy bản code này trước migration mà không dùng bảng mới.
2. Trên MySQL QA riêng: chạy migration từ 016 lên 017, xác minh bảng/constraint, thử nâng cấp trên dữ liệu có khóa lịch sử, thử hai yêu cầu song song, rollback và retry, kiểm tra quyền cũ. `npm run test:canvas:mysql` chỉ dùng schema QA rỗng, không dùng production.
3. Trước migration production: sao lưu MySQL và kiểm tra restore, đối soát pending qua provider; xác nhận schema ở 016, kiểm tra danh sách migration hiện hành và cấu hình đúng database. Chạy migration bằng tài khoản được phép DDL theo quy trình triển khai đã duyệt (`npm run db:migrate` áp dụng tất cả migration còn thiếu). Không chạy nếu schema đang lệch hoặc migration pending.
4. Kiểm tra `SELECT version FROM schema_migrations WHERE version='017_payment_scope_keys';` và `SHOW CREATE TABLE payment_checkout_scope_keys;` trên database đích. Kiểm tra bảng khóa cũ còn nguyên. Không chạy lệnh destructive.
5. Chỉ sau khi hoàn tất QA, đối soát và bảo đảm mọi backend đã dùng bản mới, mới bật flag `true` trong môi trường thích hợp. Đặc biệt không đổi `PAYMENT_ENV` hoặc credential của provider production để thử Sandbox. Bật flag không làm phát sinh giao dịch tự động.
6. Nếu cần dừng chính sách mới: tắt flag, redeploy. Runtime cũ dùng anchor cũ, chặn khác scope thay vì tạo lại đơn; có thể không tiếp tục tạo/khôi phục checkout của scope thứ hai qua luồng create. Vẫn giữ toàn bộ order/intent và bảng scope để đối soát; không xóa bảng, không xóa khóa, không tự động hoàn tiền. Sau khi khắc phục có thể bật lại. Tránh chạy xen kẽ nhiều phiên bản khi kích hoạt.

## Kiểm thử

- `node --test tests/unit/phase02-checkout-keys.test.mjs` (test repository với adapter giả, không thay thế MySQL thực).
- `npm test`, `npm run build`, `npm run check`, `npm run test:architecture`, `npm run test:canvas:browser`.
- Fixture `tests/integration/canvas-mysql.mjs` bổ sung ca nâng cấp có khóa Sandbox đã tồn tại, hai request Live đồng thời, giữ anchor và kiểm tra không cấp quyền trước settlement.

## Quota (chưa triển khai)

Cần định danh lần mua hoặc draft, tách quyền lịch sử với lượt mua mới, sổ tiêu hao bất biến theo order và publication ID. Cả Canvas và legacy phải ghi tiêu hao + thiệp trong cùng transaction; không tính quota từ số thiệp hiện có. Khi chưa có quy trình mua thêm và hoàn tiền đồng nhất, không bật giới hạn hoặc thay đổi quyền khách hàng.
