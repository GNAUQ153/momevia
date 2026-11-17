# Canvas Sender: thực thi W00–W11 và bằng chứng QA

Ngày: 17/11/2026, Asia/Saigon. Baseline `6c44bdb`, nhánh `feat/canvas-design-plan`, package v1.1.0. Working tree chưa commit. Không pull/merge/rebase/reset/push/deploy hoặc migrate DB thật. WIP `.gitignore`, `docs/README.md` và sáu tài liệu kế hoạch được giữ; stash/`before-sync` không apply lại.

## Phạm vi thực thi

| Gói | Ownership/file chính | Kết quả |
| --- | --- | --- |
| W00 | Baseline/Git/Graphify/docs/package-lock | Graph AST baseline có 140 manifest entry khớp hash, commit đúng; SQL/docs đọc trực tiếp, không dùng graph chứng minh DB/provider |
| W01 | DOM/CSS spike + editor store/stage | Zoom 50/100/200, drag/resize/crop/Undo, keyboard/touch automation, IME composition synthetic, CSP thật; không thêm engine/dependency |
| W02 | `web/js/shared/canvas` | Schema/registry/presets/canonical hash/duplicate, strict unknown/type/action/finite/budget, provenance/policy server-owned |
| W03 | `web/js/features/gift-runtime` | Preview/public dùng chung player, legacy preset adapter, preview mô phỏng side effects, public không import editor |
| W04 | `src/modules/designs` JSON/MySQL/service/routes | Owner-only create/get/list/save/archive/duplicate, CAS, request hash/mutation replay/restart; list metadata có pagination |
| W05 | `assets.service`, private/public media routes | Binary image pipeline giữ validator EXIF/pixel/type; ready refs/private ACL/public pin+TTL, GC destructive tắt |
| W06 | `canvas-editor`, `designer.js`, `editor.css` | Store/history/session/stage/inspector/layers/scenes, numeric/keyboard/IME, save states, recovery, mobile sheets |
| W07 | `main.js`, Studio, index status | `/create`, `/design/new`, `/design/:id`, Studio; mount/dispose/abort/generation/navigation guards; giữ catalog/favorites/receipts |
| W08 | preflight + checkout context routes/result UI | Server license, save ACK trước checkout, many contexts/order, errors tách riêng, không tự publish/không tin redirect |
| W09 | JSON aggregate + MySQL UoW + migration006 | Revision/hash/key chốt publication, snapshot bất biến, template/blank đúng FK, same connection/pins/result; rollback/revoke races thật |
| W10 | public player/success/QR/legacy fallback | Anonymous read/reply, snapshot không đổi theo draft/archive; QR và TTL giữ contract |
| W11 | tests/backup/legacy import guards/docs/release | JSON/MySQL/browser/provider inject và backup/restore có evidence riêng; merchant/native IME/physical mobile chưa nghiệm thu |

Chia việc theo file độc lập; root giữ router/composition và integration, một agent sở hữu migration/SQL. Sau các gói có focused test → sửa → retest; regression tích lũy chạy trên bản copy cô lập, không dùng node_modules hoặc data của app đang dùng. Có quan sát formatting ngoài ownership trong working tree; giữ nguyên, không tự revert.

## Gate matrix

| Gate | Trạng thái và phạm vi | Bằng chứng |
| --- | --- | --- |
| Unit/domain/repository/static | PASS 137/137, 0 fail/skip/todo | `local/canvas-implementation-20261117/unit-final.log` |
| Build/check | PASS | `build-final.log`, `check-final.log` cùng thư mục |
| JSON HTTP | PASS, temp data/ports, storage forced JSON, payment/live false | `canvas-browser-final.log`, `tests/integration/canvas.mjs` |
| Browser JSON | PASS Edge headless, blank/save/F5/photo/preview/publish/QR/anonymous reply; six viewports; conflict/offline/Back | `browser/canvas-browser.json`, screenshots |
| Browser resilience | PASS, real auth/drafts/save; gateway response mocks chỉ để kiểm UX | `canvas-resilience.json`, `tests/browser/canvas-resilience.mjs` |
| Legacy architecture/API/browser/smoke | PASS, existing auth/role/TTL/photo/reply/purchase concurrency | `architecture-browser-final.log` |
| MySQL repository integration | PASS 13 nhóm trên MySQL 8.4.13 thật, hai connection/pool | `mysql-integration.log`, `tests/integration/canvas-mysql.mjs` |
| MySQL HTTP + Browser | PASS 13 nhóm, lượt final schema mới `momevia_canvas_qa_final_c15b736e`, full app temp copy/SQL synthetic | `mysql-api-browser-final.log`, `tests/integration/canvas-mysql-api.mjs` |
| Provider inject | PASS pending/signature/replay/settlement/right/receipt/context; external fetch = 0 | MySQL HTTP log; fake local provider HMAC, không merchant |
| DB+media restore | PASS table/hash/bytes của schema synthetic mới | `mysql-backup-r2/manifest.json` |
| JSON backup/restore/import guard | PASS full aggregate/media/ref/hash; corrupt/missing/no-overwrite/link cases | `canvas-backup-tests.log`, `canvas-backup.test.mjs` |
| Release package/verifier | PASS 233 files/checksums/exclusions ở QA copy, không deploy | `package-final.log`, `verify-package-final.log` |
| Merchant E2E/live webhook mạng thật | NOT RUN; không bật live/khóa merchant | Không dùng inject để nâng gate này thành PASS |
| IME hệ điều hành thật/thiết bị mobile vật lý/screen reader thật | NOT RUN; có synthetic composition, touch/keyboard/focus automation | W01 spike không chứng nhận thao tác OS/hardware |

