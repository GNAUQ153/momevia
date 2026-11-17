# Rà soát nền v1.1 trước khi triển khai canvas

Ngày rà soát: **17/11/2026**, múi giờ Asia/Saigon. Nhánh: `feat/canvas-design-plan`. Source đối chiếu: **`6c44bdb`**, phiên bản package **1.1.0**.

Tài liệu này cập nhật căn cứ cho [kế hoạch canvas](CANVAS_DESIGN_PLAN.md) và [prompt triển khai](CANVAS_IMPLEMENTATION_PROMPT.md) sau khi đồng bộ source. Phạm vi đợt đầu đã chọn là **người gửi cá nhân hóa mẫu và tự thiết kế cơ bản**; công cụ Creator chuyên sâu làm sau. Đây là rà soát và lập kế hoạch, chưa triển khai hay sửa runtime canvas/payment.

## 1. Đồng bộ Git và bảo toàn công việc

- Điểm bắt đầu của lần rà soát trước là `0726760`. Lần cập nhật này fast-forward tới `6c44bdb`, gồm **7 commit** trong khoảng `0726760..6c44bdb`.
- Không có entry Git unmerged ở thời điểm kiểm tra ban đầu. Vấn đề cần xử lý là thay đổi local chồng lên các file upstream cập nhật, gồm `.gitignore` và `docs/README.md`; không phải một bộ conflict đang chờ giải quyết.
- Trước đồng bộ, đã sao lưu thay đổi và thông tin kiểm tra vào `local/canvas-replan-20261117/before-sync/`, gồm bản file, patch, status và manifest.
- Stash `canvas plan local changes before upstream sync 20261117` được giữ lại làm điểm khôi phục. Các file kế hoạch chưa được Git theo dõi được bảo toàn.
- Sau đồng bộ và phục hồi công việc local, không còn conflict unmerged. Các thay đổi đang làm vẫn là WIP trên nhánh canvas; việc đồng bộ không biến chúng thành một bản canvas đã triển khai.

Không dùng `reset --hard`, không ghi đè dữ liệu nghiệp vụ và không áp dụng migration trong lần rà soát này.

## 2. Source hiện tại và giới hạn bằng chứng

### 2.1 Kiến trúc xác minh từ source

Momevia vẫn là Node.js modular monolith. `src/server/app.mjs:32-37` nối Catalog, Checkout và Gifts qua các interface nội bộ `getTemplate` và `hasLicense`. Không cần chuyển thành microservices hoặc đổi framework frontend để thêm canvas.

Nền hiện tại có **adapter MySQL theo module**, giữ JSON như chế độ mặc định. Riêng Checkout và Gifts chọn mode qua `CHECKOUT_STORAGE` và `GIFTS_STORAGE` tại `src/modules/checkout/repositories.mjs:7-8`, `src/modules/gifts/repositories.mjs:8-9`. Payment mới yêu cầu Checkout, Identity và Catalog đều dùng MySQL. Các yếu tố này phải được phản ánh trong thiết kế repository và QA của canvas.

v1.1 đã bổ sung:

- Adapter payOS và MoMo tại `src/modules/payments/providers.mjs`.
- API tạo intent, đọc trạng thái, nhận webhook và đọc biên nhận tại `src/modules/payments/routes.mjs`.
- Lưu `payment_intents`, khóa checkout và biên nhận qua migration `005_payment_receipts.sql`.
- Trang `/payment-result/:orderId` và luồng chọn phương thức/đi thanh toán trong `web/js/app/main.js`.

Đây là khả năng **có trong source**. Không đồng nghĩa merchant đã cấu hình, DB đã migrate, server đang dùng MySQL hoặc đã kiểm chứng nhận tiền thật.

### 2.2 Graph và đối chiếu trực tiếp

