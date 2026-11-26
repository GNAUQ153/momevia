# Phase 3.5B — SQL Query & Index Optimization

Baseline: ZIP 445c892 + Phase 3.4E + Phase 3.5A + CI Fix; commit đích theo terminal 7c45aad. Không thay đổi schema/migration hoặc cấu hình Railway.

## Batch asset references

- Create, save và publish sử dụng INSERT nhiều dòng cho bảng liên kết tài sản, tối đa 100 dòng mỗi batch (200 placeholder). Không INSERT IGNORE, không thay đổi thứ tự đầu vào hay quy tắc dedup của caller.
- Giữ các SELECT FOR UPDATE theo ID đã sắp xếp, validation quyền sở hữu/status, CAS, idempotency và transaction hiện hữu. Không gom các truy vấn khóa tài sản vì thứ tự khóa cần được bảo toàn.
- Số lệnh INSERT liên kết: N -> ceil(N/100). Ví dụ 205 -> 3, chỉ là số lần execute của phần liên kết, không phải tổng số truy vấn hoặc thời gian thực tế.
- Lỗi ở một batch truyền ra transaction để rollback. Unit test dùng mock client; fixture MySQL QA kiểm tra multi-asset create/save/publish và rollback thật sau INSERT. Không chạy fixture trên production.

## Index metadata (MySQL 8)

Offline audit cũ: `npm run db:audit`. Tùy chọn mới: `npm run db:audit -- --live --indexes`. Lệnh live kết nối database cấu hình hiện tại; chỉ chạy khi xác minh đích, ưu tiên database QA hoặc tài khoản chỉ đọc. Có thể thêm `--require-latest` nếu cần. Không ghi DDL/DML. Báo cáo index lấy từ information_schema.STATISTICS, không lấy bản ghi khách hàng. Index review chỉ mang tính tư vấn, không thay đổi exit code kiểm tra schema.

| Truy vấn | Prefix có trong migration |
|---|---|
| Lookup OAuth | users_provider_identity_uk (provider, provider_id) |
| Email login | users_email_login_uk (email_login) |
| Session expiry | sessions_expiry_idx (expires_at) |
| Gifts by owner | gifts_owner_created_idx (user_id, created_at) |
| Unread replies | gift_replies_unread_idx (gift_id, read_status) |
| Designs by owner | designs_owner_updated_idx (owner_id, updated_at, id) |
| Asset lookup | design_assets_owner_idx (owner_id, id) |
| Design/gift refs | PRIMARY (parent ID, asset_id) |
| Checkout contexts | checkout_context_owner_order_idx (owner_id, order_id, created_at, context_id) |

`prefix_found` = có B-tree visible với prefix đủ độ dài theo cột khai báo; không chứng minh optimizer sử dụng index hoặc đáp ứng ORDER BY. `review_required` = chưa thấy prefix tương ứng trong metadata nhìn được; không tự động tạo index. Có thể có PK ngầm trong secondary index hoặc các access path khác.

Các ứng viên cần EXPLAIN trên QA: `LOWER(email)` của `findAnyByEmail` (khác generated column email_login về phạm vi OAuth), lọc JSON provenance của danh sách designs, danh sách catalog lấy toàn bộ mẫu, count unread theo gift. Không sửa collation, unique, phân trang hoặc thêm index trước khi kiểm tra dữ liệu đại diện, execution plan, write overhead và semantics. Dùng tham số tổng hợp QA. EXPLAIN ANALYZE thực thi truy vấn, chỉ dùng với SELECT an toàn trong QA.

## Nghiệm thu

`npm run test:database`, `node --test tests/unit/phase03-design-repository.test.mjs tests/unit/phase02-publication-credit.test.mjs tests/unit/phase02-publication-usage.test.mjs tests/unit/release.test.mjs`. CI chạy `npm run test:canvas:mysql` với schema QA độc lập. Các file mới nằm dưới allowlist database/scripts, tests, docs hiện tại. Không chạy db:migrate cho phase này. Không khẳng định giảm CPU/RAM/chi phí khi chưa đo.
