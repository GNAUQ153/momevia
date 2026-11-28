# Máy ảnh, mũ và lịch có chiều sâu — 28/11/2026

Tiếp từ `7b9b8a8`, cùng nhánh review trong clone cô lập. Repo gốc `3856921`, 179 WIP được giữ nguyên. QA 60639 và các profile cũ giữ source/data riêng. Chỉ source, bìa sinh và tài liệu đưa lên Git; video, tài khoản và dữ liệu QA ở local. Chưa merge/deploy hoặc ghi DB đang phục vụ.

## Kiểm kê sáu mẫu và khoanh vùng

| Mẫu | Ba kind đang rà trong tài liệu thực | Kết quả |
|---|---|---|
| Graduation Mixtape | `camera-print` ở `scene-cover`, `cap-toss` ở `scene-caps` | Thêm cấu trúc dimensional-v2, giữ ảnh và reply thật |
| Graduation Countdown | `calendar-peel` ở `scene-cover` | Thêm lớp giấy/khoen và sticker hai mặt, giữ cùng nguồn ngày/zone |
| Garden Tea | Không có ba kind này | Giữ cửa/thư/media/sự kiện/RSVP, kiểm hồi quy 9 cảnh |
| Secret Santa | Không có ba kind này | Giữ hộp/thẻ/thông và 9 cảnh |
| Midnight Soirée | Không có ba kind này | Giữ phong bì bản lề và 9 cảnh |
| The Last Chapter V2 | Không có cap-toss/camera-print/calendar-peel; dùng focus-photo, bằng, vé và các bước riêng | Giữ cấu trúc giấy đã hoàn thiện và 10 cảnh; không thêm mũ vào kịch bản |

Các nút bản đồ/lưu lịch và countdown của thiệp mời vẫn là dữ liệu/hành động sự kiện, không bị thay thành lịch bóc. Icon/sticker trang trí giữ vai trò của chúng. Cùng ba card Canvas đã có, ID không đổi; các mẫu mới tạo sau gate dùng default mới. Nháp/quà thiếu enum tiếp tục dùng reader cũ.

| Thành phần | Đã có / cần cải thiện | File/hàm chính | Caller và hồi quy |
|---|---|---|---|
| Camera | Thân/khe native, ảnh thật và zoom có sẵn | `instant-camera`/`dimensional-art`: mặt cạnh, barrel/rim và bóng; `depthCameraRig`: thân/khe/ảnh cùng hệ tọa độ; nhịp press → feed | V4/v5 minh họa, ảnh trống/đổi ảnh/owned ACL, caption và dialog zoom/focus/abort |
| Mũ | Noto cap/tua và vùng đọc cố định | `depthCap`: mặt trước/mặt dưới backface, mép và vải; tua tách khỏi mặt xoay, lệch pha; quỹ đạo bảo vệ tiêu đề | Noto minh họa v5, cap v3/v4, màu/0/reset/long text; không đụng bằng |
| Lịch | Grid/ngày thật, nút thay thế | `depthCalendar`: stack giấy, khoen; sticker front/back xoay quanh góc, ngày còn rõ sau bóc; reserve feedback | Ngày/tháng/năm/zone, tháng 6 hàng, leap day, sai ngày, single tap/Enter/swipe, reset; calendar cũ |
| Contract/Inspector/cover | Ba ID và các thuộc tính nền có sẵn | `objectConstruction` enum illustrated-v1/dimensional-v2; `objectDepth` 0–16; đúng kind/appearance. Cover cùng geometry/màu, thư viện chọn/cấu hình được | Cùng validator/serialize/duplicate; style Classic/Natural không bị enum đang lưu kích hoạt nhầm |
| Player | Intrinsic animation có thể có khi doc không gán effect riêng | Điều kiện toolbar chỉ thêm document có cấu trúc mới đang hoạt động, để motion-off luôn có trên Canvas trống | Document cũ không enum giữ điều kiện cũ; old source/physical-paper không đổi |

## Canvas trước thiệp

Trên Canvas trống đã tìm/chèn ba ID, chọn `Độ dày và chuyển động · 3D`, đặt depth 0/10, sửa màu/nhịp và ảnh/date phù hợp, duplicate, lưu, tải lại, preview và public gift. Camera upload PNG qua API sở hữu hiện hành, chọn trong UI; lịch điền ngày thực qua trường event-time. Chỉ sau gate mới bật default trong `studioObject`.

Kiểu mới chỉ hoạt động ở camera crafted/Studio, cap Studio và calendar crafted. Đổi sang Classic/Natural giữ metadata lựa chọn nhưng không áp renderer/CSS mới. Schema từ chối enum khác, depth ngoài phạm vi và field ở kind không hỗ trợ. 0 tắt độ nổi bổ sung; tắt chuyển động dùng thanh điều khiển hoặc reduced motion. Chuyển động nội tại là cấu hình component, không đăng ký giả thành effect độc lập.

