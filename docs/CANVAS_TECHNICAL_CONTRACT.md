# Hợp đồng kỹ thuật đề xuất cho canvas Momevia

Ngày rà soát: 17/11/2026. Baseline source: `6c44bdb`, package `1.1.0`.

**Trạng thái: đặc tả để triển khai, chưa có canvas, bảng, migration hoặc API mới nào trong tài liệu này được thực hiện.** Các tên trường, bảng, endpoint và quy tắc kỹ thuật bên dưới là đề xuất cần được kiểm chứng trong bước thiết kế và spike. Chúng không xác lập gói kinh doanh, giá, quyền thương mại, thời hạn lưu nháp hoặc chính sách riêng tư mới.

Tài liệu bổ sung cho [kế hoạch canvas](CANVAS_DESIGN_PLAN.md) và [prompt triển khai](CANVAS_IMPLEMENTATION_PROMPT.md). Phạm vi giao đầu là người gửi tự thiết kế/cá nhân hóa, lưu nháp, xem trước và xuất bản quà qua link/QR; công cụ Creator chuyên sâu triển khai sau.

## 1. Ràng buộc từ source hiện tại

| Bằng chứng | Ý nghĩa đối với canvas |
| --- | --- |
| `src/server/app.mjs:21` | Composition root và các module Identity/Catalog/Checkout/Gifts đã bất đồng bộ; module mới phải dùng interface async |
| `src/server/app.mjs:54` | API hiện nhận GET/HEAD/POST; endpoint đề xuất dùng GET/POST, không chỉ thêm PATCH ở router rồi bỏ qua method/origin guard |
| `src/modules/gifts/repositories.mjs:7`, `src/modules/catalog/repositories.mjs:7`, `src/modules/checkout/repositories.mjs:6` | Storage chọn riêng theo module, mặc định JSON; không có đồng bộ hai chiều khi đổi cờ |
| `src/infrastructure/mysql/client.mjs:52` | Transaction giữ một connection; các lần gọi repository dùng pool khác nhau không tự nằm trong một transaction |
| `database/migrations/001_initial.sql:14`, `:43`, `:69` | UUID dùng `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`; template ID dùng `VARCHAR(128)` với cùng charset/collation để giữ seed slug; không phải `BINARY(16)` |
| `database/migrations/001_initial.sql:56`, `:72`, `:85` | Template chưa có trạng thái draft; gift bắt buộc template ID có FK, nên chưa hỗ trợ blank publication ở MySQL |
| `src/modules/gifts/mysql.repositories.mjs:9`, `:32` | Payload JSON được giữ, nhưng cột ID/owner/template/content/TTL là nguồn có hiệu lực khi đọc; không chỉ thêm snapshot vào JSON rồi coi mapping đã hoàn tất |
| `src/modules/catalog/mysql.repositories.mjs:8`, `:32` | Catalog giữ payload và có khóa khi update; chưa có revision/CAS cho editor |
| `src/modules/gifts/gifts.service.mjs:42`, `:70` | Luồng tạo cũ luôn tìm template; public response hiện spread gift, cần projection riêng cho dữ liệu canvas |
| `src/modules/gifts/gifts.service.mjs:52`, `:62`, `src/modules/gifts/media.repository.mjs:11` | Ảnh ghi filesystem trước DB; có cleanup khi insert lỗi, nhưng filesystem và DB không có transaction chung |
| `src/modules/checkout/mysql.repository.mjs:27` | Quyền dùng mẫu MySQL lấy từ entitlement chưa revoke và đơn hợp lệ; canvas cần tái sử dụng service này |
| `src/modules/payments/payment.service.mjs:4`, `:39`, `:69` | Đã có payment foundation payOS/MoMo và webhook; canvas không tự bật provider hoặc tự cấp quyền từ redirect |

MySQL là hướng runtime đang có trong baseline này. Không dùng đề xuất PostgreSQL/JSONB của bản kế hoạch cũ để tạo adapter mới. Migration hiện tại cao nhất là `005_payment_receipts.sql`; số migration canvas phải kiểm tra lại tại thời điểm triển khai.

## 2. Tách tài liệu thiết kế khỏi dữ liệu quyền và vận hành

### 2.1 Các đối tượng và loại phiên bản

| Đối tượng | Trách nhiệm |
| --- | --- |
| `Design` | Envelope private do server quản lý: ID, owner, nguồn, policy, revision, tên, document, thời điểm cập nhật |
| `Document` | Mô tả có cấu trúc của cảnh, element, layout, binding, tương tác, asset reference; không chứa session, owner, hóa đơn hoặc lời đáp thật |
| `DesignVersion` | Bản nội dung bất biến tại publish hoặc checkpoint được hỗ trợ; không cần tạo một bản cho mỗi pointer move |
| `TemplateVersion` | Bản mẫu demo, schema cá nhân hóa, chính sách vùng được sửa và trạng thái kiểm duyệt; pha Creator bổ sung |
| `GiftPublication` | Gift/slug/TTL, runtime snapshot đã lọc, asset manifest và dữ liệu vận hành; phục vụ người nhận |
| `Asset` | File đã xử lý và metadata server: owner, loại, kích thước, trạng thái, storage key, quyền sử dụng, reference |

Các số phiên bản không dùng thay nhau:

- `schemaVersion`: định dạng document mà validator và renderer hiểu.
- `registryVersion` và `elementVersion`: hợp đồng của thư viện element/type, dùng khi nâng cấp hành vi.
- `revision`: số tăng đơn điệu của một nháp, dùng chống ghi đè và xác định nội dung publish.
- `templateVersionId`: định danh bất biến của phiên bản mẫu được dùng.
- `runtimeVersion`: phiên bản renderer/action engine đã chốt cho publication; chỉ lưu số phiên bản chưa đủ nếu runtime cũ không còn được phục vụ.

### 2.2 Nguồn và policy là dữ liệu server

Nguồn của design là một trong hai loại:

