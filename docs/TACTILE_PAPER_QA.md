# Thư gấp, Polaroid, vé cào và vé xé

Đợt 28/11/2026, tiếp sau `684fe20`, trên nhánh `fix/natural-canvas-objects-20261128`. Làm trong clone cô lập, giữ nguyên repo gốc có WIP. Video, tài khoản và dữ liệu QA nằm trong `local/tactile-paper-20261128/`, không đưa vào Git. Không merge/deploy, thay giá, quyền hoặc chính sách lưu trữ.

## Phạm vi và thành phần dùng lại

| Mẫu / cảnh | Thành phần | Thay đổi |
|---|---|---|
| Garden Tea / secret | `garden-secret`, scratch-ticket | Giấy có mép, foil có vệt kim loại; giữ engine cào theo diện tích và nút mở tương đương |
| Secret Santa / secret | `secret-scratch`, scratch-ticket | Cùng khả năng Canvas, giữ màu thông/đồng của mẫu |
| Midnight Soirée / secret | `secret-scratch`, scratch-ticket | Cùng khả năng Canvas, giữ màu đêm/champagne của mẫu |
| Graduation Countdown / diary, album | `diary-foldout`, `memory-album` | Nếp thư có bản lề; album xếp lớp và đổi thẻ ảnh |
| Graduation Mixtape / notes, album | `folded-note`, `memory-album` | Cùng thư/album; lời lưu bút vẫn dùng reply thật |
| The Last Chapter V2 / ticket | `scene-ticket-tear-ticket-0` | Phần vé và cuống tách mặt trước/sau; cuống lật rồi rời, mép xé răng cưa; SVG theo dữ liệu thiệp |

Không thêm loại tương tác vào mẫu vốn không có. Giữ máy ảnh, lịch, mũ, phong bì, bằng và hộp của các đợt trước. Dùng DOM/CSS/SVG native Momevia; không thêm engine, CDN hoặc tài nguyên bên ngoài.

## Khả năng Canvas và tương thích

Bốn card `foldout-letter`, `swipe-album`, `scratch-ticket`, `drive-tear-ticket` có thuộc tính `paperTreatment`: `classic-v1` hoặc `tactile-v2`, và `objectDepth` 0–16. Chỉ bốn kind và các appearance được hỗ trợ mới nhận reader mới. Thiếu enum hoặc chọn kiểu cũ vẫn chạy reader cũ. Schema kiểm enum/kind/range; ID, loại phần tử, ảnh và nội dung không đổi.

Đã mở Canvas trống trước khi tích hợp mẫu: tìm/chèn card, chọn kết cấu, sửa màu/độ sâu/nội dung hoặc ảnh, nhân bản, lưu/tải lại, preview và xuất bản thành phần độc lập. Ảnh album dùng asset do chủ thiệp tải lên. Bản sao giữ dữ liệu riêng. Kết quả và URL ở `canvas-gate.json` trong thư mục QA local.

Thư đọc từng nếp, có phản hồi chọn rõ ràng và flap mở từ cạnh trên; chữ đứng yên sau mở. Nội dung dài chia thành phần theo cụm ký tự, không cắt mất dấu hoặc emoji. Đổi nếp nhanh hủy chuyển động trước. Album giữ frame/chú thích/nút cố định; ảnh cũ rời và ảnh mới vào theo hướng. Chú thích dài có nút đọc toàn bộ; mở chú thích hoặc ảnh lớn dừng autoplay và chuyển động đang chạy. Escape đóng dialog và trả focus. Ảnh trống vẫn có placeholder, không có nút zoom vô dụng.

Vé cào dùng nguyên cơ chế coverage/stroke/resize hiện có; chỉ bổ sung lớp foil, viền giấy và phân trang chữ dài. Nút tương đương giữ vị trí khi mở. Vé xé giữ input tên, cử chỉ kéo/xé và bốn nút; xuất SVG dùng tên đang nhập, ngày giờ/múi giờ/địa điểm từ thiệp. SVG mới tự tăng chiều cao và xuống dòng, không rút ngắn các trường dài; reader/SVG cũ giữ nguyên.

Default mới chỉ được ghép sau blank-Canvas gate: tăng khung thư/album/vé trong factory và chuyển album về vị trí không đè tiêu đề/footer. Sound-button tùy chọn dưới thư được đẩy theo chiều cao mới. Cơ chế responsive một trang hiện có tiếp tục fit toàn cảnh theo thiết bị.

## Các điểm dùng chung và ảnh hưởng

