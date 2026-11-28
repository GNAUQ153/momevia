# Phong bì và bằng: chiều sâu giấy có lựa chọn

Phần cấu trúc giấy mới (nắp hai mặt/cạnh, bản lề và trụ giấy) được ghi tại [PHYSICAL_PAPER_QA.md](PHYSICAL_PAPER_QA.md). Reader relief trong tài liệu này vẫn phục vụ các bản đã lưu không chọn physical-v2.

Đợt tiếp từ `84a2899` trên nhánh review `fix/natural-canvas-objects-20261128`, tại bản làm việc cô lập. Chỉ hai thành phần cần thêm chiều sâu: phong bì Source v4 của Midnight Soirée và bằng Studio v5 của The Last Chapter V2. Giữ nguồn Silviya/Noto và giấy phép đã có; không thêm tài nguyên, CDN, WebGL hoặc dependency. Video ghi chuyển động và dữ liệu QA chỉ ở local. Chưa merge/deploy.

| Thành phần / mục tiêu | Đã có | Thay đổi | Phạm vi / hồi quy |
|---|---|---|---|
| Phong bì: mặt và nắp có khối, mở tự nhiên | Nguồn vector/timeline 0–40, chữ dấu và thư native | Ánh sáng liên tục trên từng mặt, mép giấy và bóng tiếp xúc, nghiêng phối cảnh nhẹ. Dấu sáp rời trước, sau đó mở nắp/đưa thư lên; chừa nhịp cho thư hiện rõ trước chuyển cảnh | `source-envelope`, helper `paper-relief`, CSS opt-in; `source-gift` chỉ thêm tỉ lệ lead/play/tail tùy chọn. Default hộp Goodeisgn giữ 0/.66/.34 và fallback .8 |
| Bằng: giấy cuộn có chất liệu, nơ tháo trước | Đường giấy/nơ Noto, chữ thật, vùng stage 190 px, pager | Gradient mềm trên giấy và mặt cuộn, bóng mép; nơ nhấc/rời theo cung trước unroll. Giấy hơi nghiêng khi mở rồi hạ về mặt đọc thẳng | `studio-art`, `studio-objects`, CSS opt-in; mũ/camera và các kiểu bằng cũ không có flag giữ nguyên |
| Canvas: chỉnh và tắt được | Inspector, depth của hộp, motionSpeed | `paperRelief` boolean cho envelope và ribbon-diploma, `objectDepth` 0–16; UI chỉ hiện trên đúng Source/Studio. 0 hoặc tắt trở về vật liệu/nhịp cũ. Chèn mới/chọn kiểu rõ ràng mới bật mặc định | Registry/schema/Inspector dùng cùng validator, không schema thứ hai; field không hợp lệ ở interaction khác bị từ chối |
| Tích hợp và cover | Writer sáu mẫu và cover sinh từ scene | Bật tại `studioObject` cho hai capability sau gate Canvas; cover cùng nguồn, màu và độ nổi, dấu có kích thước tương ứng | ID, giá, binding, ngày/zone, action, quyền asset, snapshot và API không đổi. Chỉ cover Soirée cần sinh lại |

## Canvas trước mẫu

Trên Canvas trống, tìm/chèn hai card, bật hiệu ứng, đặt depth 8, tắt, đặt 0, preview; sau đó nhân bản, lưu, mở lại, xem preview và quà local. Metadata boolean/depth được giữ trên cả hai bản sao. Ảnh sáp vẫn qua materialize/ownership hiện hành. Các shader chỉ dùng mã màu được validator cho phép; không chấp nhận JSON animation hoặc URL tùy ý.

Thiếu flag được hiểu là giữ kiểu cũ, không tự bật khi đọc nháp/quà. `paperRelief=false` và depth 0 được kiểm riêng. Chỉ tài liệu tạo mới hoặc thao tác chọn kiểu có chủ đích dùng default mới. Đây là thành phần Canvas với vật liệu/chuyển động nội tại; không đăng ký giả thành một effect độc lập.

## Chất liệu và nhịp

