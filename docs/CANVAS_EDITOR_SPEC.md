# Đặc tả trải nghiệm và element của canvas Momevia

Ngày lập: 17/11/2026. Baseline source đã rà soát: `6c44bdb`, package `1.1.0`.

Tài liệu này là **đặc tả đề xuất để triển khai**, không phải danh sách tính năng đã có. Các route mới, module, state, thuộc tính và giá trị mặc định bên dưới đều chưa được lập trình ở baseline trên. Ưu tiên đã được người dùng xác nhận: **người gửi cá nhân hóa và tự thiết kế cơ bản trước; Creator chuyên sâu sau**.

Canvas phục vụ thiết kế quà web tương tác: bố cục, nội dung, cảnh, cách mở quà và lời hồi đáp. Đầu ra chính là link/QR. Người nhận mở quà còn hiệu lực miễn phí, không cần tài khoản. Đợt đầu giữ JavaScript ES modules, HTML/CSS và backend hiện tại; không đưa việc đổi framework vào phạm vi.

## 1. Cơ sở hiện tại và các ràng buộc tích hợp

Các số dòng trong bảng là vị trí tại `6c44bdb`; phải kiểm lại khi baseline thay đổi.

| Chứng cứ source | Hành vi hiện tại | Yêu cầu đối với canvas |
| --- | --- | --- |
| `web/js/pages/gifts.js:6` | Preview là HTML/CSS cố định | Thay bằng renderer dùng chung khi document mới tồn tại; giữ đường legacy |
| `web/js/pages/gifts.js:15` | `/create/:id` là form cá nhân hóa | Giữ đường vào này, bổ sung document và lưu nháp thay vì buộc người gửi đổi thói quen |
| `web/js/pages/gifts.js:21` | Tải orders và payment methods; lỗi đang bị đổi thành danh sách rỗng | Phân biệt lỗi mạng, chưa xác định quyền và danh sách phương thức thực sự rỗng |
| `web/js/pages/gifts.js:25` | Frontend nhận `demo_paid` và `paid` | Không loại bỏ provider-paid khi thêm canvas; server vẫn quyết định quyền cuối cùng |
| `web/js/pages/gifts.js:38` | CTA có xuất bản, thanh toán hoặc dùng thử theo trạng thái | CTA canvas phải phản ánh cùng khả năng, không biến mọi mẫu thành miễn phí |
| `web/js/pages/gifts.js:54` | Trang nhận quà có các phần phong bì, bất ngờ, lời nhắn và reply cố định | Gift mới dùng snapshot/runtime; gift cũ giữ renderer cũ |
| `web/js/pages/gifts.js:90` | Studio có biên nhận giao dịch `paid` | Khu Nháp/Mẫu riêng không thay thế hoặc làm mất khu biên nhận |
| `web/js/pages/catalog.js:53` | Chi tiết mẫu dùng artwork; dòng 59 còn ghi mua mẫu sẽ ra mắt | Preview mới cần demo document; copy mua mẫu phải dựa trên khả năng thật |
| `web/js/pages/creator.js:12` | Creator hiện gửi metadata, chưa có trình thiết kế tự do | Không gọi form hiện tại là Creator canvas; công cụ chuyên sâu thuộc pha sau |
| `web/js/pages/admin.js:6` | Admin duyệt/từ chối từ danh sách metadata | Pha Creator phải bổ sung xem đúng revision, không duyệt chỉ bằng thumbnail |
| `web/js/app/main.js:37` | `navigate()` push URL rồi reset state ảnh và gọi render | Thêm guard trước khi đổi URL; không reset document đang có thay đổi |
| `web/js/app/main.js:58` | `render()` thay `main.innerHTML` | Editor phải có mount/update/dispose riêng, không render lại toàn trang mỗi lần nhập hoặc kéo |
| `web/js/app/main.js:79` | `/payment-result/:orderId` đọc trạng thái và receipt từ server | Bảo toàn route và bổ sung tiếp tục đúng bản thiết kế |
| `web/js/app/main.js:303` | Modal chọn phương thức thanh toán | Không mở modal bằng dữ liệu availability đã lỗi hoặc quá cũ |
| `web/js/app/main.js:313` | payOS hiển thị QR; phương thức khác có thể điều hướng toàn trang | Lưu nháp và asset thành công trước khi rời editor |
| `web/js/app/main.js:528` | `popstate` gọi render trực tiếp | Back/Forward phải tham gia lifecycle và chống mất nháp |
| `web/index.html:33` | Cả `main` có `aria-live="polite"` | Không để screen reader đọc lại toàn tác phẩm khi stage thay đổi |
| `src/modules/payments/payment.service.mjs:59` | Return và cancel URL đều về payment-result | Không suy ra paid/cancelled từ URL hoặc hành vi đóng cổng |
| `src/modules/payments/payment.service.mjs:77` | Status trả order/status/method/amount/checkout URL | Design resume là contract bổ sung, chưa có sẵn trong response này |
| `src/modules/payments/mysql.repository.mjs:83` | Callback không thành công chưa chuyển intent sang trạng thái terminal | Không trình bày failed/expired/cancelled như các trạng thái backend đã hỗ trợ |

`docs/PRODUCT_SCOPE.md` còn các mô tả demo/PostgreSQL từ bản cũ; không dùng những câu đó thay cho bằng chứng source v1.1. Thanh toán v1.1 là nền tảng tích hợp, không đồng nghĩa đã nghiệm thu provider thật hoặc đủ điều kiện thu tiền production; xem `PAYMENTS_V11.md`.

## 2. Đặt canvas ở đâu

Ba chế độ dùng chung document/renderer nhưng có giao diện và quyền khác nhau:

- **Cá nhân hóa nhanh:** sửa slot được phép, bố cục đã chuẩn bị, xem trước tức thời.
- **Tự thiết kế:** thêm và sắp xếp element/cảnh theo capability, lưu nháp, xem trước, xuất bản.
- **Chỉ phát/xem:** chạy trải nghiệm, không có handle, inspector, history hoặc endpoint ghi thiết kế.