- `shared/canvas/tactile-*`: opt-in, quy tắc và SVG bìa/xuất mới. `studio-objects` và `library-presets` chỉ áp dụng cho bốn kind khi tạo mới. Các tài liệu đã lưu không chạy factory lại.
- `gift-runtime/tactile-paper`, `interactions`, `drive-interactions`, `scratch-progress`: tái sử dụng motion controller, photo dialog, media ACL và cơ chế tương tác cũ; nhánh mới kiểm enum. `renderer` cập nhật nhãn khi đổi ngôn ngữ, giữ nếp/ảnh đang đọc. `index` hiện nút tắt chuyển động cho thành phần mới.
- `tactile-paper.css`: selector chỉ trong thành phần chủ động dùng kiểu mới. Giữ palette từng mẫu; texture ở mặt giấy/foil, vùng chữ thoáng. Độ sâu 0 tắt bóng/lớp bổ sung; reduced/off bỏ chuyển động. Abort/dispose gỡ clone, flap và listener đang chờ ảnh.
- Inspector, schema, registry, locale VI/EN: chỉ bổ sung lựa chọn hợp lệ; không đổi các kind khác.
- Các card tự tạo mới có thể chịu ảnh hưởng: chính bốn card nêu trên. Cozy Christmas, Club 22, Proud of You, Bản đồ ngày ra trường và snapshot quà cũ được kiểm hồi quy bởi bộ Canvas/thư viện và phép so sánh frozen QA.

## Thư viện có dữ liệu Admin

`buildDriveLibraryRollout(reviewed, desired, {scope:'paper'})` tạo bundle `tactile-paper-20261128-v1` đúng 10 hàng: bốn card và sáu mẫu. Phải truyền export baseline đã review; không lấy hàng hiện tại thay cho baseline được duyệt. Kiểm ID, fingerprint, revision, toàn bộ dependency và đọc lại trước mỗi CAS. Chạy lại không tăng revision hàng đã giống; xung đột dừng và trả danh sách đã áp dụng nếu xảy ra giữa các lần ghi. Không phải transaction nhiều hàng.

Không truyền scope vẫn là bundle Drive 19 hàng cũ. Không tự chạy rollout trên cơ sở dữ liệu phục vụ. Hoàn nguyên thư viện bằng chính bundle đã duyệt với `{rollback:true}`; hàng có trước khôi phục definition/status, hàng thêm mới chỉ disable. Nếu có Admin sửa đồng thời, dừng để review, không ghi đè.

## Kiểm thử và bằng chứng

Các lệnh bắt buộc: `npm run build`, `npm run check`, `npm test`, `npm run test:templates`, `npm run test:canvas:browser`. Phần browser mới ở `tests/browser/tactile-paper.mjs`; fixture mở/đóng details cũ trong `canvas-expanded` được giữ rõ ràng ở reader không có enum để kiểm cả hai phiên bản.

MySQL QA riêng: `node tests/integration/drive-six-mysql.mjs --paper --reviewed=<reviewed-export.json>`. Cơ sở dữ liệu ngẫu nhiên được hủy sau phép thử; kiểm thư viện mới/có Admin sửa, xung đột, chạy lại, rollback, save/send/nhận/chủ thiệp và snapshot.

Bằng chứng local gồm Canvas gate, ảnh đóng/mở của bốn thành phần ở 320×568, 390×844, 1440×900; video 390×844; toàn cảnh của sáu mẫu; matrix VI/EN, bàn phím, touch, reduced/off và rời khi đang chuyển động. Thử riêng chữ dài, ảnh trống, cào coverage thật, rapid/reverse, SVG có dấu, sự kiện quá hạn, hai người nhận trùng tên và gửi lại khi mất ACK. Log và JSON tách theo phép thử, trang QA tổng hợp chỉ công bố trạng thái đã quan sát.

Zoom thử bằng Chrome page-scale 2 và chữ 200%; chưa coi là kiểm native browser zoom. Chưa xác minh Safari, thiết bị vật lý, screen reader hoặc FPS trên máy thật. Không suy ra mọi màu tùy chọn của người gửi đều đạt tương phản.

Kết quả đợt này: build/check đạt; 1.320 unit tests, 28 template journeys và toàn bộ bộ Canvas browser đạt. QA riêng đi hết 54 cảnh của sáu mẫu, matrix VI/EN ở ba viewport, gửi/nhận/chủ thiệp và các ca biên đạt. Đo bổ sung tất cả cảnh dùng giấy mới ở ba viewport không có tràn widget/thanh cuộn trang, vùng chạm tối thiểu 24 px. Đã tăng chiều cao nút và chỉnh độ ưu tiên CSS riêng của thành phần mới sau khi phát hiện một nút dưới ngưỡng ở màn hình thấp. Kiểm lại renderer giấy và đo hình học sau chỉnh CSS đạt. So sánh nghiêm ngặt snapshot và bìa sáu quà QA trước giữ nguyên; MySQL scope 10 đạt cả rollback/xung đột/chạy lại.

## Hoàn nguyên mã nguồn

Chưa merge/deploy. Có thể revert commit của đợt này trong nhánh review. Nếu sau này đã có nháp/quà dùng `tactile-v2`, cần giữ schema/reader/CSS/SVG tương ứng, chỉ hoàn nguyên factory/rollout mặc định; không xóa dữ liệu hoặc đưa reader cũ vào snapshot mới. QA trước ở cổng 50637 vẫn giữ source và dữ liệu riêng.
