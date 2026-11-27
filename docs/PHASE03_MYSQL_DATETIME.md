# Phase 3.7B — Chuẩn hóa chuyển đổi thời gian MySQL

Baseline: ZIP `Momevia_Main_Latest_20261126(1).zip`, README ghi nhận PR #30 (`197a5f3`). ZIP không chứa lịch sử Git.

## Phạm vi

- Sáu bản sao logic đọc DATETIME UTC trong Identity, Catalog, Gifts, Checkout, Support và Designs được gom về `src/infrastructure/mysql/datetime.mjs`.
- Hàm ghi `mysqlDate` không còn buộc các Repository phụ thuộc Identity. Giữ export cũ để các script import dữ liệu và consumer hiện có tiếp tục chạy.
- `iso` của Designs giữ wrapper nullable; các mapping bắt buộc giữ hành vi lỗi với null/undefined. Giữ cách đọc chuỗi UTC, độ chính xác mili giây, và hành vi ghi hiện hành (kể cả `mysqlDate(null)`); không mở rộng đầu vào hoặc sửa dữ liệu lịch sử.
- Không gom logic timestamp bằng chứng thanh toán: contract định dạng/validation khác. Không đổi SQL, thứ tự khóa, transaction, schema, CSS, Auth hoặc locale.

## Nghiệm thu

```bash
node --test tests/unit/mysql-datetime.test.mjs
npm run test:database
npm run check:architecture
npm run audit:unused
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Các ca mới dùng fixture SQL, kiểm tra timezone tiến trình và export tương thích. Cần CI và MySQL QA để xác nhận hồi quy đầy đủ; không chạy integration fixture trên production. Không yêu cầu migration hay thay đổi cấu hình Railway. Push main có thể tự redeploy nếu đã bật.
