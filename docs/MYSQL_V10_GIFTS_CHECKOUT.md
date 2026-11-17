# Momevia v1.0 — MySQL Gifts & Checkout (DEMO)

## Mục tiêu và giới hạn

- Chuyển **Gifts, Gift Replies, Checkout demo orders và quyền sử dụng template** từ JSON sang MySQL qua hai biến `GIFTS_STORAGE` và `CHECKOUT_STORAGE`.
- Không đổi URL/API hiện có, không thay đổi luồng đăng nhập hoặc Catalog.
- **Không có thanh toán thật**: `demo_paid`, `local_demo_only`, `is_test=1` là dữ liệu mô phỏng, không phải bằng chứng người dùng đã trả tiền. Không trả thưởng Creator, không nhận webhook hay thẻ thanh toán.
- MySQL transaction bảo đảm: (1) tạo đơn, khóa mua demo duy nhất và entitlement cùng thành công/thất bại; (2) ghi phản hồi và tăng `reply_count` cùng thành công/thất bại. Điều kiện độc quyền `(user_id,template_id)` ngăn đơn demo trùng khi gửi request đồng thời.
- Mặc định tiếp tục dùng JSON. **Không tự đồng bộ hai chiều JSON ↔ MySQL.** Ảnh quà vẫn lưu trong `services/gifts/data/images`; chưa có object storage.

## 1. Điều kiện trước khi bật

1. Source `main` v0.9 đã cài, MySQL 8.4 Docker `healthy`, phiên bản migration 001–003 đã PASS. Trong `.env`: `MYSQL_PORT=3307` nếu máy dùng port 3307.
2. Đối chiếu Users/Templates ID giữa JSON/MySQL và bảo đảm Identity/Catalog đã chuyển dữ liệu đúng. Khuyến nghị bật `IDENTITY_STORAGE=mysql`, `CATALOG_STORAGE=mysql` trước khi dùng Gifts/Checkout MySQL.
3. Tắt app trong lúc import; sao lưu MySQL, **toàn bộ thư mục** `services/*/data/` và file `.env` ở chỗ riêng tư ngoài Git. Backup có thể chứa email, ảnh cá nhân, JWT/session và mật khẩu băm.
4. Không chạy `docker compose down -v` hoặc xóa volume MySQL. Không chạy migration 004 nhiều lần mà không kiểm tra trạng thái.

Sao lưu MySQL từ thư mục `E:\momevia-mvp` (Git Bash):

```bash
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --single-transaction --no-tablespaces -u "$MYSQL_USER" "$MYSQL_DATABASE"' > ../momevia_mysql_before_v10.sql
ls -lh ../momevia_mysql_before_v10.sql
```

**Kiểm tra file backup không rỗng**. Sao lưu JSON bằng File Explorer/7-Zip hoặc sao chép thư mục `services` tới ổ an toàn, không đưa vào repo.

## 2. Migration 004 (MySQL 8.4)

```bash
docker compose --env-file .env -f database/compose.yml cp database/migrations/004_gifts_checkout.sql db:/tmp/004_gifts_checkout.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/004_gifts_checkout.sql'
npm run db:ping
npm run db:verify
```

`004_gifts_checkout.sql` tạo bảng `demo_purchases` với khóa chính `(user_id, template_id)` và khóa ngoại tới `orders`, `users`, `templates`; **không xóa dữ liệu**. Các bảng `orders`, `gifts`, `gift_replies`, `template_entitlements` đã có từ migration 001.

## 3. Import JSON → MySQL — không ghi đè

Chạy **dry-run** (không thay đổi dữ liệu):

```bash
npm run db:import:gifts-checkout
```

Script đọc JSON tại `services/gifts/data/gifts.json`, `services/gifts/data/replies.json`, `services/checkout/data/orders.json`, đối chiếu IDs với snapshot Users/Templates, kiểm tra duplicate purchases, tổng tiền, `replyCount`, ngày hết hạn và sự tồn tại của các tệp ảnh tham chiếu. File không tồn tại sẽ được coi là tập rỗng. Nếu có ảnh bị thiếu, phải phục hồi từ backup trước khi import.

