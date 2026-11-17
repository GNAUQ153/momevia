# Canvas Sender: sử dụng và vận hành

Ngày bàn giao: 17/11/2026. Phạm vi W00–W11 trên baseline Momevia v1.1; W12–W15 chưa triển khai. [Bằng chứng và giới hạn QA](CANVAS_QA_REPORT.md).

## Tạo và gửi quà

1. Đăng nhập bằng tài khoản Sender bình thường. Trong Studio chọn **Tự thiết kế**, rồi **Trang trống** hoặc bố cục phong bì. Từ thư viện, **Cá nhân hóa** mở `/create/:templateId` và tạo một draft có nguồn mẫu được server xác lập.
2. Nhập tên người nhận, tên người gửi, lời chúc. Thêm chữ, ảnh, shape/line, sticker đã duyệt, nút chuyển cảnh/replay, phong bì/hộp quà hoặc khối lời đáp. Ảnh PNG/JPEG/WebP tối đa 2 MiB; hệ thống kiểm nội dung/pixel/EXIF và encode lại.
3. Chọn phần tử trên stage hoặc trong Layers; chỉnh bằng kéo/resize, phím mũi tên hoặc input tọa độ/kích thước. Crop có focal point/fit, có Undo/Redo. Zoom không đổi dữ liệu thiết kế; một gesture là một bước history. Mobile mở bảng nội dung/thuộc tính phía dưới, không bắt buộc kéo thả.
4. Chờ **Đã lưu · rN** hoặc bấm **Lưu nháp**. Chỉ ACK của nội dung đã gửi mới xác nhận đã lưu. Studio có danh sách draft, tiếp tục/nhân bản và tải thêm; quà đã gửi, favorite và receipt vẫn giữ.
5. **Xem trước** dùng cùng player public; lời đáp chỉ mô phỏng và có nhãn rõ. Đóng preview không thay scene/selection/history của editor.
6. **Xuất bản** lưu trước rồi kiểm persisted revision, schema, bindings, ảnh và quyền mẫu. Thiếu license chỉ mở checkout khi methods từ server khả dụng; lỗi methods khác mảng methods rỗng. Blank dùng bộ element cơ bản không tạo order hoặc mẫu giả.
7. Nếu đi thanh toán, nháp và asset phải có ACK. Context do server quản lý, một order có thể có nhiều draft. Result page đọc trạng thái server, receipt và đúng context hoặc danh sách để chọn; trở về editor tải bản mới nhất. Thanh toán không tự publish, URL return/cancel không chứng minh paid/cancelled.
8. Sau publish dùng link hoặc QR ở `/success/:slug`. Recipient vào `/g/:slug` miễn phí, không đăng nhập, không tải editor. Snapshot/ảnh đã pin không đổi theo những lần sửa/archive draft; muốn gửi nội dung khác cần publish mới.

Người có link có thể đọc lời hồi đáp theo contract legacy hiện hành. Không đưa reply vào bản sao thiết kế. Công cụ Creator version/review, community, audio/video/timeline và custom code không thuộc đợt này.

## Lỗi lưu và phục hồi

| Trạng thái | Cách xử lý |
| --- | --- |
| Dirty/Saving | Ở lại cho đến ACK trước checkout; có thể tiếp tục chỉnh, các save được gửi tuần tự |
| Offline/Error | Bản local được giữ theo user/design; chọn Thử lưu lại; không coi local recovery là server save |
| Conflict 409 | Không ghi đè âm thầm. Có thể xem metadata server, hoặc chủ động xác nhận bỏ local để tải server; draft local giữ tới khi lựa chọn |
| Session expired | Đăng nhập lại đúng tài khoản trước khi lưu; tài khoản khác không đọc được draft/recovery của chủ trước |
| Asset pending/failed | Chờ hoặc thay ảnh; ảnh trước giữ đến khi replacement ready; không publish placeholder/ảnh chưa ready |
| Publish timeout | Thử lại ý định cũ với cùng idempotency key/request; server replay kết quả, không tạo payment lại |

Navigate, Back/Forward và logout có guard trước khi bỏ draft. Refresh/đóng tab dùng cảnh báo browser và recovery hỗ trợ; không bảo đảm async autosave trong unload. Client abort/generation guard ngăn response cũ ghi lên editor mới.

## Cấu hình và compatibility

Không thay `.env` hay dữ liệu chỉ bằng cách bật các flag sau. Ví dụ nằm trong `.env.example`.

| Cờ | Mặc định | Điều kiện |
| --- | --- | --- |
| `DESIGNS_STORAGE` | `json` | `json` hoặc `mysql`; không tự copy dữ liệu giữa hai kho |
| `CANVAS_READ_ENABLED` | `true` | Reader và media của gift đã phát hành; giữ bật khi tạm dừng writer |
| `CANVAS_EDIT_ENABLED` | `true` | Create/save/duplicate/upload; tắt không tắt reader |
| `CANVAS_PUBLISH_ENABLED` | `true` | Publish mới; không bỏ qua schema/license |

JSON pilot dùng một process, Identity/Catalog/Designs/Gifts cùng JSON; Checkout cùng JSON khi dùng quyền mẫu trả phí. MySQL yêu cầu Identity/Catalog/Designs/Gifts/assets coherent, Checkout MySQL khi dùng quyền trả phí. Support độc lập. Profile publication không hỗ trợ trả 503, không fallback/dual-write.