Graph AST được làm mới riêng tại `local/canvas-replan-20261117/ast/graphify-out/`: **755 node, 1.862 edge, 146 file code**. Graph này phục vụ truy vết cấu trúc ở baseline mới; không dùng graph cũ của `0726760` để khẳng định quan hệ mới trong v1.1.

Sáu file SQL trong phạm vi quét không có parser phù hợp nên đã được đọc trực tiếp. Tài liệu prose không nằm trong lần trích xuất AST này và được đối chiếu riêng. Vì vậy graph không phải bằng chứng rằng mọi SQL constraint, chính sách sản phẩm hoặc hướng dẫn vận hành đã được trích xuất đầy đủ.

### 2.3 Cấu hình và dependency local

Kiểm tra có chọn lọc chỉ đọc các cờ storage/payment được cho phép; các cờ đó không có trong `.env`/môi trường process được kiểm tra. Không xuất giá trị bí mật. Kết quả này không xác định cấu hình hiệu lực của một server đang chạy từ trước hoặc được khởi động ở nơi khác.

`package.json:35-36` đã khai báo `@payos/node` và `mysql2`, nhưng `node_modules` trong workspace hiện chưa có hai gói này. Dependency chỉ được cài vào thư mục QA cô lập. Không chạy `npm ci` trong workspace để tránh tác động ứng dụng của người dùng.

## 3. Đường đi của thanh toán và quyền xuất bản

| Bước | Bằng chứng source | Hành vi hiện tại |
| --- | --- | --- |
| Liệt kê phương thức | `src/modules/payments/payment.service.mjs:4-16` | Dựa trên cờ payment, storage và cấu hình provider |
| Nhận yêu cầu tạo payment | `src/modules/payments/routes.mjs:5-10` | Nhận `templateId`, `method`; chưa có draft, revision hoặc quote canvas |
| Xác định số tiền | `src/modules/payments/payment.service.mjs:39-53` | Đọc giá mẫu từ Catalog trên server, kiểm quyền hiện có rồi tạo pending intent |
| Tránh tạo nhiều intent | `src/modules/payments/mysql.repository.mjs:12-46` | Transaction và khóa unique theo cặp người mua/mẫu; khi trùng trả intent đã có |
| Gọi provider | `src/modules/payments/payment.service.mjs:59-67` | Dùng mã và số tiền của intent đã lưu; URL trả về dẫn tới trang kết quả |
| Xác minh webhook | `src/modules/payments/payment.service.mjs:69-75` | Adapter xác minh chữ ký rồi chuyển sự kiện cho repository |
| Hoàn tất giao dịch | `src/modules/payments/mysql.repository.mjs:81-110` | Khóa hàng, kiểm dữ liệu, ghi trạng thái, event, transaction, entitlement và receipt trong cùng transaction |
| Kiểm quyền MySQL | `src/modules/checkout/mysql.repository.mjs:27-34` | Join entitlement với order, kiểm chưa revoke, khớp người mua/mẫu và trạng thái được chấp nhận |
| Kiểm quyền JSON | `src/modules/checkout/checkout.service.mjs:33-36` | Fallback đọc trạng thái order; không có bản ghi entitlement/revoke riêng |
| Xuất bản quà | `src/modules/gifts/gifts.service.mjs:42-48` | Mẫu có giá phải qua `checkout.hasLicense`; thiếu quyền trả 402 |
| Đọc biên nhận | `src/modules/payments/mysql.repository.mjs:63-78` | Chỉ chủ đơn đã `paid`; có nhãn giao dịch thử và ghi chú không phải hóa đơn VAT |

MySQL `hasLicense` chấp nhận order `paid`, hoặc `demo_paid` kèm `is_test=1`, đồng thời entitlement chưa bị thu hồi. Không được coi một phần tử `paid` trong state browser là thay thế cho kiểm tra này. Giao dịch MoMo sandbox cũng có trạng thái `paid` và được nhận diện bằng `is_test`; không chuyển dữ liệu thử sang môi trường thu tiền thật.