```json
{"kind":"blank"}
```

```json
{"kind":"template","templateId":"confetti","templateVersionId":"fbd8c225-19cf-4eec-b83f-329c5d5d67e1"}
```

Hai đoạn trên minh họa cấu trúc đề xuất, không phải ID phiên bản đã tồn tại. Template legacy chưa có version được adapter tạo thành preset có nguồn ghi nhận rõ; không gán một version ngẫu nhiên rồi coi là đã được duyệt.

Server xác lập source, owner, provenance và chính sách vùng chỉnh sửa khi tạo design. Payload save chỉ chứa nội dung được sửa và metadata được cho phép; không được ghi đè owner/source/policy. Server so nội dung với policy gốc, không chỉ tin thuộc tính `locked` do browser gửi.

Tên trường chuẩn trong hợp đồng này là `source.templateId`, `source.templateVersionId` và `element.elementVersion`; không dùng các alias `source.id`, `source.version` hoặc `element.version` lẫn trong API/document mới.

Phân biệt ba loại khóa:

1. Khóa thao tác của người dùng: tránh kéo nhầm layer; chủ design có thể mở.
2. Khóa của mẫu: hạn chế vùng hoặc thuộc tính được cá nhân hóa; thay đổi cần capability hợp lệ.
3. Hạn chế quyền tài nguyên: element/asset cần quyền sử dụng; mở khóa layer không cấp quyền đó.

Clone/duplicate remap node ID và action target nhưng giữ provenance, quyền tài nguyên và policy có hiệu lực. Không cho chuyển nguồn template thành blank bằng thao tác save hoặc sao chép để lách license. Copy từ mẫu chia sẻ không mang theo nội dung riêng hoặc reply của gift.

## 3. Document mẫu hợp lệ về cấu trúc JSON

Ví dụ này mô tả bản nháp blank hai cảnh trên artboard mobile. Đây là fixture đề xuất cho hợp đồng mới, không phải định dạng mà runtime hiện tại đã đọc được. Asset trong ví dụ phải được fixture tạo thật trước khi dùng trong bài kiểm thử tích hợp.

```json
{
  "schemaVersion": 1,
  "registryVersion": 1,
  "artboard": {
    "baseSize": {"width": 390, "height": 844},
    "layoutMode": "responsive-scene",
    "safeInsets": {"top": 24, "right": 20, "bottom": 24, "left": 20}
  },
  "entrySceneId": "scene-cover",
  "bindings": {
    "recipientName": {"type": "text", "value": "Mai"},
    "senderName": {"type": "text", "value": "An"},
    "message": {"type": "text", "value": "Chúc bạn một ngày thật vui!"}
  },
  "assets": [
    {"assetId": "76c98b18-48f6-4c4d-8a2d-2b46ca907011", "kind": "image"}
  ],
  "scenes": [
    {
      "id": "scene-cover",
      "name": "Mở quà",
      "background": {"kind": "solid", "color": "#FFF7EE"},
      "elementIds": ["text-recipient", "envelope-open"]
    },
    {
      "id": "scene-message",
      "name": "Lời chúc",
      "background": {"kind": "solid", "color": "#FFF7EE"},
      "elementIds": ["photo-memory", "text-message", "text-sender", "reply-card"]
    }
  ],
  "elements": [
    {
      "id": "text-recipient",
      "type": "text",
      "elementVersion": 1,
      "layout": {"x": 20, "y": 80, "width": 350, "height": 90, "rotation": 0},
      "props": {"textBinding": "recipientName", "fontToken": "heading", "fontSize": 32, "align": "center", "color": "#52256F"},
      "accessibility": {"role": "heading", "level": 1}
    },
    {
      "id": "envelope-open",
      "type": "envelope",
      "elementVersion": 1,
      "layout": {"x": 55, "y": 230, "width": 280, "height": 220, "rotation": 0},
      "props": {"preset": "classic", "label": "Mở món quà", "color": "#B98ADC"},
      "accessibility": {"label": "Mở món quà"},
      "actions": [{"on": "activate", "type": "goToScene", "targetSceneId": "scene-message"}]
    },
    {
      "id": "photo-memory",
      "type": "image",
      "elementVersion": 1,
      "layout": {"x": 45, "y": 40, "width": 300, "height": 220, "rotation": 0},
      "props": {"assetId": "76c98b18-48f6-4c4d-8a2d-2b46ca907011", "fit": "cover", "focalPoint": {"x": 0.5, "y": 0.5}, "radius": 16},
      "accessibility": {"alt": "Khoảnh khắc đáng nhớ của chúng mình"}
    },
    {
      "id": "text-message",
      "type": "text",
      "elementVersion": 1,
      "layout": {"x": 25, "y": 285, "width": 340, "height": 150, "rotation": 0},
      "props": {"textBinding": "message", "fontToken": "body", "fontSize": 22, "align": "center", "color": "#32243B"},
      "accessibility": {"role": "paragraph"}
    },
    {
      "id": "text-sender",
      "type": "text",
      "elementVersion": 1,
      "layout": {"x": 25, "y": 455, "width": 340, "height": 60, "rotation": 0},
      "props": {"textBinding": "senderName", "fontToken": "body", "fontSize": 18, "align": "right", "color": "#52256F"},
      "accessibility": {"role": "paragraph"}
    },
    {
      "id": "reply-card",
      "type": "reply",
      "elementVersion": 1,
      "layout": {"x": 20, "y": 545, "width": 350, "height": 250, "rotation": 0},
      "props": {"title": "Gửi lời đáp", "submitLabel": "Gửi lời đáp"},
      "accessibility": {"label": "Gửi lời đáp cho người tặng"}
    }
  ],
  "responsive": {
    "textOverflow": "expand-flow",
    "sceneOverflow": "scroll",
    "desktop": {"maxContentWidth": 720, "align": "center"}
  }
}
```