| Route | Chế độ | Ai sử dụng | Nội dung và hành động | Giai đoạn |
| --- | --- | --- | --- | --- |
| `/create/:templateId` hiện có | Cá nhân hóa nhanh | Sender đã đăng nhập | Tạo hoặc mở draft từ mẫu; form slot và stage cùng document; đổi tên/lời chúc/ảnh; mở thiết kế đầy đủ nếu mẫu cho phép | Sender đầu |
| `/design/new` đề xuất | Chọn điểm bắt đầu | Sender | Trang trống hoặc bố cục gợi ý; tạo draft một lần rồi chuyển sang ID thật | Sender đầu |
| `/design/:designId` đề xuất | Tự thiết kế cơ bản | Chủ draft có capability | Stage, scene, layer, inspector, asset, lưu, xem trước, xuất bản | Sender đầu |
| `/studio` hiện có | Quản lý | Người dùng đã đăng nhập | Nháp/thiết kế riêng có thể nhân bản, quà đã gửi, biên nhận; thư viện mẫu cá nhân có version ở pha W14 | Sender đầu |
| `/template/:templateId` hiện có | Chỉ phát demo | Khách/Sender | Player demo khi có document; artwork fallback cho legacy; Dùng mẫu | Theo document |
| `/payment-result/:orderId` hiện có | Trạng thái thanh toán | Chủ giao dịch | Trạng thái server, receipt/print, Kiểm tra lại, Tiếp tục thiết kế nếu context hợp lệ | Bắt buộc giữ |
| `/success/:slug` hiện có | Chia sẻ | Theo contract hiện tại | Link, copy, QR, xem quà; nhãn rõ nếu quay về draft hoặc tạo bản sao | Bắt buộc giữ |
| `/g/:slug` hiện có | Chỉ phát quà | Recipient | Mở quà, chuyển cảnh, tương tác, reply; không có editor bundle | Sender đầu |
| `/creator` hiện có | Quản lý mẫu | Creator/Admin | Giữ form hiện tại; sau này thêm danh sách draft/version và mở editor chuyên sâu | Creator sau |
| `/creator/templates/:templateId/edit` đề xuất | Biên soạn mẫu chuyên sâu | Creator có capability | Editable slots, khóa vùng, component/variant, timeline, đóng gói và submit revision | Creator sau |
| `/admin` và màn review revision đề xuất | Chỉ xem/kiểm duyệt | Admin | Phát đúng revision, kiểm asset/quyền/action, approve/reject | Creator sau |
| Home, Explore, Favorites | Thumbnail/điểm vào | Theo route hiện tại | Không mount editor; chỉ tải preview cần thiết | Không cần canvas chỉnh sửa |
| Login, policies, support, receipt printing | Form/nội dung nghiệp vụ | Theo route hiện tại | Giữ hành vi; không nhúng canvas | Không cần canvas |

`/design/new` phải xử lý trước route ID động. Khi đã tạo draft, dùng điều hướng thay thế entry khởi tạo để Back/refresh không tạo thêm draft ngoài ý muốn. Editor route sâu phải được router nhận đầy đủ, không chỉ dựa vào hai segment đầu như hiện tại.

Không tự chuyển Sender thành Creator khi bấm “Tự thiết kế”. Nút “Thiết kế thêm” trên mẫu chỉ mở những chỉnh sửa server cho phép; không bỏ khóa tác phẩm hoặc giấy phép mẫu.

## 3. Bố cục workspace

### 3.1 Desktop và tablet rộng

| Vùng | Nội dung | Quy tắc sử dụng |
| --- | --- | --- |
| Topbar | Back Studio, tên thiết kế, trạng thái lưu, Undo/Redo, viewport, Preview, Publish | Tên và save status luôn nhìn thấy; Lưu nháp khác Xuất bản |
| Library trái | Thêm element, Bố cục, Tệp, Layer, Cảnh | Chỉ một tab chính mở; tìm kiếm theo loại; nhãn quyền không thay cho kiểm quyền server |
| Stage giữa | Artboard, safe area, selection overlay, guides, zoom/fit | Tác phẩm nằm tách khỏi chrome editor; handle/guide không vào snapshot |
| Inspector phải | Nội dung, Bố cục, Kiểu dáng, Tương tác | Theo loại và selection; không hiện field vô hiệu mà không có giải thích |
| Scene strip | Thumbnail, tên cảnh, thêm, duplicate, reorder | Có cách điều khiển bằng nút/bàn phím; cảnh vào đầu tiên được đánh dấu |
| Timeline | Track, keyframe, scrub | Ẩn trong Sender release; chỉ xuất hiện khi pha chuyên sâu hoàn tất |

Workspace giữ token tím/hồng/kem, font và biểu tượng hiện có. Giảm header/footer marketing trên route biên tập bằng chế độ layout riêng, không sửa toàn bộ catalog/auth/recipient. Floating support/back-to-top không che stage controls, inspector hoặc CTA.

### 3.2 Điện thoại và tablet hẹp

- Topbar giữ Back, tên rút gọn, save state và Preview; các thao tác ít dùng ở menu có nhãn rõ.
- Stage là vùng chính; dock dưới gồm Thêm, Layer, Cảnh, Thuộc tính. Chỉ một bottom sheet hoạt động tại một thời điểm.
- Sheet có tiêu đề, nút đóng, focus trap phù hợp và trả focus về nút đã mở. Không để sheet ngoài màn hình vẫn nhận tab.
- Element được thêm bằng nút “Thêm vào cảnh”; drag từ library là tiện ích bổ sung, không là thao tác bắt buộc.
- Chỉnh chữ trong field/sheet ổn định khi bàn phím mềm mở; tránh yêu cầu gõ trên artboard đã bị thu nhỏ.
- Reorder có nút lên/xuống; tọa độ/kích thước có input; crop có Fit/Fill/Đặt lại. Mọi gesture đều có thao tác thay thế.
- Có Fit, phóng to/thu nhỏ. Pinch/pan chỉ bật sau spike chứng minh không xung đột scroll và kéo element. Không đặt `touch-action: none` trên toàn trang.
- Dành safe-area cho dock/CTA; kiểm keyboard mở, landscape, màn hình thấp và sheet đang mở. Không thu toàn tác phẩm tới mức chữ không đọc được chỉ để vừa màn hình.
- Thay đổi viewport thiết bị để xem trước không tự đổi tọa độ của document. Responsive rules là dữ liệu thiết kế, khác zoom editor.

Bộ viewport nghiệm thu: 320/375/390/768/1024/1440 px, có dọc/ngang. Đây là bộ kiểm thử, không phải các kích thước duy nhất người dùng được thiết kế.

## 4. Tương tác stage, history và nhập liệu

### 4.1 Selection và manipulation