Webhook lặp lại đã được thiết kế trả cùng kết quả khi intent và order đều `paid`. Sự kiện provider không thành công hiện trả `not-paid` tại `mysql.repository.mjs:83`; chưa tự chuyển đơn sang `failed`/`cancelled` hay giải phóng khóa checkout. Không suy ra trạng thái tài chính từ redirect của browser.

## 4. Phát hiện và ảnh hưởng tới phạm vi canvas

Mức độ dưới đây đánh giá tác động trong luồng liên quan, không phải chứng nhận bảo mật toàn hệ thống. Chưa sửa runtime trong lần lập kế hoạch.

| Mã | Mức độ và gate liên quan | Phát hiện | Hướng xử lý trong triển khai |
| --- | --- | --- | --- |
| CV11-01 | Cao — gate nối canvas với checkout | Chưa có persisted draft trước khi rời trang sang provider | Autosave có ACK, lưu context để quay về đúng draft và revision |
| CV11-02 | Trung bình — gate publish từ editor | UI suy quyền từ order, khác với MySQL kiểm entitlement/revoke | Preflight đọc quyền hiệu lực từ server; backend vẫn là nơi quyết định |
| CV11-03 | Cao — gate phát hành quà an toàn khi retry | Payment idempotent không làm GiftService.create idempotent | Thêm idempotency riêng cho publish snapshot, không tạo lại order khi retry |
| CV11-04 | Cao — gate trước khi bật thanh toán live | Cấu hình MoMo có đường tới endpoint live mà chưa bắt LIVE flag trong môi trường non-production | Hardening payment riêng, QA dùng provider giả; không bật live trong công việc canvas |
| CV11-05 | Trung bình — gate thiết kế contract | Payment hiện mua quyền mẫu, chưa có quote theo revision hoặc element | Giữ nguyên giá theo mẫu trong đợt đầu; tách preflight thiết kế khỏi sổ giao dịch |
| CV11-06 | Trung bình — gate tài liệu và bàn giao | README/PRODUCT_SCOPE còn các tuyên bố demo-only/PostgreSQL | Ghi rõ source v1.1, các điều kiện cấu hình và phần chưa được kiểm chứng |

### 4.1 CV11-01 — Không mất nội dung khi thanh toán

`web/js/app/main.js:313-332` tạo payment và có thể gọi `window.location.assign` sang provider. Form cá nhân hóa chưa có bản nháp được lưu để khôi phục. Trang kết quả tại `:79-90` chỉ dẫn về `/studio`, chưa biết bản đang soạn.

Canvas cần lưu thành công nội dung và asset reference trước khi bắt đầu bước này. Lỗi lưu phải giữ người dùng ở editor và cho thử lại. Khi quay về, khôi phục theo bản nháp thuộc tài khoản, không phục dựng bằng thông tin nhạy cảm đặt trong query string.

### 4.2 CV11-02 — Hiển thị quyền phải cùng nguồn với publish

`web/js/pages/gifts.js:21-26` coi mẫu đã được cấp quyền khi danh sách order chứa `demo_paid` hoặc `paid`. MySQL backend còn kiểm entitlement chưa revoke. Vì vậy có thể xuất hiện nút “Xuất bản” trong khi server từ chối đúng bằng 402.

Editor mới cần preflight trả trạng thái quyền cùng lý do rõ ràng. Lịch sử order và biên nhận vẫn được giữ để tra cứu; không dùng chúng như một cache quyền vĩnh viễn. Nếu người dùng đã có đơn nhưng thiếu quyền hiện hành, không tự đưa họ đi mua lại mà chưa xác định nguyên nhân.

### 4.3 CV11-03 — Tách retry thanh toán và retry xuất bản

`src/modules/gifts/gifts.service.mjs:53-62` sinh UUID/slug mới cho mỗi lần create. Canvas có thêm nháp và revision nên cần khóa idempotency cho xuất bản, đảm bảo retry sau mất phản hồi trả lại cùng bản phát hành.