Registry chuyển role/type sang phần tử HTML hợp lệ; ví dụ `paragraph` ở đây là ý nghĩa domain, không phải yêu cầu đặt `role="paragraph"` tùy tiện trên mọi node. Reply element không chứa gift ID, auth token hoặc API URL do người dùng nhập; runtime adapter gắn gift đang mở. Preview thay adapter này bằng mô phỏng, không gọi API ghi reply thật.

### 3.1 Bất biến cần validator bảo vệ

- ID duy nhất, entry scene tồn tại, mỗi element thuộc đúng scene theo mô hình đợt đầu; target/action/binding/asset reference phải tồn tại và đúng type.
- Numeric fields hữu hạn; width/height dương; opacity, crop/focal point và các enum có miền hợp lệ. Không cho `NaN`, `Infinity`, CSS expression hoặc object lồng vô hạn.
- Props/style chỉ nhận field của type tương ứng. Không đưa `innerHTML`, event handler, JavaScript expression hoặc URL ngoài tùy ý vào schema.
- Element/version chưa hỗ trợ trả lỗi có đường dẫn; không âm thầm bỏ node rồi báo lưu thành công.
- Binding cho phép trường định nghĩa trước; văn bản không được diễn dịch thành HTML. Personalization schema của template là server-owned.
- Font dùng token/asset được quản lý; không nhận remote font URL tùy ý. Giá trị transform được dựng bằng API/CSS đã thử dưới CSP hiện tại.
- Kích thước logic không phải kích thước CSS pixel của viewport. Pointer mapping phải xét zoom/pan; responsive text/form có reflow và overflow, không chỉ scale cả trang xuống.
- Duplicate remap scene/element ID và mọi target; xóa node phải xử lý target phụ thuộc. Undo/redo phục hồi cả tham chiếu, không chỉ hình vẽ.
- Ba cảnh của legacy là preset, không phải giới hạn định dạng. Giới hạn an toàn bytes/nodes/depth/actions do cấu hình kỹ thuật và fixture chứng minh, không tự biến thành gói trả phí.
- View state như zoom, selection, mở panel, lịch sử undo và khóa tránh kéo nhầm không vào public snapshot.

Validator có hai chế độ `draft` và `publish` trên cùng schema. Nháp có thể lưu placeholder đã định nghĩa rõ, như `assetId: null` khi chưa chọn ảnh hoặc action chưa có target; đây là trạng thái chưa hoàn thiện được inspector hiển thị. Khi một reference có giá trị thì nó phải hợp lệ, không chấp nhận ID giả/dangling hoặc type/prop nguy hiểm ngay cả ở nháp. Publish bắt buộc mọi nội dung/action/media cần dùng đã hoàn thiện, binding chuẩn hợp lệ và assets ready. Lưu được nháp không đồng nghĩa preflight đã đạt.

## 4. Hai profile lưu trữ được hỗ trợ có chủ đích

| Profile đề xuất | Phạm vi bảo đảm | Điều kiện từ chối |
| --- | --- | --- |
| JSON pilot | Một process; Designs/Gifts/metadata asset của canvas cùng adapter JSON; ghi có thứ tự, revision và publication recovery rõ | Không nhận ghi từ nhiều process/instance; không tuyên bố transaction ACID nhiều file |
| MySQL | Identity/Catalog/Designs/Gifts/metadata asset thuộc cùng topology MySQL được kiểm thử; Checkout MySQL khi dùng entitlement trả phí; publication dùng cùng tx connection | Thiếu migration, thiếu dữ liệu FK, không có UnitOfWork hoặc profile chưa được kiểm thử thì canvas publish chưa sẵn sàng |

Support không tham gia transaction publication và có thể giữ profile riêng. Các kết hợp storage legacy đang có không bị tự đổi. Canvas mới không mặc nhiên hỗ trợ `Designs=mysql` rồi `Gifts=json` bằng hai lần ghi độc lập. Nếu muốn hỗ trợ, cần đặc tả phối hợp/recovery riêng; trước đó readiness trả lỗi rõ thay vì fallback âm thầm sang storage khác.

Đề xuất cờ `DESIGNS_STORAGE=json|mysql` và readiness cho canvas, nhưng chưa thêm vào `.env`. Chọn profile phải được ghi nhận trong startup/config diagnostics an toàn, không in credentials. Domain gọi interface async trong cả hai profile, không tạo nhánh UI khác nhau theo loại DB.

Identity JSON và Gifts MySQL có thể thiếu user FK khi có tài khoản mới; Catalog JSON và Gifts MySQL có thể thiếu template mới. Đối chiếu snapshot một lần không bảo đảm hai kho tiếp tục đồng bộ. Không tự ghi bản sao user/template để chữa lỗi FK.

## 5. Mapping MySQL và migration cộng thêm

### 5.1 Các bảng đề xuất

| Bảng | Trường chính và bất biến |
| --- | --- |
| `designs` | `id CHAR(36) ascii_bin`, owner FK users, title, source kind, template/version refs, revision, schema version, document `JSON`, timestamps UTC; index owner + updated + id |
| `design_create_requests` | Owner + create mutation ID unique, request hash, design ID/kết quả đã tạo; commit cùng design, không cần design ID trước khi tạo |
| `design_mutations` | Design + owner + mutation ID, request hash, resulting revision, response metadata; unique theo design + mutation ID; cùng key khác nội dung bị từ chối |
| `design_versions` | ID, design ID, revision, schema/runtime version, immutable document JSON/hash, thời điểm; unique design + revision |
| `design_assets` | ID, owner, MIME, size, dimensions/duration, content hash, storage key, trạng thái, license/provenance; metadata private |
| `design_asset_refs` | Design ID + asset ID; quan hệ draft, được cập nhật cùng save |
| `gift_asset_refs` | Gift ID + asset ID; pin reference theo publication; không cascade từ xóa draft |
| `gift_publication_requests` | Owner + idempotency key unique, request hash, design/revision, gift ID, state/timestamps; kết quả được commit cùng gift |
| `checkout_design_contexts` | Context ID, owner/order/design, design revision/document hash, template/version nguồn, mutation key và created time; một order có nhiều context, không unique riêng order ID |
| `template_versions` | Pha Creator: template ID, version, document demo, policy/personalization schema, submission/review data; approved version bất biến |