1. Bấm element chọn node; bấm nền bỏ chọn; chọn qua Layer phải cho kết quả tương đương.
2. Double click hoặc nút Sửa nội dung mới vào text editing. Một lần chọn không tự mở bàn phím mềm.
3. Element khóa thao tác vẫn thấy được trong Layer và inspector; giải thích vì sao không kéo được. Khóa thao tác cá nhân khác quyền chỉnh nội dung do template/server quy định.
4. Một gesture drag/resize/rotate tạo một history command khi commit. Escape hủy gesture về vị trí trước gesture, không lưu trạng thái nửa chừng.
5. Di chuyển bằng phím mũi tên dùng một bước logical unit, Shift dùng bước lớn hơn; không bắt phím khi caret đang nhập text hoặc form đang xử lý phím đó. Giá trị bước là cấu hình công cụ, không lưu vào document.
6. Resize có aspect lock theo loại; ảnh mặc định giữ tỷ lệ khung. Crop/focal point là dữ liệu riêng, không bị mất khi đổi kích thước.
7. Snap có thể bật/tắt; guides chỉ xuất hiện khi cần. Numeric input luôn cho phép điều chỉnh chính xác mà không phải drag.
8. Multi-select/group không bắt buộc để giao Sender release. Khi triển khai sau, grouping không được thay đổi reading order hoặc target action âm thầm.

### 4.2 Tọa độ và zoom

- Document lưu logical artboard coordinates; pointer mapping xét bounding rect, scale và pan. Không lưu tọa độ màn hình hoặc vị trí panel.
- Zoom và pan là editor view state, không tạo history document, không đổi kích thước gift.
- Một điểm kéo tới phải tương đương khi zoom 50%, 100%, 200%; bộ kiểm thử này không phải giới hạn zoom sản phẩm.
- Rounding chỉ dùng khi hiển thị input; tránh tích lũy sai số bằng việc round liên tục lúc kéo.
- Selection overlay phải cùng hệ biến đổi với element nhưng không nhận tương tác của player khi đang sửa.
- Nếu element vượt vùng an toàn, hiện cảnh báo và hành động đưa vào khung; không tự cắt dữ liệu hoặc làm node không thể chọn lại.

### 4.3 History và văn bản

- Undo/Redo bao phủ add/delete, layout/style/content, crop, layer order, scene add/duplicate/reorder và action target.
- Save, server ACK, preview progress, selection, zoom/pan không tạo history document.
- Một phiên IME composition không bị cắt bởi re-render hoặc tạo history cho từng ký tự trung gian. Commit text sau composition/update hợp lệ.
- Paste text mặc định là plain text; nếu mở rich text sau này chỉ giữ schema formatting cho phép, không giữ HTML/style/script từ clipboard.
- Khi sửa trường đang ràng buộc dữ liệu, inspector phải nói rõ đang sửa binding value hay text literal. Không tự bỏ binding khi người dùng chỉ đổi font.
- Redo bị loại khi có một thay đổi document mới sau Undo. Undo không được hoàn tác gift đã publish hoặc trạng thái giao dịch.
- History trong một phiên phải có giới hạn bộ nhớ dựa trên fixture; không công bố thành giới hạn sáng tạo hoặc gói trả phí.

### 4.4 Layer, scene và focus

- Tách `visible` của tác phẩm khỏi trạng thái panel editor. Nếu có “ẩn chỉ khi biên tập”, phải dùng nhãn/state khác, không dùng chung toggle mơ hồ.
- Z-order khác reading/tab order. Đưa sticker lên trên không tự đổi vị trí đọc text hoặc reply.
- Scene có ID ổn định. Duplicate sinh node/scene IDs mới và remap mọi tham chiếu nội bộ; asset refs chỉ dùng lại khi có quyền.
- Xóa scene/node có action đang trỏ tới phải liệt kê liên kết bị ảnh hưởng. Cho sửa target hoặc hủy xóa; không tự trỏ tới một cảnh bất kỳ.
- Sau chuyển cảnh trong player, focus tới heading/điểm vào phù hợp; có thông báo ngắn, không đọc toàn bộ scene qua live region.
- Escape ưu tiên thoát text editing, hủy gesture, đóng sheet/dialog theo lớp đang hoạt động. Không để global handler đóng nhầm payment dialog hoặc mất nội dung.

## 5. Lifecycle, lưu nháp và trạng thái lỗi

Các state sau là contract UX đề xuất; tách document state, save state, asset state và publication state thay vì gom vào một `isLoading`.

| State | Nội dung nhìn thấy | Hành động được phép | Điều kiện chuyển |
| --- | --- | --- | --- |
| Loading | Skeleton workspace, tên đang tải | Back an toàn | Nhận document + quyền của owner |
| Ready/Clean | Đã lưu, thời điểm/revision phù hợp | Chỉnh, preview; publish nếu qua preflight | Thay đổi tạo Dirty |
| Dirty | Chưa lưu | Chỉnh/Undo/Preview local | Debounce hoặc Lưu ngay tạo Saving |
| Saving | Đang lưu | Tiếp tục chỉnh; không mất focus | ACK đúng revision mới xác nhận phần đã gửi |
| Save failed/Offline | Banner lỗi, giữ nội dung, Thử lại | Chỉnh và preview local | Save ACK; không giả đã lưu từ local recovery |
| Conflict | Bản này đã được chỉnh ở nơi khác | Giữ local, xem bản server, lưu thành bản sao nếu API cho phép | Lựa chọn có xác nhận, không last-write-wins âm thầm |
| Session expired | Đăng nhập lại để lưu | Giữ bản phục hồi theo user, dừng ghi | Xác thực lại đúng owner rồi revalidate revision |
| Forbidden/Not found | Màn lỗi riêng, về Studio | Không hiện nội dung cached trước khi kiểm quyền | Chỉ mở lại khi quyền hợp lệ |
| Unsupported schema | Không thể mở phiên bản này; thông tin hỗ trợ | Quay lại, không tự downconvert | Runtime/adapter hỗ trợ được xác nhận |

Quy tắc lưu:

- Mỗi save có expected revision và payload của phiên bản được gửi. ACK cũ không làm document mới hơn chuyển sang Clean.
- Khi có edits trong lúc Saving, sau ACK vẫn Dirty và gửi phần tiếp theo theo thứ tự. Không gửi hai request ghi không có kiểm soát rồi lấy response đến cuối làm nguồn thật.
- Conflict không tự discard lịch sử/local draft. Các lựa chọn phải nêu hậu quả; lấy bản server cần xác nhận nếu làm mất thay đổi chưa lưu.
- Phục hồi cục bộ là bản hỗ trợ, khóa theo user/design/schema/revision; không thay server thành nguồn chính. Logout hoặc đổi account không được làm lộ nội dung user trước.
- Asset có state Uploading/Ready/Failed. Thay ảnh giữ ảnh cũ đến khi replacement được xác nhận hợp lệ. Publish không dùng asset còn Uploading hoặc Failed.
- Route link, Back/Forward, logout và checkout external redirect phải kiểm dirty state. Refresh/đóng tab dùng cơ chế cảnh báo của trình duyệt khi còn nguy cơ mất dữ liệu; không hứa async save lúc unload luôn hoàn tất.
- Điều hướng trong app phải được quyết định trước `pushState`. `popstate` cần luồng phục hồi/guard phù hợp, không render mất draft ngay rồi mới hỏi.
- Trước redirect thanh toán, draft và asset phải có ACK server; save lỗi thì ở lại editor và cho retry/hủy đi thanh toán. Không dùng “bỏ thay đổi” để âm thầm gửi người dùng sang cổng với thiết kế chưa lưu.
- Mỗi mount có identity/generation; response load/save của phiên đã dispose không cập nhật workspace mới. Hủy request khi phù hợp, nhưng không giả định request đã hủy ở browser chưa từng ghi trên server.
- Dispose dọn listener, pointer capture, observer, timer, audio/video, object URL và preview state; không xóa document đã lưu.

## 6. Registry và thuộc tính chung

### 6.1 Registry là gì

Mỗi type đề xuất cần định nghĩa: `type`, `elementVersion`, schema props, defaults, renderer, inspector, allowed actions/events, asset dependencies, accessibility behavior, capability và validator dùng ở server. Tên trường canonical theo `CANVAS_TECHNICAL_CONTRACT.md`; bảng UX không tạo schema song song. Editor không tự phát minh props mà runtime không hiểu.

Document gồm scene và các node. **Scene/background là cấu trúc document; bố cục gợi ý là preset tạo node.** Hai mục này không bị ép thành một element HTML không thể chỉnh. Tên type trong bảng là đề xuất cho contract, chưa là API có sẵn.

| Thuộc tính chung | Mặc định đề xuất | Kiểm tra bắt buộc |
| --- | --- | --- |
| `id`, `type`, `elementVersion` | ID mới, type/version có trong registry | ID duy nhất; version hỗ trợ; type lạ không render tùy tiện |
| `name` | Tên dễ hiểu theo loại | Plain text, không HTML |
| `sceneId` / parent ref | Cảnh đang chọn | Target tồn tại; không tạo vòng parent |
| Position/size | Trong vùng nhìn thấy của cảnh, dùng logical units | Số hữu hạn, kích thước hợp lệ theo type; không NaN/Infinity |
| Rotation | 0 | Chuẩn hóa góc; type có form tương tác có constraints riêng |
| Opacity | 1 | Trong khoảng 0–1; không dùng ẩn thị giác để giữ control vô hình có focus |
| Visible | true | Node ẩn không nhận pointer/tab trong player |
| Editor lock | false | Chỉ khóa thao tác UI; không thay cho policy server |
| Reading order | Theo thứ tự chèn hợp lý | Xác định riêng với z-order; kiểm được bằng keyboard |
| Style | Token/màu typed từ schema | Không nhận CSS object/string hoặc URL tùy ý |
| Asset references | Rỗng khi không dùng media | Mọi asset phải thuộc quyền và ở trạng thái cho phép |
| Actions | Không có | Action/trigger allowlist, target hợp lệ, không expression/JS |
| Editing policy | Policy do server/template cung cấp | Client không tự cấp quyền bằng sửa document |

Đề xuất profile khởi tạo để spike: artboard mobile rộng 390 logical units, vùng cảnh ban đầu cao 844 và có quy tắc mở rộng/reflow. Đây là profile kiểm chứng ban đầu, không giới hạn scene count, kích thước hoặc thiết bị của sản phẩm. Default typography dưới đây dùng profile này và phải kiểm lại khi schema responsive được chốt.

Các giới hạn bytes, point count, node count, depth hoặc media duration phải có fixture và mục đích an toàn/hiệu năng. Không tự đổi thành tier kinh doanh hoặc áp trần ba cảnh. Ba cảnh bìa → lời chúc → phản hồi chỉ là preset bắt đầu và hành vi legacy.

### 6.2 Element và cấu trúc cơ bản cho Sender

| Mã / type đề xuất | Properties và default đề xuất | Validation và quyền | Action / accessibility |
| --- | --- | --- | --- |
| C01 Scene/background | Scene ID/name; background màu theme; entry cảnh đầu; safe padding; transition none | Background màu/gradient preset hoặc asset hợp lệ; entry và targets tồn tại; không nhận CSS tự do | Có heading/điểm vào; thứ tự đọc hợp lý; không tự phát vòng scene |
| E01 `text` | Literal hoặc binding; preset body 24/heading 32 logical units; line-height 1.4; body font token; màu ink; căn trái; width 80% artboard; auto-height | Font allowlist; plain text; structured rich text chỉ khi có schema; tên người nhận/người gửi và message giữ validator tương thích hiện tại; kiểm overflow | Binding allowlist cho recipient/sender/message/signature; semantic role theo preset; không render text thành bitmap |
| E02 `image` / frame | Asset ID; fit cover; focal point giữa; opacity 1; radius 0; aspect lock bật; alt hoặc decorative | PNG/JPEG/WebP qua pipeline hiện có; draft có placeholder, publish cần asset Ready; không arbitrary URL; replacement không mất ảnh cũ | Alt bắt buộc hoặc chủ động đánh decorative; ảnh mang thông tin không tự coi decorative; crop không xóa nguồn gốc |
| E03 `shape` | kind rectangle/ellipse/line; fill theme; stroke typed; rotation 0; line không có fill | kind allowlist, stroke width hợp lệ, không user SVG/path ở đợt đầu | Decorative mặc định, không tab; nếu mang nghĩa phải có mô tả bằng nội dung tương ứng |
| E04 `sticker` / icon | Registry asset ID; size theo preset; rotation 0; màu đổi được chỉ khi asset hỗ trợ | Asset đã duyệt và có quyền; không nhúng SVG/HTML bất kỳ | Decorative mặc định; không biến icon thành action control thiếu label |
| E05 `button` | Nhãn rõ; style theme; kích thước khởi tạo 160×44 logical units; action chưa cấu hình cho node mới | Publish cần label/target/action hợp lệ; không URL/network/script tùy ý; hit area phải dùng được sau responsive | Nút HTML; Enter/Space; focus visible; `openGift`, `goToScene`, `nextScene`, `replay` theo allowlist; không tự suy ra target khi scene bị xóa |
| E06 `envelope` / gift cover | Preset phong bì; theme colors; cover text/binding; mở bằng tap; motion preset nhẹ; target chưa cấu hình nếu thêm độc lập | Publish cần target; preset asset có quyền; không arbitrary animation script | Có nút Mở quà tương đương click minh họa; reduced motion chuyển trực tiếp; không khóa người dùng trong animation |
| E07 `reply` | Heading Gửi lời hồi đáp; input/name/message/button theo contract hiện có; gift binding chỉ có ở runtime; không rotate mặc định | Không cho nhập arbitrary endpoint; preview không có gift thật; publish kiểm cấu hình block; giữ privacy/limits API hiện tại | Form HTML thật, label/error/focus; status riêng khi gửi; không nhân bản reply history; không thu field nhạy cảm mới |
| P01 Bố cục gợi ý | Preset gồm scene/text/ảnh/trang trí/action + demo bindings | Expand thành các node có IDs mới; validate toàn document; không blob HTML | Người gửi sửa từng node theo quyền; preset ba cảnh phải đi hết tới lời đáp |

