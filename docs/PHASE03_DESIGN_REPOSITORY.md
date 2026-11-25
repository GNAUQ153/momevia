# Phase 3.3 — Service & Repository Standardization (Designs)

## Phạm vi

Tách MySqlDesignsRepository thành facade điều phối CRUD và các nhóm truy cập dữ liệu:

- `mysql-row-mapping.mjs`: mapping JSON, ngày UTC, thiết kế, tài sản, checkout context.
- `mysql-transaction.mjs`: helper khóa theo chủ sở hữu, kiểm tra revision, idempotency, asset và retry hiện hữu.
- `mysql-assets.mjs`: truy vấn/ghi tài sản, quota và readiness audio.
- `mysql-contexts.mjs`: lưu/đọc context đơn hàng theo chủ sở hữu.

Giữ constructor và method của repository; re-export các helper cũ cho script nhập dữ liệu và test. Publication Unit of Work import helper trực tiếp, không phụ thuộc facade. Không mở thêm pool, không lồng transaction; create() tiếp tục truyền chính transaction hiện tại khi ghi tài sản. Giữ nguyên SQL và thứ tự khóa.

## Hợp đồng callback

`save(ownerId, id, input, validateCurrent)` chờ callback đồng bộ hoặc Promise trước khi ghi revision/ACK. JSON trước đây không chờ Promise; nay thực hiện trong hàng đợi exclusive hiện có. Callback chỉ kiểm tra dữ liệu, không được gọi ghi repository lồng nhau hoặc thực hiện side effect bên ngoài. Replay hợp lệ giữ hành vi cũ, không gọi lại callback. Mã lỗi và shape của từng storage được giữ nguyên.

## Nghiệm thu

- `node --test tests/unit/phase03-design-repository.test.mjs tests/unit/mysql-canvas.test.mjs`
- `npm run check:architecture`, `npm run build`, `npm run check`, `npm test`.
- `npm run test:architecture`, `npm run test:canvas:browser`.
- CI MySQL QA: kiểm tra transaction thật, revision và mutation ledger khi callback từ chối; không chạy fixture trên Railway production.

## Giới hạn

JSON là storage single-process cho demo, không tương đương transaction MySQL. Replay create có thể trả snapshot JSON hoặc bản ghi hiện hành MySQL; list projection, checkout context và một số error details cũng khác nhau. Chưa đồng nhất những hành vi này để tránh thay đổi hợp đồng API hoặc dữ liệu trong refactor. Chưa thay đổi retry/rollback ở MySqlClient, số pool, schema, policy Premium, refund, frontend hoặc feature flag. Kiểm thử SQL mock chỉ xác nhận tham số và thứ tự gọi, không chứng minh khóa InnoDB thực tế. Cần CI MySQL và browser trước nghiệm thu.
