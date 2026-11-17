# Bộ mẫu canvas cơ bản dùng chung

Cập nhật 17/11/2026 trên working tree Momevia. Đây là built-in compositions cho 12 template hiện hữu, không phải Creator marketplace/versioning W13–W15. ID, giá, ownership và license của Catalog được giữ; không ghi lại draft/gift hoặc dữ liệu ứng dụng đang chạy.

## Các thiết kế

| Template | Hướng thiết kế | Thành phần nổi bật |
| --- | --- | --- |
| Midnight Bloom | Khu vườn đêm, mận tím và hồng phấn | Hoa nhiều cánh bằng shape editable, chữ serif, phong bì |
| Sunny Wishes | Poster sinh nhật đầy nắng | Mặt trời cắt khung, nét nắng, màu vàng sáng |
| The Love Letter | Lá thư thương, giấy ngà | Giấy lệch nhẹ, con dấu trái tim, dòng thư |
| Starlight Night | Điều ước dưới sao | Trăng khuyết và chòm sao từ shape/line, nền xanh đêm |
| Peachy Day | Chút ngọt ngào | Cánh hoa lớn, khoảng thở, sắc đào dịu |
| Little Greenhouse | Khu vườn xanh | Cành lá chỉnh sửa được, khung vòm, nền xanh giấy |
| Make a Wish | Bữa tiệc nhỏ | Mẩu giấy màu tĩnh, bóng bay và hộp quà; chưa có particle animation |
| On Cloud Nine | Khoảng trời nhẹ lòng | Mây nhiều lớp, đường bay, chữ xanh rõ ràng |
| Lavender Field | Một mùa nhớ | Cành lavender và nhịp chữ serif, nền tím giấy |
| Captured Moments | Polaroid kỷ niệm | Khung giấy/góc xoay/cảnh minh họa; chọn **Khung ảnh kỷ niệm → Thêm ảnh vào khung** để chèn ảnh thật, giữ bố cục/crop |
| Afterglow | Ánh chiều ấm áp | Đĩa mặt trời, đường chân trời và sắc hồng đất |
| Tiny Celebration | Niềm vui bé xinh | Dấu quà nhỏ, nền mint, typography gọn |

Mỗi mẫu có ba cảnh khởi đầu: Mở quà → Lời chúc → Hồi đáp. Có binding tên người nhận/người gửi/lời chúc, action chuyển cảnh và replay. 19–37 node/mẫu (có thể thêm ảnh), không phải ảnh flatten; layer nội dung có tên tiếng Việt. Sender vẫn có thể thêm/xóa/sắp xếp element hoặc thêm cảnh trong budget kỹ thuật.

Ảnh là tùy chọn. Mẫu polaroid mặc định có cảnh minh họa từ shape, không chặn publish vì thiếu ảnh. File không hợp lệ không thay minh họa/ảnh cũ; ảnh đã ready mới gắn asset ID vào document. Template có giá vẫn cần license khi publish, kể cả khi chèn ảnh riêng.

## Xem và sử dụng trên localhost

1. Tải lại mạnh bằng **Ctrl+F5** tại `http://localhost:4100/explore` để nhận JS/CSS/thumbnail mới; không cần đổi `.env`.
2. Mở một template. **Trải nghiệm mẫu trước khi dùng** chạy player bằng dữ liệu minh họa, gồm chuyển cảnh và reply mô phỏng.
3. **Cá nhân hóa mẫu này** tạo draft của tài khoản đăng nhập. Nội dung preset mới được lưu bằng owner-only CAS trước khi editor sẵn sàng nếu server vẫn đang giữ preset generic cũ.
4. Sửa tên/lời chúc/ảnh, lưu, preview và publish theo quyền hiện hành. Không tự publish hay tạo đơn hàng khi xem mẫu.

Initializer chỉ áp dụng cho draft mới r1 còn binding rỗng, chưa asset và không có vùng khóa; không áp vào draft đang có qua GET/reload. Lost ACK dùng lại mutation/body, rồi đọc revision mới nhất. Source/templateVersionId/policy server không bị đổi thành dữ liệu client.