Các FK UUID dùng đúng kiểu/charset/collation của bảng hiện có; template ID tiếp tục `VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin`. Nội dung tiếng Việt dùng `utf8mb4`, thời gian `DATETIME(3)` UTC, document dùng MySQL `JSON`. Không dùng `app.*`, `JSONB` hoặc ép template seed thành UUID.

Revision dùng số nguyên tăng đơn điệu có range được kiểm tra trong JS và SQL. Nếu dùng BIGINT, adapter phải quy định xử lý chuỗi/số an toàn, không tự ép số vượt `Number.MAX_SAFE_INTEGER`. Date/boolean/JSON converters cần round-trip tests; không dựa vào cấu hình driver để đoán kiểu.

Cột quan hệ là nguồn có hiệu lực cho owner, source, version, status, TTL. Không duy trì hai giá trị mâu thuẫn trong JSON và cột. Reader mới cần allowlist các trường payload được hỗ trợ và đối chiếu invariant.

### 5.2 Blank gift và giữ dữ liệu cũ

Đề xuất thêm discriminator `source_kind` cho publication và cho `gifts.template_id` nullable trong migration mới, giữ FK cho giá trị không null; thêm liên kết `design_version_id` nullable. Chưa thực thi lựa chọn này; cần review mapping cùng repository/importer trước migration.

| Loại gift | template reference | design version/snapshot | Renderer |
| --- | --- | --- | --- |
| Legacy | Giữ template ID hiện hữu, bắt buộc | Không bắt buộc | Legacy |
| Canvas từ mẫu | Template ID và version nguồn được xác minh | Bắt buộc | Canvas |
| Canvas từ blank | Template ID null | Bắt buộc | Canvas |

Constraint cần ngăn legacy thiếu template, blank thiếu design version hoặc template-based gift mất provenance. Không tạo template giả, không biến private design thành public template giá 0. Gift mới có display title riêng để dashboard không buộc lấy tên từ mẫu.

Recipient/sender/message là cột bắt buộc hiện tại: contract đợt đầu tiếp tục yêu cầu các binding chuẩn khi publish và map nhất quán sang snapshot/summary. Nếu sau này cho phép quà hoàn toàn không có lời chúc, cần một thay đổi domain có kiểm thử riêng; không điền dữ liệu giả chỉ để vượt NOT NULL.

Migration triển khai theo thứ tự: kiểm schema/version hiện tại → tạo bảng mới → bổ sung cột/constraint tương thích → kiểm fixtures cũ và mới → cập nhật reader/writer/importer → chỉ bật writer canvas khi readiness đạt. Số `006` chỉ là dự kiến tại baseline này. Không sửa migration 001–005 đã áp dụng; MySQL DDL có thể dở dang, cần precondition và hướng khôi phục tiến thay vì tuyên bố rollback DDL toàn bộ.

## 6. API async đề xuất

Toàn bộ endpoint trong mục này **chưa tồn tại**. Response/error mới dùng cấu trúc rõ nhưng không đổi shape endpoint legacy ngoài phạm vi cần thiết.

| Method / đường dẫn | Hợp đồng |
| --- | --- |
| `GET /api/designs/designs` | Owner-only list metadata, pagination; không trả toàn bộ document/asset manifest |
| `POST /api/designs/designs` | Tạo từ blank hoặc template được phép; server xác lập owner/source/policy; idempotency theo owner + create mutation ID |
| `GET /api/designs/designs/:id` | Owner-only; trả document, revision và capability/constraint để UI giải thích |
| `POST /api/designs/designs/:id/save` | `expectedRevision`, `mutationId`, title/document được phép; validate, CAS, lưu kết quả mutation cùng thay đổi |
| `POST /api/designs/designs/:id/duplicate` | Clone trong phạm vi quyền, remap IDs, giữ provenance/policy; idempotency để retry không tạo nhiều design |
| `POST /api/designs/designs/:id/archive` | Tombstone/ẩn design; không xóa snapshot hoặc asset còn được gift dùng |
| `POST /api/designs/designs/:id/assets` | Upload có giới hạn và xác thực loại; trả asset ID/status; không đưa file bytes vào document |
| `GET /api/designs/designs/:id/assets/:assetId` | Owner-only metadata/content theo contract; không dùng path do client cung cấp |
| `POST /api/designs/designs/:id/preflight` | Kiểm revision/document/source/quyền/assets; trả authorization enum, document hash, blockers/warnings và summary; không tạo gift/charge |
| `POST /api/gifts/gifts/from-design` | Nhận design ID, expected revision/document hash, idempotency key; chốt publication trong UnitOfWork |
| `GET /api/gifts/gifts/:slug/assets/:assetId` | Chỉ asset nằm trong publication đó, kiểm TTL; không mở thư viện asset của chủ gift |
| `POST /api/checkout/payments/orders/:orderId/design-contexts` | Gắn context design đã lưu vào order cùng owner/template; một order có nhiều context; không gọi provider trong transaction |
| `GET /api/checkout/payments/orders/:orderId/design-contexts` | Owner-only list context metadata có phân trang; dùng khi result page không còn context ID để người dùng chọn đúng nháp |
| `GET /api/checkout/payments/orders/:orderId/design-contexts/:contextId` | Owner-only, trả context hợp lệ và route tiếp tục nội bộ; không tự cấp quyền hoặc publish |

Đăng ký `/api/designs` ở composition root và quyết định hỗ trợ legacy topology một cách rõ ràng. Giữ GET/POST và origin guard. Upload binary/multipart cần parser riêng có streaming/size limit; `parseJson()` hiện không phải parser upload. Không tăng giới hạn JSON chung để mang toàn bộ album base64.