Thêm text vào scene dùng nội dung gợi ý dễ nhận ra, không lấy tên/ảnh/lời chúc từ gift cũ để tạo mẫu demo. “Tên người nhận” và “Tên người gửi” là binding của text, không buộc có thêm renderer riêng chỉ để đổi dữ liệu.

Với ảnh mới chưa upload và button chưa chọn target, editor cho phép lưu nháp và nêu lỗi; publish phải chặn với vị trí cụ thể. Việc lưu nháp không được đồng nghĩa document đã sẵn sàng phát hành.

Reply và button có constraints để không bị cắt, thu quá nhỏ hoặc che bởi trang trí; inspector không mở các transform khiến form không dùng được mà không có cảnh báo/preflight. `visible=false` phải bỏ cả focus và hit testing.

### 6.3 Element nâng cao sau Sender release

| Mã / type đề xuất | Properties và default đề xuất | Validation / phụ thuộc | Action / accessibility / fallback |
| --- | --- | --- | --- |
| A01 `audio` / voice | Asset ID; volume 0.5; loop false; controls bật; ý định autoplay tắt mặc định | Volume trong 0–1; pipeline/license audio, MIME/duration, asset Ready; không dùng validator ảnh để nhận audio | Play/mute/pause rõ; xử lý autoplay bị chặn; voice có transcript; không dùng âm thanh là thông báo duy nhất |
| A02 `video` | Asset/poster/caption refs; controls true; fit contain; autoplay false | Pipeline video, poster, duration/resource budget, asset ownership | Native/accessible controls; caption cho lời nói; poster/lỗi media vẫn cho đi tiếp; không autoplay có tiếng |
| A03 `gallery` / slideshow | Danh sách image/caption/alt; index đầu 0; autoAdvance false; transition none | Items/refs hợp lệ, thứ tự ổn định, media budget | Nút trước/sau, swipe tương đương; thông báo vị trí ngắn; không timer chạy khi tab ẩn |
| A04 Animation attachment | Target ID; trigger `sceneEnter`; delay 0; duration 300 ms; iterations 1; easing preset | Target tồn tại; trigger/easing allowlist; không action loop vô hạn; không CSS/JS tùy ý | Reduced-motion mapping; pause/cancel/reset; không dùng animation giữ focus hoặc chặn đọc |
| A05 `particles` / confetti | Preset nhẹ; region của scene; duration 1.500 ms; density thấp theo budget preset; decorative | Budget CPU/GPU/node/particle bằng fixture; không tải script ngoài | Pointer events none; tắt/giảm khi reduced motion; pause khi page hidden; có thể bỏ effect mà nội dung vẫn đủ |
| A06 `flip` / memory book | Front/back hoặc page refs; hướng lật; bắt đầu trang đầu | Refs hợp lệ, page order, không vòng parent | Nút trang trước/sau; trật tự đọc tuyến tính fallback; không bắt buộc gesture |
| A07 `scratch` / reveal | Cover; reveal target; threshold preset; trạng thái ban đầu che | Point/pixel budget; target hợp lệ; Canvas API chỉ cục bộ cho effect | Có nút Mở nội dung thay cào/kéo; nội dung truy cập được; không gửi pixel tương tác lên server mặc định |
| A08 `hotspot` | Label; hit region; target action; visited=false | Target/action allowlist, region hữu hạn, không hover-only | Tab/focus/Enter; tên có nghĩa; không chỉ dựa màu để báo đã mở |
| A09 `countdown` | Timestamp tuyệt đối + timezone; nội dung kết thúc; display cadence | Timestamp hợp lệ; quyền/TTL do server quyết định, không dựa đồng hồ client | Không live announce mỗi giây; có text thời điểm; trạng thái quá hạn đọc được |
| A10 `choice` / branch | Câu hỏi, option labels/targets, fallback/skip | Action graph hữu hạn; targets tồn tại; không eval condition; không thu PII mới mặc định | Radio/button semantics phù hợp; keyboard; không buộc trả lời câu nhạy cảm để đọc quà |
| A11 `memoryTimeline` | Entries/date/text/assets; dọc mặc định | Entry IDs và assets hợp lệ, date có nguồn/timezone rõ khi cần | Đọc tuyến tính; vẫn đầy đủ khi tắt motion; không phụ thuộc hover |
| A12 `drawing` / handwriting | Normalized paths/points, stroke, width; mô tả text | Sanitizer/path grammar riêng, point/byte budget, không user SVG/script | Undo stroke, xóa/sửa; text alternative cho nội dung có nghĩa; không yêu cầu vẽ để điều hướng |

“Nâng cao” chỉ nói độ phức tạp kỹ thuật. Không tự gắn các element trên vào giá/gói, không tự coi Sender bị cấm dùng khi một capability đã cấp.

### 6.4 Công cụ và element chuyên sâu cho Creator