Thanh toán thành công nhưng publish lỗi phải cho phép sửa lỗi hoặc thử lại mà không thu thêm. Không sửa ledger cũ để biểu diễn trạng thái dựng canvas; lưu trạng thái phát hành riêng.

### 4.4 CV11-04 — Khoảng trống điều kiện bật MoMo live

Source xác nhận tổ hợp sau có thể đi tới MoMo live: `PAYMENT_ENABLED=true`, các module cần thiết dùng MySQL, có cấu hình MoMo/HTTPS, `PAYMENT_ENV=production`, nhưng `NODE_ENV` không phải `production` và `PAYMENT_LIVE_ENABLED` chưa bật.

- `payment.service.mjs:12-14` cho phép phương thức MoMo khi `NODE_ENV` không phải production.
- `payment.service.mjs:31-33` chỉ bắt điều kiện live flag khi `NODE_ENV=production`.
- `providers.mjs:55-57` chọn endpoint live chỉ theo `PAYMENT_ENV`.

Đây là kết luận từ source, **không có lệnh gọi provider hoặc thanh toán thực**. payOS có điều kiện `PAYMENT_ENV=production` và `PAYMENT_LIVE_ENABLED=true` rõ ràng tại `payment.service.mjs:9-11`.

Nên xử lý và kiểm thử ma trận cấu hình như một phần hardening payment trước live. Phát hiện này không chặn phát triển canvas sender với payment bị tắt hoặc provider giả; nó chặn việc coi các kiểm tra canvas là căn cứ bật thu tiền thật.

### 4.5 CV11-05 — Không tự thay đổi sản phẩm được bán

Payment API hiện nhận mẫu và phương thức. Giá được đọc từ Catalog; intent cũ giữ số tiền riêng và được dùng lại. Không có hợp đồng hiện hành cho giá theo số cảnh, element, dung lượng hoặc mỗi lần phát hành canvas.

Đợt đầu phải giữ ngữ nghĩa mua quyền mẫu. Tự thiết kế bằng element cơ bản không được tạo một mẫu public giả hoặc một đơn giả chỉ để vượt qua API cũ. Dùng source loại `blank`/mẫu nền được server kiểm tra trong hợp đồng nháp mới. Nếu sau này có tài nguyên trả phí, cần đặc tả quyền và giá riêng trước triển khai.

## 5. Điểm nối canvas–payment cần triển khai

Luồng mục tiêu:

```text
Lưu nháp → kiểm tra revision/quyền/media → xem trước → xác nhận phí mẫu
                                                  ↓ nếu thiếu quyền
                                                checkout
                                                  ↓
đọc trạng thái server → quay đúng nháp → kiểm tra lại → xuất bản snapshot → link/QR
```