### 6.1 Tạo và lưu nháp

Tạo blank:

```json
{"source":{"kind":"blank"},"presetId":"envelope-basic","mutationId":"7be1edd8-7f44-40c4-8a41-70f0b5edc910"}
```

Create chưa có design ID, nên dùng namespace idempotency riêng `(ownerId, createMutationId)`, tách khỏi save mutation `(designId, mutationId)`. Server băm request đã chuẩn hóa và lưu creation result cùng design trong một transaction/aggregate có recovery; retry cùng key/hash trả cùng design, cùng key khác source/preset trả 409. Không tạo design lần hai vì client mất ACK; clone tạo design mới cũng cần creation intent riêng có source và request hash.

Save minh họa hình thức; `document` phải là document đầy đủ hợp lệ theo schema, không dùng object rỗng này làm fixture hợp lệ:

```json
{"expectedRevision":4,"mutationId":"76628225-af8c-4bd8-9e53-1d491a8e2c3c","title":"Quà sinh nhật Mai","document":{}}
```

ACK thành công:

```json
{"designId":"2b7176ba-1193-47b4-8b44-e614c5413fb4","mutationId":"76628225-af8c-4bd8-9e53-1d491a8e2c3c","savedRevision":5,"documentHash":"sha256:<server-computed>","replayed":false}
```

Trên MySQL, kiểm tra mutation trước CAS; cùng mutation/hash đã hoàn tất trả lại kết quả cũ. Mutation mới cập nhật theo owner + ID + expected revision và lưu ACK metadata trong cùng tx. Kiểu SQL mục tiêu là `UPDATE ... SET revision=revision+1 ... WHERE id=? AND owner_id=? AND revision=?`, kiểm `affectedRows`.

**Mất ACK không đồng nghĩa save thất bại.** Client retry đúng mutation ID và payload hash, không tự sinh key mới. Server phân biệt replay với request mới stale. ACK trả muộn của mutation cũ không được thay document hoặc đánh dấu sạch cho thay đổi mới hơn. Client có hàng đợi save, snapshot hash/sequence và chỉ hiện Đã lưu cho nội dung đã được xác nhận.

Conflict trả 409 kèm revision mới nhất trong phạm vi owner. UI giữ bản local, cho tải bản server hoặc tạo bản sao/giải quyết; không tự last-write-wins. Retention của mutation records cần cấu hình kỹ thuật và tài liệu hóa; hết retention vẫn phải fail CAS rõ, không tự áp lại thao tác cũ.

### 6.2 Preflight và publish

Preflight request:

```json
{"expectedRevision":5}
```

Response minh họa:

```json
{"designId":"2b7176ba-1193-47b4-8b44-e614c5413fb4","revision":5,"documentHash":"sha256:<server-computed>","authorization":{"status":"allowed","reasonCodes":[]},"canPublish":false,"blockers":[{"code":"ASSET_NOT_READY","path":"elements.photo-memory.props.assetId","message":"Ảnh đang xử lý."}],"warnings":[],"summary":{"sceneCount":2,"assetCount":1}}
```

Preflight không cấp quyền và không giữ lock dài. Publish kiểm tra lại tất cả điều kiện tại revision được yêu cầu; không tin `canPublish` hoặc token kiểm tra cũ từ browser. Warning không bị tự nâng thành blocker kinh doanh nếu chưa có policy được chốt.

`authorization.status` bắt buộc là `allowed`, `needs_template_license`, `denied` hoặc `unavailable`. `allowed` chỉ nói quyền cho phép, chưa bảo đảm asset/document sẵn sàng; `needs_template_license` xác định thiếu quyền mẫu có thể giải quyết qua checkout; `denied` là policy/capability từ chối; `unavailable` là không kiểm tra được nguồn quyền. Mỗi trạng thái khác `allowed` có `reasonCodes` và `canPublish=false`. Lỗi đọc Catalog/Checkout trả 503 với trạng thái `unavailable`, không đổi thành danh sách quyền rỗng, không coi lỗi là mẫu miễn phí hoặc đã được phép. Preflight hoàn tất nhưng thiếu license/policy có thể trả kết quả kiểm tra 200 với blocker tương ứng; thao tác publish vẫn trả 402/403 theo điều kiện thực tế.

Publish request:

```json
{"designId":"2b7176ba-1193-47b4-8b44-e614c5413fb4","expectedRevision":5,"expectedDocumentHash":"sha256:<server-computed>","idempotencyKey":"3f802eae-aa55-4683-8b7a-73a06068bdf2"}
```

Publish response:

```json
{"gift":{"id":"2b1e066d-cda1-471e-99f1-efb9501fa653","slug":"examplePublicationSlug12345678901","url":"https://example.test/g/examplePublicationSlug12345678901","title":"Quà sinh nhật Mai","expiresAt":"2027-11-17T00:00:00.000Z"},"publishedRevision":5,"replayed":false}
```

URL và thời hạn trên chỉ minh họa shape; server lấy base URL/config và thời điểm thật, không nhận TTL/paid status tùy ý từ client. `expectedDocumentHash` là điều kiện so sánh với hash do server tính lại trên document đã chuẩn hóa của revision yêu cầu; không phải chứng cứ quyền hay nội dung do client xác nhận. Quy tắc canonical serialization/hash cần cố định, có version và fixture; không băm JSON theo thứ tự key tình cờ. Mismatch trả 409, không tự publish revision khác.

Cùng owner/key/request hash trả cùng gift, kể cả sau restart; request hash bao gồm design ID, revision, expected document hash và các tùy chọn publish được cho phép. Cùng key khác payload trả 409. Key mới là ý định xuất bản mới, cần UI chủ động tạo sau khi người dùng lựa chọn; double-click dùng cùng key. Khi mất ACK publish, client dùng lại chính `POST /api/gifts/gifts/from-design` với body/key cũ để lấy kết quả đã commit; đây là semantics replay của API đề xuất, không phải endpoint tra cứu trạng thái đã có trong v1.1.