MySQL cần driver đúng lockfile và migration **006_canvas** sau 001–005. Chỉ migration DB QA cô lập đã chạy trong đợt này. Chưa áp dụng migration vào `.env`/DB thật. DDL có implicit commit: không chạy lại script dở dang; kiểm bảng/constraint/migration ledger và forward repair theo kế hoạch có backup riêng. Không sửa 001–005.

Ba cảnh là preset legacy, không là giới hạn thương mại. Budget kỹ thuật schema v1: 256 KiB/document, 32 scenes, 400 elements, 64 asset declarations, tối đa 2 action/node, depth 16. Đây là giới hạn kiểm soát tài nguyên, không tạo giá/gói mới. History giữ 60 command trong phiên, không giữ vô hạn bản document trong bộ nhớ.

Template legacy được fingerprint thành `templateVersionId` UUID ổn định từ nội dung preset thực; provenance đánh dấu `legacy-v1`, không gọi đó là một Creator version đã duyệt. Save không nhận owner/source/provenance/policy. Duplicate remap node/scene/action target và giữ nguồn/license/policy.

## Storage, assets và recovery

JSON canvas nằm ở `services/designs/data/canvas.json`, assets ở thư mục `assets` cùng cấp. Aggregate authoritative chứa drafts, create/save ACK, immutable versions, publications/idempotency/pins, contexts và canvas replies. Gift legacy vẫn ở dữ liệu legacy; không viết gift canvas vào hai file rồi coi là atomic. Một process serialize thao tác theo đường dẫn; fsync temp rồi rename commit. Temp chưa commit không được đọc sau restart.

MySQL UnitOfWork dùng một transaction connection cho design/revision/policy, quyền template qua Checkout service, version, gift, pin và result. Entitlement và order được khóa khi kiểm quyền: revoke lấy khóa trước thì publish bị từ chối; publish commit trước thì gift đã phát hành giữ snapshot/TTL. Preflight không cấp quyền vĩnh viễn.

Ảnh staging → validate/re-encode → file sẵn sàng → metadata ready. Mã upload idempotent gắn owner/design/mutation, nội dung khác cùng mã bị 409; replay có bytes hợp lệ có thể sửa file ready bị thiếu. DB/filesystem không có transaction chung. Lỗi metadata có thể để orphan file; giữ để phục hồi, không unlink asset có thể đã được tham chiếu. Public media chỉ theo gift pin còn TTL; asset ID đơn lẻ không cấp quyền.

Destructive GC chưa bật. Archive draft không xóa file/snapshot. Giao thức SQL pin-vs-tombstone đã có kiểm thử lock, không đồng nghĩa có scheduler GC production. Không xóa orphan bằng tay trước khi đối chiếu backup/ref.

## Backup/export/import

JSON tool giữ nguyên IDs/refs, document/hash, publication result và media (bao gồm orphan/staging được quản lý). Chỉ chạy khi source đã dừng ghi/offline, chọn thư mục đích mới; parent phải tồn tại:

```powershell
node scripts/dev/canvas-backup.mjs export --source <designs-data-dir> --target <new-backup-dir> --offline
node scripts/dev/canvas-backup.mjs verify --source <backup-dir>
node scripts/dev/canvas-backup.mjs restore --source <backup-dir> --target <new-data-dir>
```

Restore không merge/overwrite target. Tool kiểm SHA-256/counts/references và phát hiện source thay đổi khi copy. Partial export không có manifest hoàn tất. Đây không phải converter JSON↔MySQL. Phải sao lưu phối hợp Identity/Catalog/orders/gifts legacy/replies/media cũ và `.env` riêng, giữ external IDs; tool canvas không sao chép secrets/session của các module đó.

MySQL QA có `database/scripts/canvas-backup.mjs`: chỉ nhận container/schema QA loopback có label xác minh, dump+media và restore-test sang schema mới; không phải lệnh backup production mặc định. Đợt này đã so sánh toàn bộ table data/hash và media của fixture sau restore. Quy trình production cần backup phối hợp DB metadata + bytes và restore-test riêng.

Importer legacy từ chối aggregate/publication canvas thay vì strip snapshot/ref hoặc tạo template giả. Aggregate canvas trống vẫn tương thích importer cũ.

## Rollout, package và rollback

Thứ tự: reader hiểu legacy/v1 → kiểm storage/migration readiness → editor QA → publish fixture → kiểm link qua restart/writer-off → mới xét rollout thực tế. Không deploy hoặc cutover dữ liệu trong task này.

Tạm dừng tạo/chỉnh/xuất bản bằng edit/publish flag, giữ read bật. Không rollback binary không hiểu snapshot khi còn link canvas, không đổi storage flag rồi coi là rollback dữ liệu. Không xóa bảng hoặc media để làm dữ liệu trông giống bản cũ.

Build hiện hành ship QR và cùng nguồn ES module schema từ `web/`; server import trực tiếp, không có hai validator dễ lệch. Release allowlist đã bao gồm `src/web/scripts/tests/docs/database/migrations`; verifier vẫn loại `.env`, data, dump, `local/`, node_modules. Kiểm bằng build/check/unit/integration/package, không deploy.

Payment/live giữ nguyên cấu hình người dùng. MoMo live guard gap CV11-04 là hardening riêng trước merchant, không được giải thích là đã sửa bởi canvas. Không có subscription, giá mới, đa role hoặc Creator nâng cao trong release này.