1. **Nháp có danh tính và revision.** Lưu `draftId`, owner, `schemaVersion`, revision, nguồn mẫu/version, content hash và asset reference. Các trường này phải được xác minh trên server, không tin toàn bộ payload client.
2. **Preflight riêng của editor.** Kiểm nháp đã lưu, lỗi node/media, khả năng publish và quyền hiện hành. Trả lý do như thiếu quyền mẫu, tài nguyên không hợp lệ, revision đã thay đổi hoặc dịch vụ chưa sẵn sàng. Không dùng preflight để tự cấp quyền.
3. **Xác nhận giá server.** Với mẫu trả phí, hiển thị số tiền server/intent đang áp dụng; không lấy giá cũ trong state browser. Trong đợt đầu đây vẫn là phí mẫu, chưa là engine tính giá theo nội dung thiết kế.
4. **Lưu trước khi rời editor.** Chỉ mở checkout sau ACK lưu nháp. Giữ khả năng phục hồi khi reload, đóng tab, redirect hủy hoặc callback đến chậm.
5. **Context quay lại do server quản lý.** Liên kết order với owner và nháp/revision qua cấu trúc bổ sung. Chỉ chấp nhận đường quay lại nội bộ; không đưa tên người nhận, lời chúc hoặc URL asset riêng vào callback URL.
6. **Giữ tương thích payment cũ.** Order/receipt không có context vẫn đọc được. Không đổi chữ ký provider, khóa unique, trạng thái cũ hay số tiền trong biên nhận chỉ để gắn canvas. Nếu cần schema mới, dùng migration bổ sung sau khi kiểm tra thứ tự hiện có; không sửa migration đã phát hành.
7. **Sau thanh toán kiểm tra lại.** Browser đọc trạng thái từ server rồi chạy preflight. Nếu nháp đã sửa trong lúc thanh toán, quyền mẫu vẫn theo hợp đồng hiện tại nhưng preview và validation phải làm lại trên revision mới.
8. **Publish bản người dùng đã duyệt.** Nhận expected revision/hash và idempotency key; khi conflict phải yêu cầu xem lại, không âm thầm phát hành bản khác. Snapshot đã xuất bản tách khỏi nháp đang sửa.
9. **Không thu lại khi phát hành lỗi.** Retry publish sử dụng quyền đã có. Lỗi renderer/asset không biến thành lý do tạo payment thứ hai.
10. **Giữ các trạng thái trung thực.** Pending chưa phải thành công. Redirect hủy chưa phải hoàn tiền. Trường hợp đã trả tiền nhưng chưa có callback phải giữ nháp, cho kiểm tra lại và đường hỗ trợ; không giả lập webhook từ frontend.
11. **Luồng tự thiết kế cơ bản độc lập merchant.** Khi toàn bộ thành phần đủ quyền miễn phí, vẫn lưu/preview/publish được qua policy mới dù payment chưa bật.
12. **Người nhận không đi qua checkout.** `/g/:slug` chạy snapshot được cấp quyền và còn hiệu lực; không tải bộ công cụ biên soạn hoặc yêu cầu người nhận mua quyền mẫu.

## 6. Tài liệu đang lệch source

| Vị trí | Tuyên bố cũ hoặc thiếu | Căn cứ cập nhật |
| --- | --- | --- |
| `README.md:5`, `:17`, `:109` | Checkout chỉ demo, chưa có webhook | v1.1 có adapter provider, webhook và receipt; chưa có bằng chứng live |
| `docs/PRODUCT_SCOPE.md:9-10`, `:27` | Luồng và phạm vi chỉ có demo checkout | Cần tách demo với payment foundation có điều kiện |
| `docs/PRODUCT_SCOPE.md:28` | PostgreSQL còn là định hướng giai đoạn kế | Source hiện đã chọn MySQL và có adapter theo module |
| `docs/PAYMENTS_V11.md:7-10`, `:16-20`, `:59-69` | Tài liệu mới mô tả foundation và gate | Dùng cùng source, không diễn giải thành production readiness |

Cách mô tả thống nhất nên là: **“Đã có nền tích hợp payOS/MoMo, webhook và biên nhận; payment mặc định tắt. Cần cấu hình, kiểm chứng merchant end-to-end và hoàn thiện vận hành trước thu tiền thật.”** Không ghi “đã nhận tiền thật” chỉ vì có route hoặc test mock.

Những quyết định về subscription, đa vai trò, phí vận hành mỗi thiệp, giấy phép theo lượt và quyền element nâng cao vẫn tách khỏi canvas sender đợt đầu. Không tự đổi auth, giá hoặc quyền của dữ liệu cũ để giải quyết tài liệu lệch.

## 7. QA đã chạy trong lần rà soát

QA dùng source từ **`git archive HEAD`** ở `6c44bdb`, giải vào `local/canvas-replan-20261117/qa/`. Không sao chép `.env` hoặc dữ liệu nghiệp vụ vào bản này. Các file kế hoạch đang untracked không phải mã runtime được kiểm thử.

