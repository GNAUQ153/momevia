# Sáu mẫu: phong bì, máy ảnh, bằng và mũ — 28/11/2026

Phần bổ sung chiều sâu giấy và nhịp mở có lựa chọn cho phong bì/bằng được ghi riêng tại [PAPER_RELIEF_QA.md](PAPER_RELIEF_QA.md). Những tài liệu không bật thuộc tính mới tiếp tục dùng vật liệu đã mô tả ở đợt này.

Đợt tiếp theo trên nhánh `fix/natural-canvas-objects-20261128`, từ `6281faa`. Bản làm việc cô lập `momevia-drive-six-20261127`; không nhập WIP ở repo gốc (`3856921`, 179 đường dẫn khi bắt đầu). Chỉ mã nguồn, vector, giấy phép và bìa sinh tự động được đưa lên Git. Video và dữ liệu/bằng chứng QA ở local. Chưa merge/deploy.

## Khoanh vùng sau rà ảnh toàn bộ 54 cảnh

| Mẫu / cảnh | Đã có / phần cần sửa | File hoặc hàm sửa và lý do | Hồi quy |
|---|---|---|---|
| Midnight Soirée, bìa | Phong bì v3 có giấy/sáp phù hợp nhưng trạng thái mở dựa vào mask ảnh không đủ tự nhiên | `source-envelope`, profile tùy chọn của `source-gift`, cover, schema/Inspector: preset `wax-letter-source-v4`, timeline hoàn chỉnh của một nguồn vector | Giữ reader v3, hộp Goodeisgn v6, Club 22; double tap, swipe/Enter, mở lại, off/reduced/abort |
| Mixtape, bìa | Thân máy/khe native đã đồng bộ, giữ lại; ảnh in nhỏ cần xem rõ | `drive-interactions`, `photo-dialog`: camera `object-studio-v5` có `zoom`, dùng ảnh và caption thật; Escape/focus/dispose | Camera crafted v4; album cũ dùng chung helper, giữ markup và hành vi đóng |
| Last Chapter, bằng | Mở xong chỉ còn khung chữ; thiếu giấy mở và nơ tháo | `studio-art`, `studio-objects`, CSS/cover: scroll và ribbon từ cùng họ Noto, cuộn mở có mép, chữ native, vùng đọc cố định | Kiểu natural/crafted v3/v4, chữ dài đầy đủ bằng pager opt-in, reset và bàn phím |
| Last Chapter / Mixtape, mũ | Mũ biến mất sau tung | SVG Noto, tua riêng, bay rồi hạ còn nhìn thấy phía trên lời chúc; loại reaction R03 phụ trên tài liệu mới để tránh hai chuyển động | Mũ v4/snapshot cũ, reset, nhấn nhanh, off, không che chữ |
| Soirée / Santa, chương trình | Chấm màu rượu chìm trên nền cùng màu | Chỉ `studioDriveDocument`: chấm champagne với viền sáng | ID và thứ tự nội dung giữ nguyên, không đổi shape mặc định |
| Last Chapter, cảnh nền xanh | Đường kẻ đi qua chữ trắng quá đậm | Chỉ tài liệu mới: opacity đường kẻ .32 | Mọi scene và dữ liệu tên/ngày/vé |
| Garden Tea / Countdown / các cảnh còn lại | Cửa đôi, hoa/trà, lịch, sticker, thư gấp, album, dấu chấm, băng keo và vé vẫn phù hợp vật liệu | Tái sử dụng; kiểm trước/sau thao tác và thiếu media, không thay chỉ để tăng số asset | 9/8 cảnh; ngày/múi giờ/lịch/vé chung nguồn, RSVP/reply thật |

## Canvas trước khi ghép mẫu

Giữ ID `drive-soiree-envelope`, `drive-camera-print`, `drive-ribbon-diploma`, `drive-cap-toss`. Bốn card mới dùng style có phiên bản; nháp/quà đã lưu giữ reader và prop cũ. Bộ chọn kiểu, màu, nội dung, tốc độ và ảnh vẫn là Canvas. Ảnh camera là asset sở hữu của người gửi; seal của phong bì qua materialize/ACL hiện hành. Không thêm upload animation JSON tùy ý.