### 6.3 Lỗi và phân quyền

| HTTP | Trường hợp |
| --- | --- |
| 400 / 415 | JSON/parser/content type hoặc cấu trúc request không hợp lệ |
| 401 | Session không còn hợp lệ |
| 403 | Actor đã xác định nhưng không có capability; policy bị vi phạm |
| 404 | Design/asset không tồn tại hoặc không thuộc phạm vi được xem; không tiết lộ owner khác |
| 402 | Giữ contract hiện tại khi thiếu license template tại publish; không tự diễn giải thành yêu cầu thanh toán nhận quà |
| 409 | Revision conflict, key reuse khác payload, source/version thay đổi không thể tự xử lý |
| 410 | Gift hết hiệu lực theo contract hiện tại |
| 413 | Body/media/resource budget vượt giới hạn kỹ thuật |
| 422 | Document có cấu trúc đọc được nhưng sai schema/target/element hoặc điều kiện publish không đạt |
| 429 / 503 | Rate limit, xử lý asset bận hoặc storage/profile chưa sẵn sàng |

Lỗi endpoint mới có `code`, `message`, `details` đã lọc. Không trả SQL, filesystem path, credentials hoặc nội dung design người khác. Chi tiết đường dẫn validation đủ để inspector trỏ tới element lỗi. `HttpError/sendError` hiện chỉ trả `error`; mở rộng phải giữ response legacy tương thích, không đổi toàn bộ API ngoài mục tiêu.

## 7. Server preflight và UnitOfWork xuất bản

Trình tự đề xuất cho MySQL:

1. Resolve session hiện tại qua Identity; xác thực owner và lấy design/revision nguồn. Kiểm request/resource limits trước xử lý nặng.
2. Validate document và policy; resolve binding; xác định asset refs; dựng public snapshot theo allowlist. Xử lý file/transcode phải hoàn tất trước transaction.
3. Mở PublicationUnitOfWork được inject ở hạ tầng, dùng cùng một connection cho các repository tham gia.
4. Đọc/khóa publication key và design theo thứ tự thống nhất. Trả kết quả đã commit nếu cùng key/request hash; từ chối revision stale, document hash không khớp hash canonical server hoặc khác owner/source.
5. Kiểm policy/entitlement và trạng thái asset trong boundary đã quy định. Khóa/check các reference cần thiết để publish không đua với revoke/GC. Không coi SELECT ở pool khác là phần của transaction.
6. Insert hoặc lấy đúng immutable design version; insert gift/public snapshot; pin asset refs; lưu publication result/idempotency trong cùng transaction.
7. Commit rồi mới trả success. Lỗi trước commit rollback DB; lỗi truyền response sau commit được giải quyết bằng retry cùng key.
8. Công việc phụ như thumbnail/cleanup/notification không làm hỏng kết quả publish đã commit; dùng trạng thái/job riêng nếu được triển khai, không tự gửi mail trong scope canvas.

Designs/Catalog/Gifts/Checkout giữ ownership nghiệp vụ. UnitOfWork phối hợp adapter qua tx context rõ; domain không import repository module khác. Không chỉ gọi `designs.save()` rồi `gifts.insert()` và tuyên bố atomic.

Không giữ DB lock khi gọi payment provider, upload file, browser hoặc dịch vụ ngoài. Có lock order, timeout và retry deadlock hữu hạn; retry giữ key/hash. Quyền revoke đồng thời cần định nghĩa semantics kiểm quyền tại publication và test hai connection; lựa chọn này phải được review, không suy ra từ preflight.

### 7.1 Hợp đồng JSON pilot tương đương ở mức hành vi

JSON không có transaction nhiều file. Đề xuất lưu idempotency identity/hash cùng gift snapshot trong một record publication, dùng một lần ghi file authoritative cho kết quả cuối; không đặt gift và publication key vào hai file rồi coi rename từng file là atomic tổng thể.

Critical section theo design/publication intent phải giữ từ kiểm revision tới chốt publication trong một process. Draft và mutation ACK cần cơ chế aggregate/journal có recovery đã đặc tả; không tự sửa format mảng legacy mà không có reader tương thích. Publish snapshot tự chứa nội dung cần đọc, không phụ thuộc việc cập nhật marker trong draft sau đó có thành công hay không.

Asset ready trước publish; trong pilot chưa bật GC có thể xóa asset đang dùng cho tới khi cơ chế pin/recovery được chứng minh. Khi có GC, các gift record đã commit là nguồn reference authoritative được đối chiếu; marker phụ thiếu do crash không được làm xóa media. Kiểm restart trước/giữa/sau các bước ghi, không chỉ thử retry trong cùng process.

## 8. Media và filesystem không atomic với DB

Lifecycle đề xuất: `uploading → processing → ready`, hoặc `failed`; `ready → delete_pending → removed` chỉ khi không còn reference và đủ điều kiện retention đã chốt.

- Tiếp tục validator ảnh PNG/JPEG/WebP, giới hạn bytes/pixels và re-encode bỏ EXIF hiện tại; nhiều ảnh không đồng nghĩa bỏ giới hạn từng ảnh hoặc tăng body chung.
- Upload có ownership, upload intent/idempotency và giới hạn đồng thời; không giữ SQL transaction xuyên thời gian upload.
- Document chỉ tham chiếu asset ID. Asset ID/content hash không tự cấp quyền truy cập; không dùng hash công khai để dò ảnh riêng.
- Chỉ asset `ready` được publish. `ready` phải có file tồn tại, metadata hợp lệ, quyền sử dụng và checksum được xác nhận theo adapter.
- Draft read owner-only; public asset qua gift đã pin asset đó và còn hiệu lực. Template public chỉ dùng demo asset được phép phân phối.
- Khi insert DB thất bại, cleanup chỉ file tạm/request-owned chưa có refs; không xóa shared asset để bù một transaction khác.
- GC có grace period kỹ thuật, kiểm cả draft/template/publication refs và kiểm lại trước unlink. Race publish-vs-GC phải có test, không chỉ giữ một refcount dễ lệch.
- Không unlink file trong DB transaction rồi kỳ vọng rollback phục hồi file. Staging, tombstone và reconciliation cần trạng thái rõ.
- Xóa/archive design không xóa gift đã gửi. Hết hạn gift không tự thay retention policy; việc xóa vĩnh viễn thuộc quyết định dữ liệu riêng.
- Backup/restore gồm DB metadata và media bytes. Chuyển object storage là thay adapter có kiểm chứng, chưa được tự thực hiện trong kế hoạch này.