| Mã / thành phần đề xuất | Properties / default | Validation và quyền | Trải nghiệm và giới hạn |
| --- | --- | --- | --- |
| D01 Component instance | Definition ID/version; exposed props; variant mặc định; bindings | Immutable published definition, không dependency cycle, asset quyền đầy đủ | Chỉnh instance chỉ qua exposed fields; fallback khi definition không hỗ trợ; không đổi quà đã phát hành khi sửa definition |
| D02 Personalization schema | Slot ID/name/type/default/demo/validation; editable scope | Server quản policy; demo không PII; không tự tạo quyền bằng client props | Creator thử cả chế độ Sender; giải thích vùng khóa và vùng được phép |
| D03 Timeline/keyframe | Tracks/target/time/easing; playback đầu 0; loop tắt mặc định | Target hợp lệ, keyframe typed, budget và loop hữu hạn | Scrub/play/pause/reset; reduced motion; timeline không bắt buộc với Sender |
| D04 Event flow | Trigger enum → action enum → target; không action mặc định | Reachability/cycle/budget; không arbitrary JS/expression/network | Sơ đồ có danh sách tương đương dùng bàn phím; báo action không tới được |
| D05 Responsive variants | Breakpoint rules, constraints, overrides có nguồn | Không trùng rule mâu thuẫn; inheritance/diff xác định; validate text/forms ở mỗi profile | Creator so sánh phone/tablet/desktop; runtime không suy đoán layout khác preview |
| D06 Code/vector/import chuyên sâu | Package/schema/version/asset manifest riêng | Sandbox origin/CSP, sanitizer, CPU/network policy và review trước khi mở | Dự án riêng; không cho HTML/JS trực tiếp vào trang chính; có accessible fallback |

Cộng tác realtime, AI tạo nội dung và 3D/WebGL không là điều kiện để hoàn tất canvas Sender. Chỉ mở sau đặc tả/kiểm thử độc lập; không để các nút chưa làm xuất hiện như chức năng hoàn chỉnh.

## 7. Capability và quyền sản phẩm

| Lớp quyền | Ví dụ | Nơi quyết định |
| --- | --- | --- |
| Thiết kế | Tạo draft, sửa layout, dùng timeline, sửa slot | Server từ role/ownership/capability đã xác định |
| Element/asset | Dùng sticker, audio, template asset cụ thể | Policy/entitlement và provenance server |
| Chia sẻ/bán | Lưu mẫu riêng, chia sẻ demo, submit bán mẫu | Luồng sản phẩm riêng; Creator không tự duyệt |
| Vận hành gift | Publish, thời hạn link, tài nguyên phát lại | Gifts/service policy, không do recipient chọn gói |

- Sender tự thiết kế cơ bản không cần role Creator. Creator được Admin cấp role theo contract hiện tại; không có nút tự nâng role.
- Editor lock không phải authorization. Không tin `editable`, `paid`, `ownerId` hoặc capability từ payload client để cấp quyền.
- Mẫu giá 0 không mặc nhiên là mẫu riêng tư hoặc được phép phân phối asset. Clone phải kiểm quyền và giữ provenance.
- Thiếu quyền element khi clone/save/publish phải chỉ rõ element và cách thay; không tự xóa âm thầm hoặc biến ảnh trả phí thành bản miễn phí.
- Phân phối bản demo dùng dữ liệu demo; không copy reply, ảnh riêng hay lịch sử gift của người gửi.
- Recipient chạy snapshot hợp lệ, không cần account/membership. Runtime không mở paywall đối với người nhận vì Sender đang dùng element nâng cao.
- Giá/gói/quota/TTL mới chưa được chốt không được đưa vào UX như chính sách chính thức.

## 8. Preview, preflight và publish

### 8.1 Preview

Preview dùng cùng renderer/action engine với public gift nhưng adapter side effect khác:

| Hành vi | Editor preview | Public gift |
| --- | --- | --- |
| Nội dung | Draft hiện tại, kể cả chưa publish | Snapshot phát hành được server cho đọc |
| Chuyển cảnh/effect | Chạy và reset được | Chạy theo document |
| Reply | Giả lập, có nhãn đang xem thử, không POST thật | Dùng API reply hiện tại |
| Analytics | Không ghi lượt nhận quà thật | Theo capability/policy hiện có hoặc bổ sung riêng |
| External navigation | Chặn/giả lập trừ hành động preview có kiểm soát | Chỉ action được policy cho phép |
| Thanh công cụ | Có đóng/reset/viewport | Không có editor controls |

State preview gồm Loading, Ready, Playing, Paused, Error, Closed. Khi đóng, trở về đúng scene/selection/zoom trước preview; không biến scene progress thành document edits hoặc undo history. Missing asset cần placeholder có lỗi rõ, không âm thầm coi là nội dung đã tải đủ.

### 8.2 Preflight và xuất bản

Publish lần lượt kiểm: document/schema → quyền và source template → bindings → scene/action references → assets Ready → layout/accessibility quan trọng → revision đã lưu → idempotency intent.

| State | Giao diện | Kết quả mong đợi |
| --- | --- | --- |
| Checking | Danh sách kiểm tra đang xử lý | Không báo thành công sớm |
| Needs fixes | Lỗi theo scene/node/field; bấm để focus | Phân biệt lỗi chặn với khuyến nghị; nội dung không mất |
| Needs license | Mẫu/element thiếu quyền cụ thể | Mở luồng cấp quyền có sẵn; không suy ra gói mới |
| Ready | Xác nhận nội dung/revision và link sharing context | Người gửi chủ động chọn xuất bản |
| Publishing | Nút tránh double-submit, intent ổn định | Timeout phải kiểm kết quả intent trước retry tạo mới |
| Published | Link/QR, xem quà, revision phát hành | Quà mở từ thiết bị khác và không cần đăng nhập |
| Failed/Unknown result | Lỗi rõ, kiểm tra lại trạng thái intent | Không để người dùng tạo nhiều gift vì response bị thất lạc |

Snapshot đã phát hành bất biến theo lần phát hành. “Tiếp tục chỉnh sửa” quay về draft; publish tiếp tạo lần phát hành theo contract được chốt. Không tự sửa nội dung cùng slug hoặc TTL của quà cũ. Chính sách chỉnh quà đã gửi là hạng mục riêng.

## 9. Thanh toán và quay lại thiết kế

### 9.1 Những gì phải giữ

Giữ free template, `demo_paid` khi cấu hình cho phép, provider `paid`, server-side entitlement và biên nhận/print. Không bật provider live, không thay merchant settings, không thu tiền để kiểm thử canvas. Tests dùng fixture/provider giả lập cô lập; nếu dùng provider thật phải có cấu hình và thẩm quyền riêng.

