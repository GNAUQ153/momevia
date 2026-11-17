# Momevia v1.1 — Payment Gateway & Receipt Foundation

## Chức năng và phạm vi

- **Chuyển khoản / VietQR:** payOS hosted checkout, nhận QR và link thanh toán qua kênh payOS merchant đã xác thực.
- **Ví điện tử:** MoMo `captureWallet` (sandbox trước; production chỉ khi merchant được cấp credentials).
- **Sau khi trả tiền:** nhận **server-to-server webhook** có chữ ký; so khớp `provider`, `orderCode`, `amount`, `currency` và ghi trạng thái `paid` cùng `template_entitlements` và `payment_receipts` trong **một giao dịch MySQL**.
- **Biên nhận:** `GET /api/checkout/payments/orders/:orderId/receipt` chỉ cho tài khoản sở hữu đơn hàng đã xác nhận; `/payment-result/:orderId` có nút **In / Lưu PDF** của trình duyệt.
- **Giữ nguyên:** `POST /api/checkout/orders/demo-purchase` cho môi trường phát triển; không đồng nghĩa giao dịch thật. Thư viện Gifts và Checkout JSON vẫn có thể dùng khi payment bị tắt.
- **Chưa hỗ trợ:** hóa đơn thuế điện tử, hoàn tiền tự động, xử lý tranh chấp, điều phối merchant payout, đối soát tự động sau webhook thất lạc, thay đổi phương thức của đơn pending/expired, ZaloPay/VNPay.

## An toàn dữ liệu

- Không tin redirect URL, client status, ảnh chuyển khoản hoặc dữ liệu thanh toán do frontend gửi.
- Không lưu mật khẩu, khóa merchant hoặc dữ liệu thẻ trong client hoặc Git.
- `PAYMENT_ENABLED=false` là cấu hình mặc định. **Không bật live để nhận tiền nếu chưa thử nghiệm end-to-end và có cơ chế hỗ trợ/đối soát thất bại.**
- Một cặp `(user_id, template_id)` có một intent đang mở; unique DB key tránh tạo nhiều đơn song song. Webhook gửi lặp không được tăng quyền hay tạo biên nhận hai lần.
- Giữ nguyên trạng thái `demo_paid` trong các đơn thử cũ. Chỉ `paid` từ callback đã xác minh mới là giao dịch provider.
- Các biên nhận được tạo ở đây **không phải hóa đơn VAT/hóa đơn điện tử hợp pháp**. Để xuất hóa đơn theo quy định, cần tích hợp dịch vụ hóa đơn điện tử và nghiệp vụ thuế riêng.
- Sandbox MoMo có cờ `is_test=1`; **không sao chép dữ liệu sandbox sang môi trường thu tiền thật**.

## Quy trình cài trên Momevia v1.0

1. `git status` sạch ở `main`. Sao lưu `.env`, toàn bộ JSON tại `services/*/data/` và MySQL bằng `mysqldump` trước khi chạy migration.
2. Giải nén Update ZIP vào thư mục **ngoài** repo, chạy `git apply --check` trước khi áp dụng patch. Nếu thất bại, dừng lại để xử lý conflict; không reset hay force push.
3. Cài SDK payOS chính thức (cần quyền truy cập npm registry): `npm install @payos/node@2.0.6 --save-exact`. Lệnh này đồng bộ **cả** `package.json` và `package-lock.json`; không dùng `npm ci` trước bước này.
4. Chạy `npm ci`, `npm run build`, `npm run check`, `npm test`, `npm run test:architecture`, `npm run package`, `npm run verify:package`.
5. Chỉ trên DB Momevia MySQL local đã có 001–004, copy `005_payment_receipts.sql` vào container và chạy **một lần**, sau đó `npm run db:verify`.
6. Giữ `PAYMENT_ENABLED=false` trong lúc các provider chưa có merchant credentials.
7. Thử nghiệm MoMo trên môi trường sandbox bằng merchant test credentials và **HTTPS public** (ví dụ tunnel cấu hình đúng callback). Cấu hình `PUBLIC_BASE_URL` thành HTTPS public; đăng ký IPN theo đường dẫn bên dưới.
8. Với payOS: tạo/duyệt merchant payment channel rồi cấu hình credentials; **không có sandbox giả lập trong bản này**. Chỉ bật khi thực sự sẵn sàng nhận tiền thật và đã có quy trình đối soát/hỗ trợ.
9. Kiểm tra bằng một đơn thử gồm: pending → provider callback signature hợp lệ → paid → một entitlement → một biên nhận. Gửi lại webhook giống hệt và kiểm tra số lượng không tăng. Thử callback sai tiền/sai chữ ký và đảm bảo không tạo quyền truy cập.
10. Kiểm tra `git diff --cached --check`; không stage `.env`, dump hoặc dữ liệu riêng. Sau khi xác minh test và provider, mới commit/push lên `main` theo yêu cầu nhóm.