Các log nằm dưới `local/` và không được đóng gói release. Báo cáo mô tả đúng fixture; không coi baseline 88 test là bằng chứng canvas.

## C01–C28 theo tầng

| Case | Bằng chứng đạt / phần chưa chạy |
| --- | --- |
| C01 | JSON/MySQL API và browser: blank Unicode/photo/IDs/layout → save → F5 |
| C02 | Cả 12 preset legacy được adapt; template free UI publish, không đổi Catalog; legacy gift renderer còn chạy |
| C03 | W01 Edge CSP + pure coordinates/history: zoom .5/1/2, resize/crop/center, one gesture Undo/Redo |
| C04 | Synthetic composition tiếng Việt/Undo/Escape PASS; native OS IME NOT RUN |
| C05 | CAS hai connection MySQL thật một winner; JSON browser giữ local conflict cho đến lựa chọn rõ |
| C06 | Save/create lost ACK replay/hash + restart; client pending mutation giữ nguyên body/key |
| C07 | Browser offline/save retry/navigate/Back/F5 recovery, explicit confirm; không hứa unload save |
| C08 | Owner B draft/asset GET/save 404, source/policy injection reject; duplicate giữ provenance/license/lock |
| C09 | Binary validation/re-encode/replay/IDOR; replacement chỉ commit ready, missing ready bytes replay repair |
| C10 | Unit remap duplicate/target validation; editor xóa scene bị tham chiếu có lỗi/cancel, không target ngẫu nhiên |
| C11 | Preview reply simulated, zero reply POST; public adapter gửi thật; reset/dispose có kiểm |
| C12 | Browser methods503 khác methods[]; không fallback demo từ lỗi/mảng rỗng |
| C13 | MySQL actual paid order nhưng no/revoked entitlement bị chặn preflight/publish |
| C14 | Actual SQL/API many contexts/order, exact replay sau revision đổi; browser đúng context/draft hoặc explicit choices |
| C15 | Inject signed event: pending→paid/right/receipt, lặp không thêm; result không tự publish. Merchant NOT RUN |
| C16 | Paid publish failure→same key retry, không thêm order/charge |
| C17 | MySQL concurrent same key một gift, key reuse khác hash 409; JSON concurrent API cũng replay |
| C18 | Before/after commit fault injection + JSON reopen/restart, MySQL precommit rollback, post-ACK replay. Không mô phỏng mất điện phần cứng |
| C19 | Draft save/archive sau publish giữ snapshot/pins/public bytes |
| C20 | MySQL second connection tombstone-vs-publish pin protocol; destructive GC scheduler chưa phát hành |
| C21 | Anonymous Edge, keyboard/reduced motion/mobile widths/reply; không tải editor JS |
| C22 | Legacy architecture/smoke reply/photo/QR/concurrency; actual SQL API TTL410 ở public/reply/assets |
| C23 | Unknown/malicious schema/style/action/URL/deep/nonfinite reject; text không HTML, CSP không nới |
| C24 | Slow ACK A→B, delayed checkout sau modal close/route switch; dispose/abort/generation + owner recovery isolation |
| C25 | Actual clean/legacy SQL001–006, UUID/collation/FK/Unicode/blank constraint; DB+media restore hash parity |
| C26 | Legacy CLI/pure preparers fail rõ khi gặp canvas aggregate/snapshot; backup v1 giữ nguyên refs |
| C27 | Writer-off config giữ reader/media, restart link vẫn mở; không rollback binary/storage dữ liệu |
| C28 | Actual SQL browser receipt paid cũ không context vẫn in/Studio; receipt error không biến paid thành unpaid |

## Hiệu năng và khả năng truy cập