Trước khi nhập thật, đối chiếu các bảng MySQL **`orders`, `demo_purchases`, `template_entitlements`, `gifts`, `gift_replies` đều trống**. Nếu bảng đã có dữ liệu, **không chạy lại import** hoặc xóa dữ liệu để ép nhập. Cần xử lý merge riêng.

Khi đã sao lưu và kết quả dry-run khớp nguồn, chạy:

```bash
npm run db:import:gifts-checkout -- --apply
npm run db:verify
```

Importer từ chối ghi đè, xác minh user/template tham chiếu có trong MySQL và chạy một transaction. Nếu bất kỳ câu SQL nào thất bại, rollback toàn bộ. Ảnh không chuyển file; adapter dùng cùng thư mục ảnh local.

## 4. Chuyển runtime sau khi import

Trong `.env` riêng (không commit):

```dotenv
IDENTITY_STORAGE=mysql
CATALOG_STORAGE=mysql
SUPPORT_STORAGE=mysql
CHECKOUT_STORAGE=mysql
GIFTS_STORAGE=mysql
MYSQL_PORT=3307
```

Để kiểm thử **mua demo** trên local, `DEMO_AUTH_ENABLED=true` (mặc định thường tắt); **không bật chức năng demo trong production**.

```bash
npm run dev
```

Kiểm thử thủ công:

1. Đăng nhập lại bằng tài khoản hiện có; Catalog có 12 mẫu và Favorites đúng.
2. Mua một mẫu trả phí *trong chế độ demo*; lặp lại cùng người dùng/mẫu 2 lần, cả hai lần phải trả về **cùng order ID**, không tạo nhiều entitlement.
3. Kiểm tra người chưa có quyền không xuất bản được mẫu có giá (`402`); người đã mua demo có thể tạo Gift tương ứng.
4. Tạo thiệp miễn phí; xem link public và ảnh đính kèm nếu có. Phản hồi nhiều lần/đồng thời; tổng `reply_count` phải bằng số dòng trong `gift_replies`.
5. Kiểm tra danh sách thiệp của tôi không chứa quà người khác; quà hết hạn trả HTTP `410`; lượt phản hồi bị giới hạn tốc độ.
6. Gửi Support vẫn ghi MySQL đúng; role Admin/Creator/Sender và session hoạt động bình thường.

Truy vấn đối chiếu trong DBeaver:

```sql
SELECT COUNT(*) AS orders_count FROM orders;
SELECT COUNT(*) AS demo_purchase_count FROM demo_purchases;
SELECT COUNT(*) AS granted_rights FROM template_entitlements WHERE revoked_at IS NULL;
SELECT COUNT(*) AS gifts_count FROM gifts;
SELECT COUNT(*) AS replies_count FROM gift_replies;
SELECT g.id, g.reply_count, COUNT(r.id) AS actual_replies
FROM gifts g LEFT JOIN gift_replies r ON r.gift_id=g.id
GROUP BY g.id, g.reply_count
HAVING g.reply_count <> COUNT(r.id);
```

Truy vấn cuối **không được trả về dòng nào**.

## 5. Kiểm thử CI, Git và rollback

```bash
npm run build
npm run check
npm test
npm run test:architecture
npm run package
npm run verify:package
git diff --check
git diff --cached --check
```

**Nếu cần rollback:** dừng app, đặt `GIFTS_STORAGE=json`, `CHECKOUT_STORAGE=json`, rồi khởi động lại. Lưu ý các đơn/quà/phản hồi mới tạo trong MySQL **sẽ không tự có trong JSON**. Đừng rollback dữ liệu nếu chưa backup/export bản ghi mới. Migration 004 có thể giữ nguyên khi chỉ rollback runtime.

`npm run test:architecture` kiểm thử topology JSON trong fixture, **không thay thế** kiểm thử trên MySQL thật. CI xanh không chứng minh thanh toán thật an toàn. Trước production cần gateway thanh toán, webhook có xác thực, đối soát, payout ledger thật, object storage, backup/restore và giám sát.
