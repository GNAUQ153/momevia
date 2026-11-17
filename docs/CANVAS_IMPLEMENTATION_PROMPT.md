# Prompt triển khai canvas Momevia trên baseline v1.1

Bản cập nhật ngày 17/11/2026, baseline `6c44bdb`. Prompt này thay bản JSON/PostgreSQL cũ. Sao chép khối dưới đây vào cuộc trò chuyện triển khai.

```text
Làm việc tại P:\entrepreneuer\project\momevia.

MỤC TIÊU
Triển khai canvas cho người gửi cá nhân hóa và tự thiết kế quà web tương tác trước; Creator chuyên sâu sau. Hoàn tất bước 0–5 của kế hoạch tổng, tương ứng W00–W11: blank/template → draft → save/reload/edit → preview → kiểm quyền/checkout khi cần → publish → link/QR → recipient miễn phí không đăng nhập. Chưa triển khai W12–W15 hoặc bật merchant live.

A. ĐỌC ĐÚNG BASELINE
1. Bắt đầu bằng git status --short --branch và đọc AGENTS.md nếu có. Nhánh kế hoạch feat/canvas-design-plan đã đồng bộ tới 6c44bdb/v1.1; xác minh trạng thái hiện tại. Giữ WIP .gitignore và tài liệu. Backup local/canvas-replan-20261117/before-sync và stash trước đồng bộ chỉ để phục hồi lịch sử, không apply lại lên kế hoạch mới. Không reset, force, tự pull/merge/rebase/commit/push/deploy hoặc migrate dữ liệu thật.
2. Đọc đủ docs/CANVAS_DESIGN_PLAN.md, CANVAS_EDITOR_SPEC.md, CANVAS_TECHNICAL_CONTRACT.md, CANVAS_IMPLEMENTATION_BACKLOG.md, CANVAS_V11_REVIEW.md; đọc tài liệu MySQL v0.9/v1.0/payment v1.1 và source/package/lockfile. PRODUCT_SCOPE/README/ARCHITECTURE còn đoạn stale: dùng source để xác định capability hiện tại, tách riêng điều kiện cấu hình và bằng chứng đã chạy.
3. Dùng Graphify và kiểm freshness. Graph root trước đồng bộ đã cũ; graph AST local/canvas-replan-20261117/ast/graphify-out phản ánh baseline mới nhưng SQL/tài liệu cần đọc trực tiếp. Không coi graph là bằng chứng DB/provider đã chạy.
4. Giữ ES modules HTML/CSS và modular monolith async. Repo có MySQL 8.4 adapters, payment/webhook/receipt foundation; JSON vẫn mặc định. Không đổi React/PostgreSQL hoặc cài editor engine lớn nếu chưa có spike và lý do.

B. PHÂN CHIA CÔNG VIỆC
5. Theo W00–W11, xác định file/ownership/dependency trước khi sửa. Song song các phần độc lập, không cùng sửa router/composition/migration. Sau từng gói test → sửa → test lại; sau ba gói regression tích lũy. Không dừng ở UI kéo thả chưa lưu/xuất bản được. Nếu cần quyết định sản phẩm, chỉ hỏi phần phụ thuộc và tiếp tục phần độc lập.
6. W01 spike DOM/CSS stage: zoom 50/100/200%, pointer mapping, drag/resize/crop, IME tiếng Việt, keyboard/touch và CSP thật. Không unsafe-inline/unsafe-eval. Canvas API chỉ dùng cho element cần vẽ. Chốt cách ship shared schema browser/server qua build/release hiện có.
7. Schema tách schemaVersion, draft revision, templateVersionId, elementVersion và runtimeVersion. Source dùng {kind:'blank'} hoặc {kind:'template',templateId,templateVersionId}. Owner/source/provenance/policy do server xác lập; save/duplicate không xóa nguồn để vượt license hoặc vùng khóa. IDs ổn định, duplicate remap target, validate unknown fields/types/actions, số hữu hạn và resource budgets. Ba cảnh là preset legacy, không trần sáng tạo theo gói.
8. Registry quy định schema/defaults/renderer/inspector/accessibility/actions/capability. Bộ đầu: nền, text, binding tên/người gửi/lời chúc, ảnh/khung/crop, shape/line, sticker được duyệt, nút chuyển cảnh/replay, phong bì/hộp quà, reply block và layout starter. Không nhận HTML/JS/CSS/remote URL tùy ý.

C. EDITOR VÀ RUNTIME
9. Tách store/commands/history/session, stage/inspector/layer/scene và renderer/runtime. Một gesture là một history command; không ngắt IME hoặc render toàn main mỗi pointermove. Preview dùng cùng renderer với public nhưng side effects được giả lập. Public player không tải editor.
10. Tích hợp /create/:templateId, /design/new, /design/:id, /studio, /template/:id, /g/:slug, /success/:slug. Bảo toàn /payment-result/:orderId và biên nhận/in. Studio đợt đầu có nháp/thiết kế riêng để nhân bản, quà đã gửi và biên nhận; thư viện mẫu cá nhân có version thuộc pha mở rộng. Sender tự thiết kế không cần Creator.
11. Có mount/dispose, abort/generation guard chống response cũ, cleanup listener/observer/timer/audio/object URL. Bảo vệ nháp khi navigate, Back/Forward/popstate, refresh và checkout redirect; không hứa unload luôn save kịp. Recovery tách theo user/design, không lộ sang tài khoản khác.
12. Phân biệt clean/dirty/saving/offline/conflict/session-expired/asset-pending/publishing. Chỉ ACK đúng revision mới báo Đã lưu. Mobile dùng bottom sheet/numeric controls, keyboard thay drag, không chặn scroll toàn trang. Thay aria-live toàn main bằng status nhỏ; kiểm focus và reduced motion.

D. DỮ LIỆU VÀ ASSET
13. Designs theo Service/Repository/DI, async cho JSON và MySQL. Save CAS expectedRevision, mutation ID và hash/reconciliation xử lý lost ACK; không last-write-wins. Create idempotency theo owner/create key riêng vì chưa có design ID. Owner-only draft/assets; 409 giữ local để giải quyết.
14. Theo schema MySQL hiện có: CHAR(36) ascii_bin cho UUID, VARCHAR(128) ascii_bin cho template ID, JSON payload. gifts.template_id còn NOT NULL/FK; blank publish cần migration mới với discriminator hợp lệ, không template giả. Không sửa 001–005 đã áp dụng; chọn số migration theo HEAD thực tế. Chỉ thử ở DB cô lập, không coi nhiều DDL có thể rollback như DML.
15. Hai profile canvas: JSON đồng nhất một process có recovery; MySQL coherent Identity/Catalog/Designs/Gifts/assets và Checkout MySQL khi dùng paid. Chặn tổ hợp publish chưa hỗ trợ; không dual-write hai backend rồi gọi atomic. Giữ nguyên .env/storage của người dùng.
16. MySQL publication dùng UnitOfWork cùng connection được inject. Kiểm/chốt revision, policy/entitlement, immutable version, gift, asset pins và idempotency result trong boundary rõ. Không gọi repository ở hai pool rồi coi cùng transaction. Revoke-vs-publish có semantics/test. Không giữ SQL lock khi upload/decode ảnh hoặc gọi provider.
17. Media dùng asset ID, staging→validate/re-encode→ready. Giữ PNG/JPEG/WebP và EXIF validation hiện có; không base64 dài trong document. Draft owner-only; public media gắn gift+TTL. Pin snapshot; GC kiểm refs/race, không xóa file quà đang dùng. DB/filesystem không cùng transaction; có recovery và backup cả hai.
18. DTO public/list dùng allowlist; không spread payload có policy/storage key/draft metadata qua publicGift/mine/catalog. Cột authoritative và document summary nhất quán. Quà legacy không snapshot vẫn dùng renderer cũ, giữ ID/slug/TTL/reply.

E. QUYỀN VÀ THANH TOÁN v1.1
19. Dùng Checkout.hasLicense qua service: MySQL kiểm entitlement chưa revoke JOIN order; không suy quyền từ paid order list. Preflight persisted draft trả allowed/needs_template_license/denied/unavailable, blockers theo node. Lỗi request không biến thành chưa mua hoặc không có provider.
20. Đợt đầu giữ giá quyền mẫu v1.1; chưa phí theo cảnh/element/phát hành. Blank với element được cấp không tạo order hoặc template giả. Tách quyền thiết kế, element, chia sẻ/bán và vận hành link; không tự thêm subscription, đa role, quota/giá mới.
21. Save ACK trước checkout. Context do server quản lý theo owner/order/design/revision/source; một intent user/template có thể dùng cho nhiều draft nên không ghi đè một designId trên order. Dùng API context canonical trong technical contract. Không PII trong URL provider, không arbitrary returnUrl. Giá hiển thị từ server/intent.
22. Giữ provider/webhook/settlement/receipt hiện có. Return/cancel URL không chứng minh paid/cancelled. Sau return đọc status và kiểm lại quyền/draft; quay đúng nháp, để người dùng chủ động publish. Nếu draft đổi ở tab khác, preview/preflight lại revision mới. Paid rồi publish lỗi thì retry publish, không thu lại tiền mẫu.
23. Pending, methods-error, methods-empty và receipt-error là state riêng. Order cũ không context vẫn đọc/in được. Không giả backend đã hỗ trợ cancelled/expired/reconciliation. MoMo live guard gap trong review là hardening riêng; task canvas không bật merchant, QA dùng provider inject và chặn mạng ngoài.

F. PUBLISH, KIỂM THỬ VÀ ROLLOUT
24. Publish nhận expectedRevision, expectedDocumentHash và idempotencyKey riêng với payment. Hash do server tính canonical rồi đối chiếu; không tin client hash như quyền. Cùng key/request trả cùng gift; khác hash trả 409. Timeout dùng replay/check result, không sinh key mới ngay. Snapshot bất biến, không public draft hoặc asset chưa ready.
25. Thực hiện C01–C28 đúng tầng. MySQL locking/CAS/FK/rollback cần MySQL 8.4 cô lập và hai connection. Unit mysql-* là mock/static; provider inject không thay merchant E2E. Gate chưa chạy ghi NOT RUN/BLOCKED; không skip/xfail/nới assertion để ép PASS.
26. Giữ dữ liệu và .env. JSON suite kế thừa process.env nên ép IDENTITY_STORAGE/CATALOG_STORAGE/CHECKOUT_STORAGE/GIFTS_STORAGE/SUPPORT_STORAGE=json, PAYMENT_ENABLED=false và PAYMENT_LIVE_ENABLED=false trong process test riêng. Không restart app đang dùng. Khi cần, cài dependency đúng lockfile trong QA cô lập để tránh thay node_modules workspace.
27. Chạy build/check/unit/API/browser phù hợp. Baseline đã đạt 88/88 unit và Edge browser+JSON API/smoke; chưa có MySQL thật/provider E2E. Không dùng baseline này để tuyên bố canvas mới PASS. Kiểm viewport 320–1440, IME, text dài, CSP, focus/motion, save/payment/publish failures và cleanup. Hiệu năng ghi rõ fixture/thiết bị.
28. Export/import/backup phải giữ designs/snapshots/assets/refs; importer cũ fail rõ nếu chưa hỗ trợ. Cờ read/edit/publish tách riêng: tắt writer không tắt reader của quà đã gửi. Không quay binary không hiểu snapshot hoặc đổi storage flag rồi coi rollback dữ liệu.
29. Giữ reply privacy hiện có; chênh lệch đặc tả dài hạn là hạng mục riêng. Giữ payment receipts và lịch sử đơn. Cập nhật docs/API/architecture/PROJECT_STRUCTURE/release allowlist theo phần đã chạy; không viết backlog thành đã hoàn thành.
30. Bàn giao chức năng/file/cách dùng, test logs/gate matrix, giới hạn, Git diff/status. Chưa commit/push/deploy/migrate dữ liệu thật khi chưa được giao. Hoàn tất phần được phép, báo bằng chứng đúng phạm vi.
```