## 9. Projection public, legacy và phiên bản renderer

API list dùng metadata nhỏ: ID/title/thumbnail/status/updated time và quyền thao tác cần hiển thị. Detail owner trả document và policy UI cần biết; không trả storage key/license chứng từ nội bộ nếu không cần.

Public gift chỉ gồm slug, display title, nội dung hiển thị/binding đã resolve, public scene/element props, asset URL hợp lệ, runtime/schema version, TTL và reply capability theo contract. Không trả owner, design draft ID, editable policy, private source chain, payment/order/entitlement record, mutation key hoặc filesystem path.

Snapshot public được tạo bằng allowlist server-side; không spread `Design` hoặc payload từ DB. Converters phải giữ các trường hợp lệ qua save/load nhưng không tự mở public field mới. Có regression cố tình thêm field private vào fixture để kiểm nó không lọt response.

Gift legacy không có discriminator/schema snapshot tiếp tục renderer cũ. Template legacy được adapter đọc thành preset khi tạo nháp mới, không ghi lại source data hàng loạt. Reply/link/QR/TTL hiện tại giữ nguyên; preview không có side effect reply thật.

Version reader phải có hành vi xác định: hỗ trợ legacy và các schema đã publish; schema chưa biết trả fallback/thông báo an toàn, không âm thầm drop node. Để publication ổn định qua nâng runtime, cần giữ renderer tương thích hoặc migration có kiểm chứng trên fixtures; chỉ gắn `runtimeVersion` vào record mà luôn tải engine mới không bảo đảm bất biến hành vi.

## 10. Quay lại editor sau payment v1.1

Tái sử dụng `/api/checkout/payments/*`, `checkout.hasLicense` và `/payment-result/:orderId` hiện có. Không thêm gateway thứ hai, không nhận `paid=true` từ browser, không bật `PAYMENT_ENABLED/PAYMENT_LIVE_ENABLED` trong task canvas.

Trước rời editor để thanh toán, lưu nháp và nhận ACK; giữ resume context gồm design ID, revision/hash đã lưu và route nội bộ hợp lệ, ràng buộc với owner. API order/status/receipt v1.1 hiện chưa lưu design context. Không thêm một trường `designId` có thể bị ghi đè trên order: intent đang unique theo user/template nên hai nháp của cùng người dùng có thể cùng quay về một order.

Contract context đề xuất là quan hệ nhiều bản ghi `(ownerId, orderId, designId, contextId)`. Bảng `checkout_design_contexts` có `context_id CHAR(36) ascii_bin` làm PK, các FK owner/order/design, `design_revision`, `document_hash`, template/version nguồn, mutation key/request hash và created time. Unique idempotency theo owner + order + context mutation key; không unique riêng order, không last-write-wins design. Khi một design có revision mới, tạo context mới có chủ đích thay vì sửa context đang được tab khác sử dụng.

Body gắn context qua API POST đề xuất ở mục 6:

```json
{"designId":"2b7176ba-1193-47b4-8b44-e614c5413fb4","expectedRevision":5,"expectedDocumentHash":"sha256:<server-computed>","mutationId":"e48dbb1e-4b51-462c-a265-f0ebc2c3e354"}
```

Shape context trả về:

```json
{"contextId":"7b7308d9-c6c2-4421-bf6d-a7ef71ef804f","orderId":"6f30c6a2-5ae6-4a80-9518-994c76d49abe","designId":"2b7176ba-1193-47b4-8b44-e614c5413fb4","designRevision":5,"documentHash":"sha256:<server-computed>","source":{"kind":"template","templateId":"sample-paid-template","templateVersionId":"fbd8c225-19cf-4eec-b83f-329c5d5d67e1"},"resumePath":"/design/2b7176ba-1193-47b4-8b44-e614c5413fb4","replayed":false}
```

ID/source ở ví dụ chỉ minh họa shape, chưa có các bản ghi tương ứng trong source. Server lấy owner từ session; xác minh order cùng owner, design cùng owner, source template của design khớp template trong order và revision/hash hợp lệ. Source/version trả về từ design đã xác minh, không nhận ghi đè từ body attach. Context cho blank không gắn vào đơn mua template. Số tiền lấy từ Catalog/intent/order server theo flow payment hiện có; attach context không nhận amount, đổi số tiền hoặc tạo entitlement.

Tạo/get context là thao tác nội bộ không gọi provider trong transaction. Nếu cần tạo intent, gọi flow payment hiện có với boundary riêng rồi attach context idempotent; attach thất bại không giả hủy intent hoặc phát sinh order thứ hai. Giữ context ID cụ thể trong tab/điều hướng nội bộ; GET context kiểm cả order và context thuộc owner, không chọn nháp gần nhất khi order có nhiều context. Không đưa document riêng, credentials hoặc arbitrary redirect URL vào query string. Nếu mất context ID hoặc mở result ở tab khác, dùng GET list context metadata cho chủ đơn chọn thiết kế, hoặc quay Studio; không tự đoán draft. Danh sách chỉ gồm context ID, design ID/title/revision và trạng thái tiếp tục cần thiết, không document hoặc asset riêng.