| Kiểm tra | Kết quả quan sát | Phạm vi chứng minh |
| --- | --- | --- |
| `npm ci` trong thư mục QA | PASS | Dependency khóa cài được ở bản cô lập |
| `npm run build` | PASS | Tạo artifact frontend theo script hiện hành |
| `npm run check` | PASS | Kiểm tra source/workflow/artifact theo script repo |
| `npm test` | **PASS 88/88** | Bộ unit test hiện hành của baseline v1.1 |
| `npm run test:browser` dùng Chromium mặc định | **BLOCKED: thiếu Chromium executable** | Không coi lần gọi này là browser PASS |
| `BROWSER_CHANNEL=msedge` và chạy lại `test:browser` | **PASS** | Browser trên Edge cùng bộ API/smoke/concurrency của harness |
| MySQL thật | **NOT RUN** | Chưa chứng minh constraint/transaction/lock trên MySQL chạy thực |
| MoMo/payOS end-to-end thật | **NOT RUN** | Không có kiểm chứng merchant, webhook mạng thật hoặc thu tiền |

Trong QA đã đặt rõ cả năm cờ storage thành `json`: `IDENTITY_STORAGE`, `CATALOG_STORAGE`, `SUPPORT_STORAGE`, `GIFTS_STORAGE`, `CHECKOUT_STORAGE`; đặt `PAYMENT_ENABLED=false` và `PAYMENT_LIVE_ENABLED=false`. Kết quả API/concurrency ở harness này là bằng chứng cho đường JSON, không phải concurrency MySQL.

Các test payment hiện có dùng provider/fetch/transaction giả tại `tests/unit/payment-foundation.test.mjs:15-18`, `:51-55`, `:79-96`. Chúng có ích để kiểm logic và các thao tác dự kiến, nhưng không chứng minh provider thật chấp nhận request hoặc MySQL thực thi rollback/khóa đúng trong tình huống đồng thời.

Không cài dependency vào workspace chính, không khởi động lại server người dùng, không migrate/import DB, không gọi provider và không bật thanh toán để thực hiện QA này. Kết quả trên là baseline source v1.1, **chưa phải kiểm thử canvas chưa được viết**.

## 8. Gate kiểm thử cho lúc triển khai canvas

| Tầng | Trường hợp tối thiểu | Điều kiện báo đạt |
| --- | --- | --- |
| Unit và provider giả | Lưu/preview/checkout/resume/publish; revision conflict; quyền revoke; giá server; retry | Không mất nháp, không cấp quyền từ client, không tạo publish trùng |
| MySQL cô lập thật | Đồng thời tạo intent; callback replay; lỗi giữa settlement; owner/template; revoke; publish idempotency | Dữ liệu nhất quán sau commit/rollback, số grant/receipt đúng; có evidence từ DB QA |
| Browser và provider giả | Nhập chữ/ảnh, checkout rồi reload/quay về; pending/hủy; callback trước/sau redirect; paid nhưng publish lỗi | Khôi phục đúng nháp, không thu thêm, preview khớp snapshot, receipt cũ vẫn dùng được |
| Regression JSON | Luồng mẫu cũ, demo purchase, publish, QR, nhận quà, reply, auth | Không phá contract và dữ liệu legacy khi các cờ MySQL/payment tắt |
| Provider thật | Merchant callback, giao dịch chậm/mất callback, hỗ trợ/đối soát | Gate riêng được thực hiện với môi trường và quyền phù hợp; không suy từ mock |

Ưu tiên triển khai vẫn là canvas sender và lưu/publish nháp đúng. Các phát hiện payment được dùng để thiết kế điểm nối và phạm vi kiểm thử; chúng không tự cho phép thay đổi thanh toán, thực hiện giao dịch hoặc migration trên dữ liệu đang sử dụng.
