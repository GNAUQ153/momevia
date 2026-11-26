# Phase 3.5A — Database Schema & Migration Audit

## Phạm vi

Baseline ZIP `445c892` + Phase 3.4E; không thay đổi bất kỳ migration SQL nào.
MySQL 8.4 là môi trường CI/local theo compose. Chưa xác minh phiên bản/schema Railway thực tế.
19 migration tạo 38 bảng (bao gồm `schema_migrations`); runner tạo thêm bảng kỹ thuật
`schema_migration_pending`. Không suy ra số bảng production từ thống kê này.

## Sử dụng

- `npm run db:audit`: offline mặc định, không tải driver MySQL hoặc đọc `.env`, kiểm tra tên,
  thứ tự, marker cuối file, checksum SHA-256 (chuẩn hóa CRLF) và danh sách bảng.
- `npm run db:audit -- --live`: tùy chọn, chỉ truy vấn metadata và hai bảng lịch sử nếu tồn tại.
  Ưu tiên database QA riêng và tài khoản SELECT có quyền nhìn thấy đầy đủ bảng trong schema.
  Không chạy trong lúc migration đang thực hiện; các SELECT không tạo snapshot DDL nguyên tử.
- `npm run db:audit -- --live --require-latest`: yêu cầu tất cả migration đã ghi.
- `node --test tests/unit/mysql-migration-audit.test.mjs`: kiểm thử offline; được npm test và test:database tự phát hiện.

Trạng thái `latest` chỉ xác nhận prefix và inventory bảng/engine trong phạm vi audit, không chứng minh
schema chính xác từng cột, index, FK, CHECK hoặc dữ liệu. `pending_migrations` là prefix hợp lệ nhưng
chưa đủ phiên bản; không tự áp dụng migration. `review_required` trả exit code 1, bao gồm bảng lạ,
marker pending hoặc sai lịch sử; không tự xóa, sửa hay chạy lại migration.

## Phát hiện từ source

- `mysql-verify.mjs` chỉ kiểm tra tập bảng nghiệp vụ cơ bản và một số marker đến 010;
  lệnh audit mới bổ sung inventory theo tất cả migration, không thay thế verify cũ.
- 017 (`payment_checkout_scope_keys`), 018 (`publication_credits`) và 019
  (`publication_repurchases`) là ba migration bổ sung bảng. Không bật quota/payment scope
  production chỉ vì audit báo đủ bảng.
- Runner hiện có advisory lock và marker pending vì DDL MySQL implicit commit;
  marker không phải rollback. Không sửa/xóa marker thủ công khi chưa đối chiếu và sao lưu.
- 012 giữ JSON lossless bằng LONGTEXT và CHECK; 014 thay CHECK của design_assets để hỗ trợ audio.
  Cần kiểm tra constraint thực tế và dữ liệu cũ ở môi trường QA trước khi thay đổi schema.
- `migration-baseline.json` ghim checksum 001–019 từ source hiện tại, không chứng minh SQL lịch sử
  thực sự từng chạy trên Railway. Khi thêm migration mới, cập nhật baseline bằng review riêng;
  không cập nhật checksum lịch sử để né lỗi. Công cụ hiện cho phép append migration chưa ghim.
- Parser chỉ nhận quy ước CREATE TABLE IF NOT EXISTS và marker đang dùng trong repo;
  không phải SQL parser tổng quát. Nếu có DROP/RENAME/CREATE dạng khác trong tương lai,
  phải mở rộng inventory trước khi dùng kết quả audit.

## Giai đoạn tiếp theo

3.5B: lấy metadata index/constraint và EXPLAIN trên QA, xác định query nóng; không xóa index chỉ
vì trùng tiền tố, không chạy EXPLAIN ANALYZE trên production khi chưa đánh giá chi phí.
