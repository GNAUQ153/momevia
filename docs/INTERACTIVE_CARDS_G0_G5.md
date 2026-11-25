# Thiệp tương tác Momevia · bàn giao local 22/11/2026

Đã triển khai trên nhánh `feat/interactive-cards-g0-g5`, xuất phát từ `70f2be0` của `feat/guess-your-choice`. Checkout sạch, có một worktree tại `P:/entrepreneuer/project/momevia` khi bắt đầu. Không có thay đổi của người khác bị ghi đè. Không tìm thấy `KE_HOACH.md` trong checkout/thư mục làm việc được cung cấp; toàn bộ yêu cầu trong prompt là căn cứ triển khai.

Đây là bản bàn giao **local**, chưa phải xác nhận đủ điều kiện phát hành. Các số đo LCP bên dưới là lịch sử của đợt G0–G5; xem đợt tối ưu tiếp với ngưỡng chốt 2,6 giây để có kết quả mới. Thử nghiệm với năm người vẫn có trạng thái riêng bên dưới. Không push, deploy, thanh toán, gửi thông báo hoặc cập nhật DB production.

## Mở bản chạy

- [Catalog local](http://localhost:4119/explore).
- Bảng ảnh trước/sau, VI/EN và video.
- Danh mục ID/giá/quyền/hash/phiên bản/cảnh/ảnh trước và sau.
- Vai trò nội dung, nguồn/quyền artwork.

| Mẫu | Trang local | Cảnh | Phân phối |
|---|---|---:|---|
| Hai phong bì | [/template/hai-phong-bi](http://localhost:4119/template/hai-phong-bi) | 6 | Giữ ID/giá/quyền cũ; phiên bản khởi tạo mới |
| Birthday Radiance | [/template/birthday-radiance](http://localhost:4119/template/birthday-radiance) | 5 | Giữ ID/giá/quyền cũ; phiên bản khởi tạo mới |
| Proud of You | [/template/proud-of-you](http://localhost:4119/template/proud-of-you) | 5 | Giữ ID/giá/quyền cũ; phiên bản khởi tạo mới |
| Lời mời bên hiên | [/template/loi-moi-ben-hien](http://localhost:4119/template/loi-moi-ben-hien) | 5 | ID mới, Momevia Originals, giá fixture 0đ |
| Cuộn phim ngày ấy | [/template/cuon-phim-ngay-ay](http://localhost:4119/template/cuon-phim-ngay-ay) | 4 | ID mới, Momevia Originals, giá fixture 0đ |
| Bản đồ ngày ra trường | [/template/ban-do-ngay-ra-truong](http://localhost:4119/template/ban-do-ngay-ra-truong) | 5 | ID mới, Momevia Originals, giá fixture 0đ |

Chưa có quyết định giá sản xuất riêng cho ba ID mới trong yêu cầu này. **0đ là giá fixture local; chủ sản phẩm cần quyết định giá/quyền trước đợt triển khai thật.** Giá và quyền của 25 ID trước đó được giữ nguyên.

`Dùng mẫu` và `Chỉnh bố cục` vẫn mở cùng một nháp, cùng nguồn và cùng cơ chế lưu. Thử đổi bản phối trước tạo nháp hiện có trên [Sunny Wishes](http://localhost:4119/template/sunny-wishes) và [Confetti](http://localhost:4119/template/confetti). Bản nháp thuộc hai mẫu này có nút **Tạo bản mới theo mẫu này**. Bản mới có **Về bản nháp gốc**.

Nếu cần khởi động lại từ repo:

```powershell
Set-Location P:/entrepreneuer/project/momevia
npm run build
node scripts/dev/interactive-cards-local.mjs final
```

Cổng 4119 phải trống trước khi khởi động. Launcher sao chép code vào fixture, giữ các tệp dữ liệu đã có, tạo tài khoản QA mới và lưu thông tin đăng nhập riêng trong `local/interactive-cards-20261122/final/session.json`. File này **không nằm trong gói bằng chứng hay Git**. Có thể tự đăng ký tài khoản local để thử. Bản gốc 70f2be0 dùng cổng 4118; không chạy lại launcher `baseline` từ source mới để thay mốc cũ.

## G0 · Mốc và nguồn dữ liệu

| Nguồn | G0 | Sau thay đổi | Lưu ý |
|---|---:|---:|---|
| Catalog seed | 25 mẫu | 28 mẫu | Chỉ thêm ba ID mới ở cuối seed |
| JSON fixture, danh sách thực trả cho người dùng | 25 | 28 | Kiểm tra cả giao diện VI/EN; ưu tiên ba ID cũ không đổi |
| Catalog chưa lọc, DOM trang đầu / tổng trang | 9 / 3 | 9 / 4 | Phân trang 9 mục; tổng kết quả 25 → 28, không phải 28 card cùng có trong DOM |
| MySQL mô phỏng thư viện/Catalog hiện hữu | 25 hàng / 25 công khai | 28 hàng / 28 công khai | Khôi phục hiển thị cũ: 28 hàng còn lưu, 25 công khai |
| Thư viện Canvas | 387 mục | 415 mục | 28 mục mới, ba định nghĩa template cũ đổi revision |
| Element type / interaction kind | 10 / 11 | 10 / 11 | Không tạo loại renderer hoặc player thứ hai |
| Effect lõi / animation recipe thêm | 33 / 0 | 33 / 8 | Sáu họ giữ nguyên; tổng thư viện có 41 effect và 41 animation |
| Cụm element | 172 | 181 | Sáu cụm kể chuyện và ba cụm bóng/giấy/ảnh nổi |

Sau ba ID ưu tiên, JSON giữ thứ tự seed còn MySQL giữ `created_at,id`; vị trí các mẫu không ưu tiên có thể khác giữa hai adapter. Không ép thứ tự DB theo seed. Thứ tự thực và danh sách featured trước/sau có trong rollout report.

Chi tiết số đếm theo loại: 10 `element_type`, 111 `artwork` vector, 181 `element`, 41 `animation`, 41 `effect`, 3 `preset`, 28 `template` = 415. Bảy WebP v2 và tám WebP phong cách chụp thật v3 là immutable builtin media; tua mũ là vector ghim trong document.

DB thử dùng MySQL **8.4.13**, container riêng, cổng chỉ bind loopback và tên schema `momevia_canvas_qa_*`. Container được dọn sau suite; log, tên schema, history/count và fixture filesystem còn ở `local/interactive-cards-20261122/mysql/`. Bộ MySQL API khởi tạo đủ 12 mẫu lõi rồi app chèn các mẫu bổ sung. Riêng bộ storage chỉ cần các mẫu bổ sung để thử thư viện; không lấy số Catalog của fixture hẹp đó làm số Catalog của sản phẩm. Diễn tập riêng đối chiếu đủ 25 → 28 hàng và danh sách công khai.

Không khảo sát hay ghi DB ứng dụng đang dùng. Môi trường bàn giao là **JSON một process**, dữ liệu và media dưới `local/interactive-cards-20261122/final/services/`; source, `.env` và dữ liệu production không được sao chép vào fixture. Dữ liệu cũ trong kiểm thử là fixture V1 và V2 đã ghim, không phải quà thật của người dùng.

Phiên bản sử dụng: Node 24.14.0, Chrome 157.0.8103.51, Playwright 1.65.1, Fabric 7.4.0, mysql2 3.24.6, Sharp 0.35.5; document/registry V1 và V2 hiện hữu. Graph có sẵn đã cũ; kết luận dựa vào code sở hữu tại checkout, không dựa vào graph để khẳng định hành vi.

Lỗi G0 ghi nhận: unit test về cờ demo/production nhận `TEST_ACCOUNT_ENABLED` từ môi trường máy và thất bại trước thay đổi. Profile QA đặt rõ cờ này `false`; không bỏ test hoặc làm yếu bảo vệ production. Các lượt cuối chạy toàn bộ unit với profile đó.

## G1 · Cấu hình và cụm element

Inspector hiện hữu tiếp tục chia bề mặt, xuất hiện, nhấn mạnh, phản hồi của element và bề mặt/chuyển cảnh/không khí của scene. Nút xem thử dùng đúng `sceneId`/`elementId`/family; tắt, hoàn tác, lưu và mở lại sử dụng store/CAS hiện hữu. Canvas document là nguồn dữ liệu; Fabric chỉ chỉnh bố cục. Catalog preview, Studio preview và public cùng `gift-runtime`.

| Cấu hình | Đối tượng / trigger | Tham số mặc định trong bản giao | Fallback |
|---|---|---|---|
| S03 | Giấy của scene / khi dựng | Bề mặt tĩnh | Nền giấy và chữ vẫn hiện |
| T01 | Cảnh đến / điều hướng | Bản mẫu mới `normal`, 320 ms; cấu hình stage thử `fast`, 180 ms | Đến thẳng cảnh |
| E02 | Stage thử ảnh và ảnh chi tiết / ảnh sẵn sàng | `normal`, delay 150 ms | Ảnh ở bố cục cuối; lỗi ảnh không che chữ/nút |
| E04 | Đường của ba mốc / vào cảnh | `normal`, delay 0 | Đường tĩnh, tiêu đề không chờ animation |
| R01 | Hai element **envelope** / kích hoạt | `normal`, 320 ms | Mở thẳng nhánh khi giảm chuyển động |
| R04 | `light-a-candle` / kích hoạt lần đầu | `normal`, 320 ms | Trạng thái thắp nến cập nhật ngay, đọc tiếp độc lập |
| `hanging-sway-v2` | Riêng vector tua mũ / vào cảnh | 2.800 ms × 3, +1,4° → −0,8° → 0°, pivot tại nút mũ | Tua ở vị trí cuối; ảnh mũ/chữ đứng yên |
| `photo-settle-v1` | **image** / xuất hiện | 380 ms, ease-out, 1 lượt; −3° và nâng 6 px → 1° → 0° | Ảnh ở vị trí cuối, không giấu nội dung |
| `porch-sun-v1` | Scene bìa hiên / vào cảnh | 2.400 ms, count 8, drift −40 px, hai màu ấm; sparse, loop false | Tắt hạt khi giảm chuyển động |

Bổ sung theo yêu cầu ảnh thực tế: `photo-arrive-v3` hạ ảnh 600 ms (transform cộng vào bố cục), `keepsake-sway-v1` chao ảnh nhẹ 3.200 ms × 3; ảnh bánh/mũ giữ ổn định để lửa/tua luôn bám đúng vị trí. `paper-shadow-v2` là bóng theo alpha của vật thể (mặc định 20%, blur 14, lệch xuống 8 px); `contact-shadow-v1` blur 6 cho shape bóng tiếp xúc; `cotton-paper-v2` thêm grain giấy tĩnh. Inspector dùng preset bề mặt hiện có. Định nghĩa Admin cho chỉnh màu, độ trong suốt, blur, X/Y và box/alpha trong giới hạn schema, không nhận CSS tự do. Bìa SVG dùng cùng khai báo bóng/grain với player.

Phong bì ảnh và nhãn là một vùng control thật, hai vùng bằng nhau; ảnh trang trí không nhận pointer/focus. Mở nếp thư có lớp giấy/bóng và chuyển động 380 ms. Album chờ ảnh giải mã rồi chuyển 240 ms khi bấm, hủy lượt trước khi bấm nhanh. Lửa alpha hiện đúng bấc sau R04, có ánh sáng/chao lửa; tắt motion giữ ảnh ở trạng thái cuối, tắt hạt và chuyển động lửa. Pause/resume không khởi động lại lượt; rời scene/đóng preview hủy animation/timer. Stage Studio hủy listener của lượt dựng trước khi thay lớp.

Trong engine hiện hữu, density sparse nhân count của recipe hạt với 0,5: định nghĩa 8 tạo **4 hạt thực** ở preset sparse. Số thực đo được ghi trong edge report. Tốc độ instance dùng slow/normal/fast; delay entrance chỉ 0/150/300 ms. Dense vẫn chỉ ở cấu hình celebration B05–B08. B02 sparse/loop false là lựa chọn một lượt cho cánh hoa có ý nghĩa nội dung, không bật tràn lan trên các cảnh. Không dùng T03 cho các cảnh không lật trang.

So sánh recipe: E02 lõi là fade/nhô 18 px, 320 ms; `photo-settle-v1` là nghiêng/nâng 6 px, 380 ms, không cắt ảnh thành mảnh. B02 sparse là tám cánh, khoảng 3.000 ms; `porch-sun-v1` sparse là bốn hạt ấm, 2.400 ms. Có bằng chứng Studio chọn/xem thử/tắt/undo/lưu/mở lại recipe ảnh, public chạy đúng definition ghim và hạt kết thúc. Không nhận URL/CSS/JS/HTML tùy ý; schema kiểm engine, target, transform, duration/count/drift.

Chín cụm trong nhóm **Kể chuyện và kỷ niệm**:

| ID | Cấu tạo |
|---|---|
| `photo-caption` | Giấy, image tùy chọn và text chú thích |
| `time-place-card` | Text giờ/ngày và text địa điểm |
| `program-row` | Text giờ, hoạt động, địa chỉ; line độc lập |
| `equal-envelopes` | Hai envelope ngang quyền, cùng vùng bấm; người tạo chọn cảnh đích |
| `folded-letter` | Interaction thư gấp ba nếp, tiêu đề/nội dung sửa riêng |
| `journey-board` | Line E04 và ba cặp text tiêu đề/lời nhắn |
| `shadow-contact` | Shape bóng mềm có màu/độ trong suốt chỉnh được, blur khai báo |
| `layered-paper` | Các lớp giấy có bóng đổ riêng; sửa/xóa/di chuyển từng lớp |
| `raised-photo` | Giấy, ảnh, chú thích và bóng nâng ảnh; chữ là text thật |

Các lớp có thể chọn, sửa, di chuyển, xóa theo policy hiện hữu. Lớp trang trí aria-hidden và không bắt pointer/focus. Thứ tự đọc theo document, z-order theo `scene.elementIds`.

## G2–G3 · Nội dung và artwork

**Hai phong bì:** một ảnh giấy kem ngang có góc ảnh vuông và một ảnh đứng có hoa ép/dải lụa, khác silhouette cả khi bỏ màu. Ảnh, tên, nhãn và các envelope control riêng. Hai vùng bấm bằng nhau; R01 thuộc envelope, không gắn lên image. Cả A→B và B→A có đường trở lại bìa. Album ba ô và hai đồng hồ tùy chọn vẫn còn.

**Birthday Radiance:** artwork bánh/bấc chưa sáng và lớp flame của interaction riêng. Tên ở trước artwork; **Thắp ngọn nến** và **Đọc tiếp · Bỏ qua nến** nằm liền nhau. Nhấn liên tiếp tạo một R04, không gửi reply/nhảy cảnh. Lời chúc vẫn là text binding; bỏ nến hoặc giảm chuyển động vẫn đọc đủ.

**Proud of You:** mũ/bằng không có tua in sẵn; tua là vector màu/vị trí sửa riêng, đường cong gắn đúng nút mũ và chỉ tua nhận `hanging-sway-v2`. Thư gấp có ba nếp Khởi đầu/Vượt dốc/Ngày hôm nay; lời nhắn cá nhân vẫn có binding. Đã kiểm bằng bàn phím, giảm chuyển động và điều hướng chuẩn tới hồi đáp.

**Lời mời bên hiên:** bìa → giờ/nơi gặp → đúng hai hàng chương trình → album tùy chọn → lời nhắn/hồi đáp. Hai hàng có giờ, hoạt động, địa chỉ độc lập. Fixture địa chỉ A/B dài được chụp ở 320 px và phóng to 200%. Draft không có tên đối tác, ngày hoặc địa chỉ thật cài sẵn.

**Cuộn phim ngày ấy:** hộp phim → album đúng ba ô → lời gửi hôm nay → hồi đáp. Lời kể là text trên cảnh, không nằm trong ảnh/chú thích, vẫn đọc được với 0 ảnh hoặc ảnh lỗi. Có nút Trước/Sau ngoài thao tác vuốt. 0/1/3 ảnh và chú thích 4.000 ký tự đã thử. Chú thích nhanh cho phép giới hạn text của schema. Thay ảnh trong album tùy chọn reset focal point **đúng ô** về giữa, giữ ô khác/chú thích; primitive ảnh, album cũ không optional và vùng khóa Creator giữ quy ước crop trước đó.

**Bản đồ ngày ra trường:** bìa → Khởi đầu → Vượt dốc → Ngày hôm nay → kết thư/hồi đáp. Line, chấm, nhãn và lời kể tách lớp. Mỗi mốc tới được bằng button hoặc thanh điều hướng; không có câu đố hoặc thao tác men theo đường.

Bảng màu lần lượt là giấy ngà/xanh lá/đất nung, giấy ấm/nâu phim/hồng phấn và giấy xanh/mực xanh/vàng. App shell vẫn tím/hồng.

Bản mặc định mới dùng tám artwork phong cách chụp thật tạo riêng bằng imagegen tích hợp: hai phong bì, bánh chưa sáng, mũ không tua, hiên nhà, hộp phim, bản đồ giấy và lửa nến alpha. Đây là ảnh sinh nguyên bản, không phải ảnh chụp địa điểm/người thật. WebP từ 7.652 đến 103.672 byte; kích thước, crop contain, focal point, anchor, phiên bản và SHA-256 trong manifest v3. Toàn bộ prompt, nguồn và quyền; file sử dụng thực nằm trong `web/assets/event-cards/realistic-v3/`. Tua mũ là vector ghim, đường/chấm trên bản đồ là element sửa được. Bảy SVG/WebP v2 và toàn bộ v1 vẫn giữ để đọc snapshot. Không chép chữ, ảnh, code hoặc artwork của Chung Đôi. Cảm hứng sử dụng là nhịp mở thư, kể chuyện ảnh và thử trước khi tạo.

Các ảnh album minh họa cũ chỉ ở preview, không vào draft. Nguồn cũ: Artwork 21/11 và ảnh album preview. Giữ nguyên các tệp media cũ để đọc snapshot. `materializeBuiltinMedia` nay remap cả `image.props.assetId` và `interaction.props.photos[]`; có unit regression kiểm hai loại ref cùng đổi sang asset thuộc owner.

## G4 · Catalog và đổi mẫu

Catalog giữ hai đường cá nhân hóa; thêm lọc dịp và bảng màu có nhãn chữ, cùng metadata server cho tìm kiếm/card/detail. Giữ URL kết quả, đường quay về, trạng thái rỗng, Escape và focus. Chrome thật đã kiểm VI→EN trên kết quả Wedding gồm Hai phong bì và Lời mời bên hiên, rồi reset về đủ 28 mẫu.

| Chiều | Trạng thái | Ánh xạ / lý do |
|---|---|---|
| Sunny Wishes → Confetti | Mở | Cùng cấu trúc thiệp sinh nhật giấy; ba binding và các vai trò text/nhãn trùng ID |
| Confetti → Sunny Wishes | Mở | Đã kiểm cả API JSON, API MySQL và giao diện |
| Proud of You → Bản đồ ngày ra trường | Khóa | Có thể đối chiếu ba nếp ↔ ba mốc, nhưng đích không có album ba ảnh và hai đồng hồ của nguồn; chưa có mapping/version đủ nghiệm thu |
| Bản đồ ngày ra trường → Proud of You | Khóa | Ba cảnh mốc ↔ entries thư gấp cần mapping vai trò riêng và quyết định xử lý nhịp/nội dung; chưa mở chiều chưa có ca đạt |
| Creator hoặc mẫu khác | Khóa | Không suy ra tương thích từ tên hiển thị, tọa độ hoặc số cảnh |

Role keys hiện có: `binding:*`, `text:<elementId>`, `label:<elementId>`, `photo:<elementId>`, `album:<elementId>:<photoId>`, `entry:<elementId>:<index>`, `clock:<elementId>`. Vai trò được ghim trong provenance phía server theo templateVersion; Duplicate cập nhật ánh xạ role → element ID mới, không dùng tên/vị trí/thứ tự để đoán. Có regression cho nháp đã Duplicate rồi đổi mẫu. Bảng JSON kèm theo liệt kê đầy đủ sáu mẫu. Tên VI/EN, thứ tự cảnh và tọa độ không được dùng làm khóa mapping.

Đối chiếu chi tiết Proud ↔ Bản đồ: ba binding chung có vai trò tương ứng. Proud có ba ô ảnh/chú thích/focal point và hai đồng hồ tùy chọn; Bản đồ không có các slot này. Theo chiều ngược, album và đồng hồ của Proud có thể để trống/tắt nhưng chưa có mapping phát hành. Ba entry của thư gấp Proud và ba cặp tiêu đề/lời nhắn ở cảnh mốc Bản đồ có cấu trúc khác nhau; cần bảng ánh xạ theo version và ca mang nội dung từng nếp trước khi mở. Chữ tự thêm ngoài vai trò, phần bị xóa hoặc ảnh riêng không được suy đoán từ tọa độ. Hai chiều này chưa hiển thị trong UI và không được tạo qua API.

Thử trước tạo nháp giữ ba trường trong sessionStorage của phiên; đổi qua lại chưa tạo nháp. Xác nhận dùng source/version đích do server trả. Với nháp, preview trả carried/missing và plan hash theo phiên bản nguồn/đích. Thiếu nội dung riêng, kể cả ảnh, phải giữ bản gốc hoặc xác nhận thiếu; thao tác luôn tạo draft mới.

Server kiểm owner, quyền source/target, license nếu giá thay đổi, policy, từng asset, source expectedRevision/hash, target version và plan hash. MySQL khóa nguồn và kiểm giá/trạng thái Catalog, revision thư viện trong giao dịch tạo. Idempotency key hồi phục cùng kết quả sau mất phản hồi; phiên bản nguồn đổi trả xung đột để xem lại. Provenance, templateVersion và policy của đích được lập phía server; không chuyển quyền mua. Bản gốc và quà đã gửi không bị sửa. Mapping carried/omitted theo hai version được ghi trong provenance của draft mới.

## G5 · Gói thư viện và rollback

Gói: `database/updates/interactive-cards-20261122-v1.json`. Tạo lại bằng `node scripts/build/interactive-library-update.mjs`. Có tám animation + tám effect + chín element + ba template mới, và ba template cũ từ revision 1 → 2. Status/sortOrder/định nghĩa gốc nằm trong gói; thứ tự ưu tiên Catalog cũ giữ nguyên.

Dependency: media immutable/vector ghim → animation → effect → element → template. Kiểm schema, SHA media, không nhận ảnh preview-only làm decoration giao quà, và kiểm toàn đồ thị trước áp dụng. `CanvasLibraryService.put` tiếp tục dùng expectedRevision, khóa dependency và history. Preview không ghi DB. Rerun nhận diện đúng mục đã áp dụng; mục Admin tùy biến hoặc đổi revision hiện conflict riêng, không bị ghi đè.

```powershell
# Chỉ sau khi cấu hình schema QA loopback riêng, không dùng .env production:
node database/scripts/interactive-library-rollout.mjs
node database/scripts/interactive-library-rollout.mjs --apply
node database/scripts/interactive-library-rollout.mjs --rollback --apply
```

CLI từ chối nếu không có `CANVAS_QA_MYSQL_ISOLATED=true`, host `127.0.0.1`, DB `momevia_canvas_qa_*`. Không tự áp dụng vào DB khi app khởi động. Cài mới vẫn seed toàn bộ thư viện; Catalog chỉ chèn ID thiếu. Khi gói chưa bật ba template mới trong DB, chúng không hiện công khai.

Diễn tập MySQL thật: 387 → 415 mục; ngắt sau 5 mục, chạy lại thành công; rerun tạo thêm 0 mục. Admin sửa Proud of You tạo đúng một conflict. Sau đối chiếu revision, rollback phục hồi đủ 387 định nghĩa gốc, tắt 28 mục mới, ghi 36 hàng history. Catalog còn 28 hàng để không mất dữ liệu nhưng chỉ 25 hiển thị. Rollback là revision mới, không xóa history hay sửa quà/nháp. Bằng chứng.

Cần phân phối cùng client/server của nhánh này trước khi bật gói: `photo-caption-v3` cho envelope, `cake-photo-v2` cho candle và `paper-fold-v2` cho thư gấp là enum tùy chọn đã validate/serialize/render có chủ đích. Các enum và media cũ giữ nguyên; skin nến ghim body/flame/anchor, không trỏ lại file của snapshot cũ. Reader mới đọc snapshot cũ; không yêu cầu reader cũ hiểu enum mới. Các recipe chỉ dùng engine khai báo đang có.

## Bằng chứng kiểm thử

| Entry point / bộ thử | Kết quả và điều kiện |
|---|---|
| `npm run check` | PASS cú pháp/scope, VI/EN và kiểm tra UI |
| `npm test` | PASS **563/563**, `TEST_ACCOUNT_ENABLED=false` rõ ràng |
| `npm run build` | PASS, 28 bìa VI/EN; font và WebP nhúng thật |
| `npm run test:templates` | PASS 28 mẫu tạo/lưu/tải lại, publish free, chặn paid chưa có license, Catalog cũ thêm thiếu, cached-v1/CAS/mất ACK |
| `npm run test:canvas:browser` | PASS Chrome; 181 element thực, 33 effect lõi, Creator khóa, ảnh/crop/IME, touch/keyboard, public/reply và reader khi tắt writer |
| `test:canvas:mysql`, `test:canvas:storage`, `test:canvas:mysql:api` | PASS đúng các entry Node tương ứng qua runner cấp schema QA riêng; MySQL 8.4.13; API có 20 ca và 0 external request |
| Bộ sáu mẫu | PASS 96 tổ hợp: 6 × VI/EN × 320/390/768/1440 × full/reduced; tất cả scene; không lỗi trang; Escape trả focus; ảnh giải mã |
| Hành trình | PASS cả sáu: Catalog/detail → tạo nhanh → lưu → F5 → bố cục → preview → publish fixture → public → reply → mở lại; snapshot đối chiếu allowlist |
| Edge | PASS hai recipe, candle nhiều lần, hai thứ tự phong bì, tua riêng, ba nếp bàn phím, trial/restyle qua UI, album 0/1/3, thay đúng focal point, ảnh lỗi, cleanup |
| Snapshot/DB | PASS V1, V2 cũ, Creator V1/V2 khóa, mẫu ngoài sáu, ảnh riêng, CAS hai tab, retry không tạo trùng và rollback |
| 320 + phóng to | PASS sáu mẫu và mọi scene ở 320; thêm stress CSS zoom 200%, hai địa chỉ dài, vùng chạm chính ≥44 px |

File log cuối ở `local/interactive-cards-20261122/`: `realistic-check.log`, `realistic-unit.log`, `realistic-build.log`, `realistic-templates.log`, `realistic-canvas-browser.log`, `realistic-mysql.log`, `realistic-matrix.log`, `realistic-edge.log`, `realistic-api.log`, `realistic-capture.log`, `realistic-perf.log`. Tên ca cũ trong một số log còn nhắc 172; assert/đếm thực của thư viện hiện tại là 181. Thư mục con `mysql/` giữ log từng entry, cover pixel coverage và deep Admin audit.

Các lần lỗi trong quá trình triển khai được sửa và chạy lại: SVG candle che artwork, import nhãn artwork, vùng báo cáo tràn ngang ở zoom cao, căn tua, vị trí skip, reset focal point bị áp quá rộng, và khung nghiêng cắt chú thích 4.000 ký tự. Khung có chú thích nay giữ text thẳng, chỉ ảnh nghiêng; có ca bounds tại 320 px và CSS zoom 200%. Không hạ ngưỡng pixel để qua test. Ca crop của primitive/album cũ giữ nguyên assertion; reset mới chỉ áp dụng album tùy chọn được giao. Unit gzip kiểm dữ liệu giải nén đúng, HEAD, Vary và `gzip;q=0`.

Bộ browser đầy đủ từng gặp 429 sau workload API hàng trăm lượt rồi dùng cùng owner cho workload UI. Fixture nay khởi động lại riêng process giữa hai workload, giữ JSON và danh tính; không tăng hoặc tắt giới hạn production. Lượt chạy lại hoàn chỉnh đạt. Audit màu mặc định kiểm 244 cặp chữ/nút ở VI/EN, gồm lớp chữ trên ribbon chữ nhật và trường hợp grain giấy đen tối đa 11%, đều ≥4,5:1. Đây không phải chứng nhận cho mọi nội dung/ảnh/màu do người gửi sửa hoặc toàn bộ UI hệ thống. Xem `contrast-report.json`.

## Số đo lab và giới hạn

| Route | G0 LCP / CLS (median) | G5 LCP / CLS (median) | Tổng tải G5 | Ảnh tải G5 |
|---|---|---|---:|---:|
| `/explore` | 11.872 s / 0.5128 | 6.448 s / 0.0002 | 932 KiB | 348 KiB |
| `hai-phong-bi` | 10.448 s / 0.3957 | 5.644 s / 0.0002 | 666 KiB | 125 KiB |
| `birthday-radiance` | 8.968 s / 0.3957 | 5.328 s / 0.0002 | 605 KiB | 64 KiB |
| `proud-of-you` | 8.912 s / 0.3957 | 5.480 s / 0.0002 | 635 KiB | 94 KiB |
| `loi-moi-ben-hien` | Mẫu mới | 5.712 s / 0.0002 | 678 KiB | 129 KiB |
| `cuon-phim-ngay-ay` | Mẫu mới | 5.732 s / 0.0002 | 688 KiB | 139 KiB |
| `ban-do-ngay-ra-truong` | Mẫu mới | 5.696 s / 0.0002 | 662 KiB | 92 KiB |

Mỗi hàng có **5 lượt**. Catalog giảm LCP từ 11.872 s xuống 6.448 s, tải từ khoảng 2096 xuống 932 KiB. **LCP chưa đạt ≤2,5 s** ở tất cả route trong cấu hình lab này; CLS đạt ≤0,1. Nút thắp nến, cùng cấu hình mobile/CPU/mạng, có 5 lần tap tới hai khung RAF tiếp theo: 24.7, 25.8, 26.7, 20.4, 26.9 ms (proxy phản hồi nhìn thấy ≤200 ms trong phép đo này, không phải phép đo input latency thiết bị thật). Trạng thái nến cập nhật ngay khi kích hoạt. Sau đóng preview: 0 animation của player.

WebP decoration v3 mặc định 7.652–103.672 byte; sáu bìa SVG VI lần lượt 150.888 / 67.873 / 110.498 / 155.502 / 169.790 / 106.565 byte theo thứ tự bảng mẫu. Bìa lớn nhất trong cả VI/EN là 169.790 byte, dưới ngân sách 200 KB, có tính font/ảnh nhúng. Không coi giới hạn này là cam kết cho ảnh riêng bất kỳ của người gửi.

35 mẫu tải lạnh G5 và 20 mẫu G0 có từng lượt, tổng tài nguyên và ảnh thực tải. Dữ liệu tải cùng các import trong entry ứng dụng cho thấy cần tối ưu tiếp chuỗi nhiều module khởi tạo chung và tải Catalog. Chưa đo tách riêng đóng góp của từng module; cần profiling/tách tải hoặc đóng gói tiếp để đạt LCP 2,5 s. Kết quả này chưa đủ để mở rollout thật.

Cấu hình G0/G5: cùng profile Chrome QA riêng, viewport 390×844, DPR 1, mobile/touch giả lập, CPU slowdown 4×, latency 100 ms, download 200.000 B/s, upload 93.750 B/s; cache trình duyệt tắt, năm lượt mỗi route. Không xóa DNS/TLS cache. Bộ đo G5 dùng ảnh phong cách chụp thật v3 và cấu hình motion/bóng cuối. Tổng tải lấy encoded bytes của CDP Network, gồm HTML, font ngoài origin và response tải dở; không cộng lại data URI. ResourceTiming được giữ riêng trong dữ liệu gốc. Lab dùng JSON local một process, không phải số đo khách thật hay máy MySQL production. Bìa SVG được tính cả font/ảnh nhúng và tài nguyên thực tải, không chỉ kích thước WebP.

Đã giảm tải bằng artwork WebP nhỏ, nén gzip tệp tĩnh, chỉ tải chức năng thử đổi mẫu khi cần và giữ chỗ viewport trong lúc route nạp để footer không nhảy. Gzip không áp dụng lên API/media riêng tư. Animation chính hữu hạn 1–3 lượt; lửa CSS lặp chỉ trong cảnh nến đã thắp, dừng khi motion off/tab ẩn và bị gỡ cùng scene. Ảnh của scene khác chỉ dựng khi vào scene. Timer/WAAPI được đo trong edge suite sau mỗi lần đóng preview; số cuối là 0/0. Chữ thật, CTA, fallback ảnh và đọc tiếp vẫn còn khi tắt chuyển động; không có audio autoplay.

Frame pacing có một mẫu lab ba giây cho ảnh Birthday E01, ảnh Cuộn phim (hạ/chao) và bìa hiên (hạ/chao/bụi nắng): lần lượt 59.9 / 59.1 / 59.1 FPS, p95 16.8 / 16.8 / 16.8 ms; mỗi mẫu có một khung >50 ms. Đỉnh 2 / 2 / 6 animation, đỉnh hạt 0 / 0 / 4; sau đóng đều 0 animation. Đây là RAF trong Chrome headless/CPU 4×, không phải FPS thiết bị thật. Dữ liệu frame pacing.