## Chất liệu và chuyển động

Giữ palette từng mẫu: cream cho máy/ảnh, plum/ink cho mũ, detail cho tua/trim/sticker; ánh sáng từ trên trái, bóng tiếp xúc nhẹ. Camera dùng vector Momevia có sẵn, mũ tái dùng Noto/Apache-2.0 với mặt dưới native. Lịch là grid/DOM, không bake tên/ngày vào ảnh. Không thêm engine/CDN hoặc tài nguyên ngoài.

| Trigger / trạng thái | Chuyển động / kết thúc | Off/reduced/cleanup |
|---|---|---|
| Camera click/Enter | Press/shutter nhỏ, giấy chờ 20% rồi đi qua khe đến 82%, cuối nhịp đứng yên. Vùng thân/khe/ảnh cố định | Flash cục bộ một lần; pseudo-flash cũng tắt. Ảnh thật chỉ có zoom khi feed xong |
| Camera reset/in lại nhanh | Hủy lượt chờ zoom cũ, lượt mới chỉ sẵn sàng sau animation của chính nó | Theo đúng `CSSAnimation.finished`; reset/abort không bật lại figure đã đóng. Escape trả focus, rời cảnh đóng dialog |
| Mũ click/Enter | Bay và xoay hai mặt, tua lệch pha, thu nhỏ/hạ rồi còn hiện trên lời chúc | Quỹ đạo không đi qua tiêu đề; không che lời chúc lúc đọc. Reset về vị trí đầu, reduced mở ngay |
| Sticker đúng ngày / nút mở | Tấm giấy lật quanh góc, thấy mặt sau, marker ngày ở lại | Hit target không di chuyển; sai ngày không mở; nút tương đương và bàn phím. Reduced hiện ngay marker |
| Đổi ngày/zone | Grid đọc calendarMonth từ ngày sự kiện hiện hành | Không thêm nguồn ngày thứ hai. Leap 2028 và tháng 6 hàng được kiểm |

Nhịp dùng motionSpeed hiện hành, không loop mới hoặc âm thanh tự phát. Tất cả CSS mới bắt đầu ở lớp `gift-drive-depth`; SVG/DOM chỉ dựng khi chọn enum. Không thay bố cục/căn cước/giá/quyền/source của mẫu khác, không sửa API RSVP/reply hoặc snapshot đã gửi.

## Kiểm chứng

- Unit `dimensional-objects.test.mjs`: validate/duplicate/inactive style, enum/range/kind, source minh họa cũ, SVG parse 0/10/16/unique ID/no remote markup và ngày nhuận/zone/year.
- Browser `dimensional-objects.mjs`, được gọi từ bộ Canvas đầy đủ: PNG thật giải mã đúng kích thước, zoom bị chặn khi đang in, focus/dialog, reset/in lại nhanh, mặt dưới và tua tự do, sticker hai mặt và đúng ngày, primary action không nhảy, model không mutation, 0/reduced/live-off. Ba viewport 320×568, 390×844, 1440×900.
- Fixture riêng chờ trang kiểm/font sẵn sàng và dùng body người nhận, tránh hoạt cảnh trang chủ ảnh hưởng đo/screenshot. Giữ log lần kiểm đầu bị sai lệch setup, không nới ngưỡng geometry để báo pass.
- QA mới chạy sáu luồng gửi/nhận/chủ, 54 cảnh VI/EN, ảnh trống, lỗi gửi/thử lại, kết quả chủ thiệp sau tải lại và hai người trùng tên. Calendar tháng 5/2027 có sáu hàng ở 320×568 vẫn không cuộn; nút mở tương đương đủ lớn. Ô ngày nhỏ có phương án tương đương, không tuyên bố mọi ô đạt 24 px.
- So chính xác sáu snapshot/SVG cover cũ với source QA 7b9b8a8. Build/check/unit/templates/Canvas browser và MySQL QA cô lập: fresh/populated library, Admin/CAS/conflict/retry/rollback/snapshot. Kết quả thực chạy ở `local/dimensional-objects-20261128/REPORT.html`, không dùng kết quả lượt trước cho mã mới.

Chưa xác minh Safari, thiết bị vật lý, screen reader, native browser zoom hoặc FPS điện thoại thật. Không tuyên bố cả giao diện đạt WCAG hoặc mọi màu người gửi chọn luôn đạt contrast.

## Hoàn nguyên

Trước phát hành có thể revert commit đợt này và dùng QA 60639. Nếu đã có snapshot dimensional-v2 ở môi trường khác, hoàn nguyên writer/thư viện qua CAS nhưng giữ schema, helper, renderer và CSS mới cùng asset đã pin. Không xóa quà/nháp/media. Repo gốc có WIP riêng, chưa được tích hợp vào nhánh review này.