Fixture spike: Windows 10.0.26200, Intel i5-13400, Node24.14, Edge157 headless. Có 1 scene/1 text rồi image placeholder; thêm fixture 3 scenes/11 mixed nodes và 300 nodes. Thời gian event→rAF/headless warm cache ghi trong `spike-result.json`; không là FPS máy mobile thật hoặc SLA production.

Full JSON fixture final đo editor blank ready 177 ms, public readable 218 ms (1 scene/3 nodes/PNG80×60, app warm); đây là một lượt đo quan sát, không SLA. Lấy `browser/canvas-browser.json` làm evidence fixture. Không gộp spike injected API với backend/SQL latency.

`main` không còn live region toàn trang; status nhỏ cho save/player/reply, focus controls/preview/sheet và reduced motion có automation. DOM reading order độc lập z-order; public player và editor dùng cùng registry. Kiểm thủ công với screen reader, native IME và mobile thực còn NOT RUN.

## Các lỗi đã phát hiện và sửa trong vòng kiểm thử

- Server schema import path sai trong copy QA: sửa đường dẫn, unit/regression chạy lại.
- Missing-ready-file upload replay: không báo ready cho bytes vắng, sửa từ cùng input/hash.
- Checkout lost context ACK: replay mutation trước khi so latest revision, không gắn nhầm draft.
- Gift summary trim lệch snapshot: giữ text thống nhất với persisted binding/hash.
- Checkout response cũ: capture context/generation qua từng await, hủy tác động khi modal/route đã đổi.
- Reply list duplicate và lỗi list chặn mở quà: player tự tải list và hiển thị lỗi độc lập.
- Full-app editor tràn 320px: giảm shell marketing, kiểm lại sáu viewport; không che bằng overflow global.
- Client publish/checkout guard và recovery: chỉ báo clean đúng ACK; native save/back không discard local ngầm.
- Paid/pending result copy và receipt error tách khỏi entitlement/publish; order context dùng nhãn bản đã lưu.
- Renderer reflow giữ các phần tử cố ý chồng nhau (như text trên ảnh), chỉ overflow của nhóm mới đẩy nhóm phía dưới; 12 geometry fixture preview/public ở 320/390/1440 đã PASS, cùng 6 viewport/longtext trước đó.
- Check-source phát hiện browser-evaluate globals trong test mới: sửa thành `globalThis.*`, không nới ESLint/assertion; check chạy lại PASS.
- Create/duplicate replay được đọc trước khi resolve lại nguồn: lost ACK vẫn lấy kết quả đã commit khi Catalog lỗi hoặc source draft đã archive. Revision request được giới hạn cùng unsigned INT MySQL, không tràn cột.

Graph AST working tree được dựng riêng tại `local/canvas-implementation-20261117/ast/graphify-out`: 171 file JavaScript, 1.018 nodes/2.933 edges, 18 communities, 0 file đổi trong lúc extract, 0 LLM tokens. 32 file re-export/data/entrypoint không có symbols theo extractor; không gọi đó là đủ SQL/docs coverage. Graph baseline root không bị thay thế. Source hiện hành vẫn là căn cứ cho những phần graph không mô tả.

## Giới hạn vận hành và bàn giao

Không đổi `.env`/storage thật, không restart app người dùng. MySQL migrations chỉ trên container/schema QA mới có tên/label riêng. Node dependencies dùng cài đặt QA từ lockfile khớp; không `npm ci` vào workspace. Các kế hoạch v1.1 được giữ làm baseline; hướng dẫn hiện hành là [CANVAS_SENDER_GUIDE](CANVAS_SENDER_GUIDE.md).

Container riêng `momevia-canvas-qa-20261117` đã dừng sau gate cuối, sau khi xác minh tên/label QA; không dừng container/app của người dùng. Backup synthetic và evidence giữ trong `local/`. Package QA đã verify 233 files; `source-verification.json` đối chiếu mọi file package với working tree, không có drift. Git status/diff được lưu trong `git-status-final.txt` và `git-diff-final.patch` (patch chỉ các file tracked; file mới còn untracked, được liệt kê trong status/manifest).

JSON chỉ một process, aggregate tăng theo lịch sử; chưa tự expire mutation/draft/user data. Destructive GC, production multi-instance/shared media, merchant reconciliation/live E2E, MoMo guard hardening và W12–W15 còn ngoài phạm vi. Không dùng đổi flag như data rollback.

Một cleanup thư mục fixture synthetic mồ côi đã bị automatic approval review từ chối (`blocked by policy`); không thử xóa bằng đường khác. Path: `C:\Users\Loc-TraSas\AppData\Local\Temp\momevia-resilience-uev4OR`. Các fixture chạy thành công sau đó tự cleanup bình thường. Không có dữ liệu người dùng trong thư mục này.