`payment-result` chỉ đọc trạng thái server. Không tin query string, ảnh chuyển khoản, nút “Tôi đã thanh toán”, local storage flag hoặc việc browser quay về từ provider.

### 9.2 State và copy đề xuất

| State | Copy/hành động | Điều bị cấm |
| --- | --- | --- |
| Methods loading | Đang tải phương thức | Hiện demo như fallback chỉ vì chưa có response |
| Methods error | Không tải được phương thức; Thử lại | Gọi lỗi API là “không có phương thức” |
| Methods empty | Chưa có phương thức khả dụng | Hiện một provider chưa được server cấp; tự bật demo |
| Creating intent | Đang chuẩn bị thanh toán | Cho double-click tạo intent riêng |
| Pending | Chờ máy chủ xác nhận; Kiểm tra lại/Về thiết kế | Tự chuyển paid vì return URL hoặc client timer |
| Paid | Thanh toán đã được xác nhận; Receipt/Tiếp tục thiết kế; kiểm entitlement riêng | Tự coi order paid là quyền còn hiệu lực hoặc tự publish gift |
| Receipt error | Đã xác nhận thanh toán; chưa tải được biên nhận; Thử lại | Đổi thành “chưa thanh toán” hoặc bảo người dùng trả lại |
| License already exists | Bạn đã có quyền; Cập nhật trạng thái/Tiếp tục | Tạo giao dịch mới để sửa cache UI |
| Pending other provider | Đã có đơn chờ theo phương thức khác; xem đơn hiện có | Âm thầm đổi provider hoặc tạo một intent thứ hai |
| Unknown server status | Hiện trạng thái server và đường hỗ trợ | Tự suy ra failed/cancelled/expired chưa có transition backend |

Demo availability cần server capability rõ ràng; endpoint methods hiện tại chỉ trả online methods. Nếu cần thêm capability demo, phải đặc tả bổ sung backend, không coi mảng methods rỗng là bằng chứng demo được bật.

### 9.3 Resume context

1. Lưu document, bindings và asset thành công; giữ design ID và revision ACK.
2. Khi tạo/đọc order, lưu context điều hướng liên quan owner/order/design/source template. Context không chứa lời chúc/ảnh riêng trong provider URL.
3. Một intent theo user/template có thể được mở từ nhiều draft/tab. Không gắn một field `designId` cuối cùng khiến order chỉ quay về draft của tab mới nhất. Contract cần hỗ trợ nhiều context hoặc một lựa chọn draft hợp lệ.
4. Return về result đọc server status. Nếu context còn hợp lệ, có nút “Tiếp tục thiết kế”; nếu context mất, về Studio và cho chọn draft, không đoán design từ item đầu.
5. Server kiểm owner và source template trước resume; `returnTo` từ client phải là route nội bộ hợp lệ, không open redirect.
6. Khi paid, tải lại entitlement. Khi pending, vẫn có thể chỉnh draft theo quyền thiết kế nhưng publish còn chặn nếu thiếu license.
7. Đăng nhập lại sau redirect phải quay về đúng context của user. Account khác không đọc được receipt/draft/cache của owner trước.
8. Paid không tự publish; người gửi xem lại bản lưu rồi chủ động xuất bản.

## 10. Accessibility và nội dung giao diện

- Stage giữ text/button/form semantics bằng DOM. Effect vẽ bitmap chỉ là lớp cục bộ có phương án tương đương; không biến toàn quà thành ảnh.
- Điều chỉnh `aria-live` của vùng editor để không đọc toàn tác phẩm. Dùng status region nhỏ cho lưu, chọn node, lỗi và kết quả action.
- Icon buttons có tên truy cập; focus visible; field inspector có label và đơn vị. Lỗi publish dẫn focus đến node/field thực.
- Modal/sheet cần focus trap, Escape đúng lớp và trả focus. Không để shortcut editor chiếm thao tác text/IME hoặc browser thông dụng khi không cần.
- Reduced motion bỏ/giảm effect nhưng giữ nội dung và đường đi; âm thanh có mute/play rõ ràng. Không dùng màu, hover hoặc animation làm tín hiệu duy nhất.
- Layout không che text và controls vì viewport thấp, font fallback hoặc tiếng Việt dài. Text overflow được báo hoặc reflow theo rule; không co font vô hạn.
- Copy dùng “Lưu nháp”, “Xem trước”, “Xuất bản”, “Thanh toán mẫu”, “Biên nhận” theo đúng trạng thái. Không gọi receipt là hóa đơn VAT.
- Link quà có thể được chuyển tiếp; giữ giải thích quyền xem/reply hiện tại đến khi privacy policy được thay bằng hạng mục riêng. Không hứa link chỉ đúng người được nhập tên mới mở được.
- Không tạo button giả, tab chưa làm hoặc toast thành công trước khi thao tác thật hoàn tất.

## 11. Các kịch bản nghiệm thu đầy đủ

Các dữ liệu dưới đây là synthetic QA. Chạy trên fixture/cổng/data cô lập; không dùng ảnh/người nhận/giao dịch thật. Browser evidence và API/DB evidence phải được ghi riêng.

### Kịch bản A — Sender tạo từ trống và gửi quà bằng link

**Điều kiện:** tài khoản Sender QA; draft storage và asset pipeline test sẵn sàng; không cần mua template; element cơ bản được cấp. Viewport desktop 1440×900, sau đó recipient mobile 390×844 không đăng nhập.

1. Vào Studio, chọn Tự thiết kế → Trang trống. Kỳ vọng tạo một draft, URL có ID thật; Back/refresh không tạo draft trùng.
2. Đặt tên “Sinh nhật Mai QA”; thêm phong bì, text người nhận, lời chúc, ảnh synthetic, nút chuyển cảnh và reply. Kỳ vọng inspector hiển thị đúng loại, mọi ID/target hợp lệ.
3. Nhập tên có dấu và câu tiếng Việt bằng IME; đổi font/màu/căn lề; kéo/resize ảnh ở zoom 50%, 100%, 200%; crop rồi đặt lại. Kỳ vọng không lệch pointer, không mất chữ/crop/selection.
4. Undo/Redo từng thao tác. Kỳ vọng một drag là một bước; Undo text không xóa scene; save/zoom không xuất hiện trong history.
5. Lưu đến ACK, F5. Kỳ vọng tên/document/asset/target đúng; trạng thái Đã lưu chỉ xuất hiện sau load/save xác nhận.
6. Preview từ đầu, mở phong bì, chuyển cảnh, thử reply. Kỳ vọng không có POST reply thật hoặc gift mới; đóng preview trả đúng scene/selection.
7. Publish, copy link, mở QR. Kỳ vọng có một publication theo intent; screenshot/chrome editor không đi vào quà.
8. Mở link trong phiên không đăng nhập trên mobile, dùng cả touch và keyboard để mở quà; gửi reply QA. Kỳ vọng người nhận không bị yêu cầu mua gói; reply thật xuất hiện theo contract hiện tại.
9. Quay lại draft sửa lời chúc, lưu. Kỳ vọng link đã phát hành vẫn giữ snapshot trước; không đổi âm thầm nội dung người nhận đang xem.