## Cấu hình `.env`

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
IDENTITY_STORAGE=mysql
CATALOG_STORAGE=mysql
CHECKOUT_STORAGE=mysql
SUPPORT_STORAGE=mysql
GIFTS_STORAGE=mysql

# KHÔNG BẬT nếu chưa đăng ký merchant / HTTPS public / kiểm thử provider.
PAYMENT_ENABLED=false
PAYMENT_ENV=sandbox
PAYMENT_LIVE_ENABLED=false
PUBLIC_BASE_URL=https://your-public-testing-host.example
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
```

- MoMo sandbox: `PAYMENT_ENABLED=true`, `PAYMENT_ENV=sandbox`, `NODE_ENV` không phải production, ba key MoMo test hợp lệ. Sandbox URL: `https://test-payment.momo.vn`. Test account/merchant sandbox phải lấy từ nhà cung cấp.
- payOS: **không bật nếu chưa có merchant account thật**. Cần `PAYMENT_ENV=production`, `PAYMENT_LIVE_ENABLED=true`, credentials payOS, và URL HTTPS thực. Khi NODE_ENV=production, cả chế độ live và khóa phải được bật rõ ràng.
- Lưu ý: với cấu hình `PAYMENT_ENABLED=false`, không có phương thức thanh toán thật nào hiển thị. Callback cho những intent đã tạo trước đó vẫn được xác minh nếu provider keys còn hợp lệ.

### Cấu hình webhook / IPN

- payOS webhook: `POST https://YOUR_HOST/api/checkout/payments/webhooks/payos`
- MoMo IPN: `POST https://YOUR_HOST/api/checkout/payments/webhooks/momo`
- Webhook phải truy cập được từ server nhà cung cấp, localhost:4100 không dùng trực tiếp được.
- payOS SDK `webhooks.verify` xác thực chữ ký; MoMo IPN HMAC SHA256 bằng secret key do merchant cấp.
- Redirect sau thanh toán: `GET https://YOUR_HOST/payment-result/:orderId`. Trang này chỉ **đọc trạng thái từ máy chủ**, không tự cấp quyền.

## API mới

| API | Truy cập | Chức năng |
|---|---|---|
| `GET /api/checkout/payments/methods` | Public | Danh sách provider đang khả dụng |
| `POST /api/checkout/payments/create` | Đăng nhập | Body `{templateId,method}`; báo đơn pending, `checkoutUrl` |
| `GET /api/checkout/payments/orders/:orderId` | Chủ đơn | Trạng thái giao dịch |
| `GET /api/checkout/payments/orders/:orderId/receipt` | Chủ đơn, paid | Biên nhận JSON để in/lưu PDF |
| `POST /api/checkout/payments/webhooks/payos` | Webhook có chữ ký | Xử lý giao dịch payOS |
| `POST /api/checkout/payments/webhooks/momo` | IPN có chữ ký | Xử lý giao dịch MoMo |

## Migration 005 (Git Bash trong repo)

Sau backup và xác nhận migration 001–004 đã chạy:

```bash
docker compose --env-file .env -f database/compose.yml cp database/migrations/005_payment_receipts.sql db:/tmp/005_payment_receipts.sql
docker compose --env-file .env -f database/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" < /tmp/005_payment_receipts.sql'
npm run db:verify
```

**Không chạy lại migration nếu báo lỗi dở dang.** Kiểm tra trong DBeaver:

```sql
SELECT version FROM schema_migrations ORDER BY version;
SELECT COUNT(*) AS intents FROM payment_intents;
SELECT COUNT(*) AS receipts FROM payment_receipts;
SELECT COUNT(*) AS active_keys FROM payment_checkout_keys;
```

## Kiểm thử trước go-live

Cần thêm kiểm thử webhook provider **thật**, giao dịch không nhận được webhook, bồi hoàn/hoàn tiền, xử lý cổng lỗi, hủy/timeout, queue và reconciliation job; sao lưu/phục hồi, thuế/hóa đơn, quyền riêng tư và phân quyền quản trị tài chính. **Bản v1.1 là integration foundation để chạy thử, không phải chứng nhận production readiness.**

Nguồn chính thức: https://payos.vn/docs/sdks/back-end/node/ ; https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/