Ánh sáng từ trên trái, giấy ngà và mép vàng trầm; giữ nét nguồn, tránh bề mặt trắng chói như kim loại. Nguồn chữ giả của phong bì được loại khỏi biến thể relief; lời mời thật vẫn là text riêng. Chữ của bằng ở trên giấy, không nằm trong ảnh ghép. Độ nổi sử dụng vector, gradient, bóng mép và perspective 2.5D nhẹ; không phải mô hình 3D có mesh.

| Trạng thái | Phong bì | Bằng |
|---|---|---|
| Đóng | Nghiêng X 5°, Y −6° ở depth 8; dấu và giấy cùng một rig, nút cố định | Cuộn ngắn, nơ còn trên giấy; nghiêng X 12° trong stage cố định |
| 0–18/20% | Dấu nhấc lên, nắp chờ dấu rời | Nơ và band rời trước |
| 18/20–80/85% | Timeline mở và đưa thư lên; rig nhấc tối đa 4 px | Giấy trải, mặt cuộn hạ xuống, nghiêng giảm dần |
| Cuối | Nhịp còn lại 20%, thư fade 12% tổng thời gian, rig thẳng lại để đọc | Hạ và ổn định; chữ hiện sau 78% nhịp |
| Reduced/off | Hiện ngay trạng thái mở, giữ vật liệu, không chạy animation mới | Hiện ngay chữ/giấy mở, không có chuyển động |
| Reset/replay/abort | Replay sau khi hoàn tất; chạm đôi bị chặn theo pending control. Lead/tail/fallback đều hủy khi off/rời cảnh | Reset khôi phục nơ/cuộn; vị trí nút không đổi. Rời cảnh bỏ node/animation theo lifecycle hiện hành |

Nhịp đọc từ `motionSpeed` và reaction speed hiện hành, không thêm delay bắt buộc cho card cũ. Không có vòng lặp mới hoặc tự phát âm thanh.

## Kiểm chứng

- `tests/unit/paper-relief.test.mjs`: validate/duplicate/zero/disable, depth ngoài phạm vi và interaction không hỗ trợ bị từ chối; source data không bị sửa, không có expression/asset ngoài; SVG parse độc lập ở depth 0/3/8/16. Mũ không đổi khi helper nhận flag không liên quan.
- `tests/browser/paper-relief.mjs`, tích hợp vào `test:canvas:browser`: 320×568, 390×844, 1440×900; mở thực và gradient thực trong Lottie, ảnh trước/giữa/sau, vị trí nút cố định, reset, trạng thái đọc, off và abort khi dấu đang rời, reduced, depth 0, document không bị mutation khi tương tác.
- QA mới kiểm lại sáu luồng và từng cảnh VI/EN, phản hồi thật, hai người trùng tên, lỗi gửi/thử lại và chủ thiệp tải lại. Các profile trước giữ source/data riêng. So snapshot và SVG cover cũ chính xác với QA `84a2899`, không dùng ngưỡng pixel mờ để báo pass.
- Build/check/unit/templates/Canvas browser, MySQL QA cô lập theo export đã review, CAS/retry/conflict/rollback và sửa đổi Admin. Kết quả từng lệnh, ảnh, video và giới hạn thực chạy trong `local/paper-relief-20261128/REPORT.html`; không lấy kết quả đợt trước để báo pass mã mới.

Các cặp màu chữ không thay đổi; gradient ở vùng đọc được làm nhẹ hơn các mặt gấp/viền. Không bảo đảm màu tùy chọn của người gửi luôn có tương phản tốt. Chưa kiểm Safari, thiết bị vật lý, screen reader, native browser zoom hoặc FPS trên điện thoại thật.

## Giữ nguyên và hoàn nguyên

Không thay cấu trúc scene, element ID, dữ liệu lời mời, phản hồi, giá, quyền, thanh toán hoặc media đã pin. Bộ rollout thư viện theo ID/revision hiện hành chỉ áp dụng trên QA cô lập; không seed đè thư viện đang phục vụ. Repo gốc có WIP độc lập và chỉ được đọc.

Trước phát hành có thể revert commit đợt này và dùng QA 54296. Nếu môi trường khác đã có snapshot dùng `paperRelief`, hoàn nguyên writer/thư viện qua CAS nhưng giữ validator/reader/helper và asset để đọc chúng; không xóa quà/nháp/video để rollback ngoại hình.