Sau khi backend được khởi động lại theo quy trình của người dùng, server tự tạo trực tiếp composition mới; initializer không gửi save thừa khi document đã khớp. Fingerprint source mới có cả preset document. Task này không restart app hoặc sửa trực tiếp storage của localhost.

## Source và skill

- `web/js/shared/canvas/basic-templates.js`: 12 art direction, builder typed document, demo bindings và photo-frame insertion.
- `presets.js`/`index.js`: cùng một nguồn document browser/server; template không thuộc bộ built-in vẫn dùng legacy fallback.
- `scripts/build/template-previews.mjs`: thumbnail SVG từ document đã validate và escape; `npm run build` tạo 12 file dưới `web/assets/basic-templates/`.
- `ui/components.js`, `pages/catalog.js`, `features/catalog/template-preview.js`, `css/template-library.css`: thư viện và preview dialog, lifecycle/dispose/focus.
- `features/canvas-editor/template-start.js`, `pages/designer.js`: preset initialization cho draft mới và chọn ảnh vào khung.
- Skill mới: `C:/Users/Loc-TraSas/.codex/skills/momevia-template-design/SKILL.md`, gọi bằng `$momevia-template-design`. Đã dùng thêm skill `frontend-design` có sẵn; skill mới tập trung vào contract/authoring canvas, không thay skill UI chung.

## Bằng chứng đợt này

Evidence đặt tại `local/basic-templates-20261117/`, không nằm trong package dữ liệu ứng dụng:

| Gate | Phạm vi |
| --- | --- |
| Unit | **PASS 144/144**, 0 fail/skip/todo, gồm composition/contrast/budget/asset/initializer/preservation/lost ACK; `unit.log` |
| Build/check | **PASS**, source/ESLint, QR và 12 SVG theo lockfile hiện có; `build.log`, `check.log` |
| `npm run test:templates` | **PASS**, API JSON cô lập: 12 mẫu create/save/reload; 3 mẫu miễn phí publish/read/replay; paid license gate; polaroid upload ready/ACL; cached-v1 server + CAS/replay/latest revision; `templates-api.log` |
| Regression API | **PASS**, architecture + canvas JSON, temp ports/data, forced JSON và payment/live false; `architecture-api.log`, `canvas-api.log` |
| Visual source artifacts | **Đã xem**, `contact-sheet.png` và 12 PNG từ SVG cover; đây là thumbnail render, không là ảnh chụp DOM/browser |
| Localhost thực, chỉ GET | **PASS 18 tài nguyên HTTP 200**, đủ 12 SVG khớp source; HTML đã có stylesheet mới; `localhost-evidence.json` |
| Skill | **PASS**, `quick_validate.py` UTF-8; `skill-validation.log` |
| Browser trên app người dùng | **BLOCKED**: CUA báo `The browser access host is unavailable`; chưa có browser E2E mới cho bộ layout này |
| MySQL/provider live | **NOT RUN** trong đợt thiết kế; không dùng baseline cũ để tuyên bố layout mới đã nghiệm thu trên các profile này |

Ứng dụng thật được kiểm tra bằng HTTP GET public cho health/catalog và các asset mới. Không đăng nhập giả, không tạo draft/gift/order trong dữ liệu thật. Skill creator validator chạy UTF-8 trên Windows; skill không còn scaffold/TODO.

Đối chiếu với manifest của đợt canvas trước xác nhận `gift-runtime/renderer.js`, `gift-runtime.css` và Catalog seed không đổi. Một test cũ phụ thuộc `elements[1]` được sửa để tìm đúng envelope theo type rồi vẫn kiểm action target của bản duplicate; không bỏ assertion hoặc skip case khi thêm lớp trang trí.

Đã giữ nguyên renderer và CSS runtime v1 của quà đã gửi; layout mới nằm trong document mới. Nhánh đang behind upstream nhưng không tự pull/merge/rebase. Chưa commit/push/deploy hoặc migrate dữ liệu thật.