Gate Canvas trống: tìm/chèn bằng UI, sửa thuộc tính liên quan, nhân bản, lưu, tải lại, preview và xuất bản quà local. Camera thử với ảnh upload thật; phong bì sửa chữ dấu và lời thư. SVG còn được parse độc lập bằng Sharp và DOM để tránh đưa lỗi XML vào bản nhân đôi hoặc cover. Chỉ sau gate mới gọi `studioDriveDocument` trong writer sáu mẫu.

## Nguồn và biến đổi

- [Google Noto Emoji 2D SVG](https://github.com/googlefonts/noto-emoji/tree/main/2D/svg): cap `emoji_u1f393`, scroll `emoji_u1f4dc`, ribbon `emoji_u1f380`. SVG dùng **Apache-2.0**, xem notice riêng `2D/svg/LICENSE`; không áp dụng OFL của font. Giữ bản nguồn, notice và toàn văn Apache. Loại metadata Illustrator, namespace ID, ánh xạ màu, tách tua; loại các nét chữ giả trên giấy để chữ thật vẫn sửa được. Không ghép nhiều hình khác phong cách.
- [Silviya Atanasova, Envelope](https://lottiefiles.com/free-animation/envelope-2EWElUkPQN), Lottie Simple License: dùng đoạn mở frame 0–40, viewport `252 168 210 210`, đổi màu giấy/phong bì; chữ giả cùng màu giấy. Seal dùng artwork sáp Momevia có sẵn, monogram và lời mời là chữ riêng. Các frame cover cùng nguồn; các tham chiếu SVG nội bộ được mở rộng thành đường vector, không nới bộ kiểm bảo mật cover.
- Nguồn và SHA-256 tại `web/assets/studio-objects/sources.json`; raw JSON/SVG được giữ byte nguyên. Các module `studio-art-data`, `envelope-source-data/frames` ghi tác giả/giấy phép. Tái sử dụng player Lottie SVG light MIT đã có, không tải CDN hay thêm engine.
- Giữ hộp Goodeisgn và nhóm thông/thẻ CC0 đã nghiệm thu ở đợt trước. Các lựa chọn SVG đen thô hoặc không cùng chất liệu đã loại, không đưa vào thư viện.

## Màu và chuyển động

Sáu palette ở `drive-vivid.js`: giấy sáng xen nền đậm, mực sẫm, accent và chi tiết riêng. Garden xanh trà/hồng hoa/vàng; Santa xanh thông/đỏ/kem/đồng; Soirée xanh đêm/rượu/champagne/ngà; Countdown hồng/mận/kem/vàng; Mixtape hồng/mận/xanh bạc/kem; Last Chapter lam/đỏ/vàng/giấy sáng. Style mới đọc các prop màu hiện hành, không ghi đè màu người gửi đã lưu. Chi tiết nổi khối là bóng 2.5D; không tuyên bố là mô hình 3D.

| Thành phần | Chuyển động / phản hồi | Điều khiển và vòng đời |
|---|---|---|
| Phong bì | Seal rời trước, nắp mở, thư trượt; giữ frame mở | Nhịp hiện hành qua `motionSpeed`, chạm/vuốt/Enter; preset mới replay mở tại chỗ. Tắt reaction vẫn đọc được. Abort dừng/hủy player; giữ default hộp v6 |
| Bằng | Nơ/band rời và giấy cuộn mở trong stage cố định | Fast/normal/slow theo contract hiện hành; nhấn nơ hoặc nút/Enter; reset, focus về nút khi nơ ẩn |
| Mũ | Bay theo cung, tua đung đưa, hạ nhỏ phía trên lời chúc | 480/800/1200 ms; chạm mũ hoặc nút/Enter; reset, không còn reaction phụ chồng lên |
| Camera | Flash nhẹ, ảnh đi qua khe, mở lớn ảnh đã in | Vùng và nút ổn định; zoom chỉ bật khi có ảnh và đã in. Click/Enter/Space; Escape, trả focus, abort đóng dialog |
| Các phần còn lại | Giữ reveal giấy/lịch/cào/xé/album và transition của từng scene | Reduced/off dùng trạng thái hoàn tất, không chặn nội dung; âm thanh theo thao tác, dừng khi rời cảnh |

Không có animation lặp vô hạn mới. Pager chỉ áp dụng vùng chữ Studio có marker riêng (64 ký tự/phần cho bằng, 100 cho mũ), giữ đầy đủ nội dung thay vì giảm chữ để nhét. Reader prose cũ giữ threshold cũ. Không cắt/bỏ nội dung để che tràn.

Đo ở 320×568 phát hiện nút camera và reset bị co nhỏ; đã tăng chiều cao riêng cho Studio (camera 60 px, reset bằng/mũ 48 px trước fit), rồi đo lại rect thực và kiểm fit. Cặp mặc định mực/giấy đạt 8.01–15.34:1, chữ trắng/nút 5.88–8.38:1, monogram/giấy 13.94:1. Đây là phép đo các cặp màu được nêu, không phải cam kết mọi màu người gửi chọn hoặc toàn bộ giao diện đều đạt WCAG.

## Kiểm thử và bằng chứng

Kết quả thực chạy và các lỗi đã sửa ghi ở `local/objects-pass2-20261128/REPORT.html` cùng log/JSON/ảnh từng cảnh. Không dùng kết quả lượt trước để báo pass mã mới. Bộ tự động mới `tests/browser/studio-objects.mjs` được gọi trong `test:canvas:browser`: vị trí nút, mũ vẫn hiện không che chữ, giấy mở, keyboard/reset, camera zoom/focus/abort, reaction-off, chữ dài lossless và album cũ.

Chạy build/check/unit/templates/Canvas browser, MySQL QA cô lập với export trước thay đổi. Thử sáu luồng người gửi → người nhận → chủ thiệp, VI/EN 320×568, 390×844, 1440×900, touch/keyboard, off/reduced, ảnh trống/chữ dài/media thiếu/ngày qua hạn/gửi lỗi/thử lại. Bộ fit chung còn kiểm toàn bộ mẫu cũ và tài liệu tùy biến dọc/ngang. Zoom 200% là page-scale và chữ qua Chromium; không gọi là kiểm native browser zoom. Chưa xác minh Safari, điện thoại vật lý, screen reader hoặc FPS trên máy thật.

## Điểm dùng chung và hoàn nguyên

Schema/Inspector chỉ thêm allowlist kiểu mới. `drive-elements` chọn kiểu mới khi chèn; `drive-polish` chỉ áp dụng sáu ID khi tạo tài liệu. Cover và runtime dùng chung nguồn/theme. CSS có lớp phiên bản riêng, đứng sau crafted, mũ/bằng mới không nhận lớp CSS crafted cũ. `page-fit` chỉ thêm marker Studio. `photo-dialog` tái dùng cho album nên phải hồi quy focus/đóng; `source-gift` thêm profile tùy chọn, default timeline/frame của hộp giữ nguyên. `gift-runtime/index` chỉ bổ sung mở tại chỗ cho source-envelope mới; replay của element khác giữ nguyên.

Không đổi ID/giá/quyền/thanh toán, route API phản hồi, dữ liệu nháp hoặc snapshot. Thư viện MySQL có dữ liệu chỉ được cập nhật theo export được review và CAS; không seed đè Admin. Rollout 19 mục giữ các mục ngoài phạm vi; retry/conflict/rollback có kiểm riêng.

Hoàn nguyên trước phát hành bằng revert commit đợt này hoặc quay về QA 54571. Nếu đã có tài liệu dùng kiểu mới ở môi trường khác, hoàn nguyên writer/thư viện theo CAS, **giữ reader và asset** phục vụ các snapshot đó. Không xóa quà/nháp/media để đổi ngoại hình. Repo gốc có WIP độc lập; merge vào HEAD mới phải review riêng.