Sau return/cancel hoặc reload, đọc trạng thái từ server, resolve đúng context, tải lại design, đối chiếu revision/hash và recheck license. Thanh toán thành công hoặc webhook callback không tự publish: người dùng vẫn xem lại nội dung và thực hiện ý định xuất bản. Pending/cancel/error giữ nguyên draft; không mất thiết kế và không phát quà nửa vời.

`MySqlCheckoutRepository.hasLicense()` hiện nhận entitlement của `paid` hoặc `demo_paid` test phù hợp; đợt canvas giữ service làm nguồn quyền, không sao chép SQL điều kiện vào frontend. Sandbox/demo không là bằng chứng thu tiền thật. Việc thay chính sách license/revoke/quyền nhúng đã phát hành là hạng mục riêng cần chốt.

## 11. Import, rollback và bật tính năng

Import hiện tại kiểm mọi gift có template (`database/scripts/import-gifts-checkout.mjs:126`, `database/scripts/prepare-import.mjs:156`). Canvas cần format export/import có version cho designs, snapshots, assets và refs; importer legacy phải từ chối rõ record mới chưa hỗ trợ, không strip snapshot hoặc ép template giả.

Kiểm số bản ghi, ID, checksum document/media, FK, owner và source trước/sau import. Đổi cờ storage không copy dữ liệu và không phải rollback an toàn. Không tự dual-write JSON/MySQL hoặc merge dữ liệu hai nguồn.

Rollout đề xuất tách khả năng **đọc publication canvas** khỏi **tạo/chỉnh/xuất bản canvas**. Khi tắt writer để rollback, reader canvas và media route phải tiếp tục phục vụ quà đã phát hành. Không rollback về binary không hiểu snapshot trong khi vẫn còn link canvas hoạt động. Giữ migration/bảng mới cho đến khi có kế hoạch xử lý dữ liệu và kiểm restore.

Thứ tự bật: reader tương thích → schema/storage readiness → draft/editor cho nhóm QA → publish cho fixture → kiểm link sau restart/rollback writer → mở cho người dùng trong phạm vi được duyệt. Không dùng flag để bỏ qua entitlement hoặc validator.

## 12. Bằng chứng kiểm thử cần có

| Gate | Bằng chứng cần thu |
| --- | --- |
| Unit/domain | Schema/type/version, duplicate/remap, policy bypass, binding, projection, public snapshot, command/history; fixtures tiếng Việt |
| Repository contract | Cùng use case qua JSON và MySQL fake, async round-trip, cột authoritative và payload, error mapping |
| JSON tích hợp | Data/cổng tạm; save ACK/replay/conflict, restart/crash recovery, publish retry, cleanup, legacy gifts |
| MySQL 8.4 thật | Database cô lập, migrations và fixtures; FK/collation/checks; hai connection CAS/publish; rollback/deadlock/restart; GC/revoke races |
| Browser | Blank/template → save/reload → preview → publish → anonymous recipient/reply/QR; mobile/keyboard/IME/CSP; preview không ghi thật |
| Rollout/recovery | Tắt writer nhưng link canvas còn đọc; restore DB + media; importer từ chối format không hỗ trợ; snapshot cũ vẫn chạy |

`npm run test:database` hiện chạy `tests/unit/mysql-*.test.mjs`. Các file dùng fake client/pool hoặc đọc SQL text: `mysql-client.test.mjs:19`, `mysql-gifts-checkout.test.mjs:15`, `mysql-schema.test.mjs:6`. Đây không phải bằng chứng transaction/locking trên MySQL thật. Payment unit/mock cũng không thay provider E2E.

Fixture `tests/integration/architecture.mjs:74` kế thừa `process.env`; trước khi chạy gate JSON phải ép các `*_STORAGE=json`, `PAYMENT_ENABLED=false`, `PAYMENT_LIVE_ENABLED=false` trong process kiểm thử riêng. Không sửa `.env` người dùng hoặc để fixture tự kết nối DB host. Gate MySQL phải dùng DB/schema/credentials cô lập và xác minh target trước mọi migration/cleanup.

Tại lượt cập nhật kế hoạch này, nhóm rà soát đã ghi nhận 88 unit/mock PASS và gate API/browser JSON cô lập PASS. Các kết quả đó chỉ xác nhận baseline hiện tại; **canvas chưa triển khai và MySQL thật cho canvas chưa chạy**. Mỗi bước triển khai phải báo PASS/FAIL/BLOCKED/NOT RUN đúng phạm vi, không suy từ mock sang DB hoặc từ API sang UX.

## 13. Quyết định cần ghi nhận trước khi viết mã phụ thuộc

| Quyết định | Hướng đề xuất | Không tự suy ra |
| --- | --- | --- |
| Storage đầu tiên | Hai profile có contract chung; chọn profile triển khai dựa trên môi trường đã xác minh | Không đổi storage dữ liệu đang dùng |
| Blank publication | Source discriminator, nullable template FK có constraint và design version bắt buộc | Không tạo template giả hoặc nới FK không kiểm soát |
| Template legacy version | Adapter/preset ghi nguồn có thật; snapshot nguồn bất biến khi tạo design | Không bịa approved version |
| Authorization tại publish | Recheck trong boundary rõ, test revoke/save/GC race | Preflight thành công không cấp quyền vĩnh viễn |
| Nháp và mutation retention | Cấu hình kỹ thuật có recovery/giới hạn lưu trữ rõ | Không tự chốt gói hoặc thời hạn mất dữ liệu người dùng |
| Quà đã phát hành | Immutable publication; thay đổi tạo lần xuất bản mới trong đợt đầu | Không sửa cùng slug/TTL hoặc chính sách lời đáp âm thầm |
| Creator/community | Mở sau sender, version/review/demo assets riêng | Giá 0 không đồng nghĩa private hoặc có quyền phân phối asset |

Các lựa chọn kỹ thuật được thử bằng spike/fixtures trước khi phụ thuộc. Quyết định sản phẩm còn mở chỉ chặn phần phụ thuộc trực tiếp; các phần độc lập vẫn có thể triển khai theo phạm vi được giao.