**Bằng chứng hoàn tất:** document round-trip, một publication, asset refs hợp lệ, preview không ghi reply, recipient không có editor bundle, không console/CSP/network error ngoài các lỗi được chủ động tạo.

### Kịch bản B — Cá nhân hóa mẫu cần quyền, thanh toán rồi tiếp tục đúng draft

**Điều kiện:** template QA có giá và chưa có entitlement; payment provider test giả lập cô lập cùng webhook verifier fixture hoặc môi trường sandbox được cho phép riêng. Không bật payOS live để chạy kịch bản. Có hai draft QA dùng cùng template để kiểm resume nhiều tab.

1. Mở `/create/:templateId`, nhập tên/lời chúc/ảnh. Kỳ vọng tạo draft cá nhân hóa; không mở sửa vùng bị khóa.
2. Chủ động làm save thất bại rồi bấm Thanh toán mẫu. Kỳ vọng giữ nguyên editor, báo chưa lưu được; không redirect, không mất ảnh/text.
3. Khôi phục mạng, lưu ACK rồi mở phương thức. Kỳ vọng methods loading/error/empty được phân biệt; API lỗi không làm hiện demo giả.
4. Tạo intent và đi provider qua full navigation hoặc payOS QR flow fixture. Kỳ vọng context resume tồn tại theo đúng owner/design và không chứa PII trong URL provider.
5. Return trong khi server còn pending. Kỳ vọng không cấp quyền, không receipt, không auto-publish; Về thiết kế mở đúng draft đã lưu.
6. Mở cùng order từ tab/draft thứ hai. Kỳ vọng không ghi đè context để tab đầu quay về sai draft; không tạo intent thứ hai ngoài policy hiện tại.
7. Gửi webhook hợp lệ trong fixture; Kiểm tra lại result. Kỳ vọng paid và entitlement từ server; receipt đọc riêng. Gây lỗi receipt fetch: trạng thái paid vẫn giữ, có Retry receipt, không yêu cầu trả lại.
8. Chọn Tiếp tục thiết kế, xác nhận nội dung/crop/binding còn đúng; publish chủ động. Kỳ vọng server kiểm quyền lại, tạo gift từ revision đã chọn.
9. Refresh result và mở receipt từ Studio. Kỳ vọng quyền owner và print/PDF hiện tại còn hoạt động; việc canvas thêm draft không làm mất receipt list.

**Bằng chứng hoàn tất:** save-before-redirect, order/entitlement/receipt đúng fixture, không tin return URL, resume đúng nhiều draft, không auto-publish và không nhân đôi intent/publication. Provider thật chưa chạy phải ghi NOT RUN/BLOCKED riêng.

### Kịch bản C — Mobile, mất mạng, xung đột và điều hướng an toàn

**Điều kiện:** một draft QA đã lưu; hai phiên/tab cùng owner; mobile 375×812 và desktop; reduced motion bật. Asset synthetic và một gift legacy dùng để regression.

1. Trên mobile, mở Thêm → text/image; đổi Layer/Cảnh/Thuộc tính. Kỳ vọng chỉ một sheet mở, focus được quản lý, keyboard không che field/CTA; có nút thêm/reorder không cần drag.
2. Tab desktop sửa rồi lưu revision mới. Mobile tiếp tục chỉnh từ revision cũ và save. Kỳ vọng 409/conflict rõ, local edits được giữ; không âm thầm ghi đè server.
3. Chọn giữ local thành bản sao theo contract được cấp. Kỳ vọng IDs/action targets remap đúng, không copy reply/gift history; asset quyền được kiểm lại.
4. Mất mạng, sửa text; bấm Back Studio, Back browser và thử checkout. Kỳ vọng dirty guard trước mất nội dung; checkout không rời khi chưa ACK. Hủy điều hướng thì editor/IME/history vẫn dùng được.
5. Khôi phục mạng, lưu; chuyển nhanh giữa hai design khi response load/save bị trì hoãn. Kỳ vọng response design cũ không ghi đè design mới, trạng thái Đã lưu gắn đúng revision.
6. Preview bằng keyboard, mở phong bì/chuyển cảnh với reduced motion. Kỳ vọng nội dung vẫn đến được, không bị animation khóa; screen reader không đọc lại cả stage khi kéo/gõ.
7. Đăng xuất rồi đăng nhập user QA khác. Kỳ vọng không thấy draft/receipt/local recovery/asset của owner trước; API truy cập trái quyền bị từ chối.
8. Mở gift legacy không đăng nhập, đi qua các phần mở quà và reply/QR như trước. Kỳ vọng renderer mới không phá dữ liệu cũ.

**Bằng chứng hoàn tất:** conflict không mất local, guard và stale-response protection, owner isolation, mobile/a11y evidence và legacy regression. Sau nhiều lần mount/dispose không còn listener/timer/audio/blob URL của editor cũ.

## 12. Ranh giới giao đầu và mở rộng

Giao đầu chỉ hoàn tất khi Sender đi hết: từ trống hoặc mẫu → chỉnh element cơ bản → save/reload → preview → quyền sử dụng/thanh toán khi cần → publish → link/QR → recipient → reply. Một stage kéo thả chưa lưu hoặc chưa chạy ở trang nhận quà chưa đạt mục tiêu.

Sau đó mới mở từng nhóm element nâng cao; mỗi nhóm cần schema, server validator, asset policy, inspector, runtime, accessibility fallback và tests. Creator sâu cần revision review, personalized slots, component/variant và timeline; không cấp chỉ bằng việc hiện thêm toolbar.

Tài liệu này không thay đổi source, data, provider settings hoặc runtime. Khi triển khai phải cập nhật kiểm chứng theo HEAD thực tế và liên kết kết quả với kế hoạch tổng thể, contract lưu trữ/API và work packages của canvas.
