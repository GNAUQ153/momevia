# Kế hoạch canvas thiết kế quà tương tác Momevia

Ngày cập nhật: 17/11/2026, sau đồng bộ Git tới `6c44bdb`, Momevia v1.1. Phạm vi: xử lý phần thay đổi chồng lấn khi cập nhật Git, rà soát và lập kế hoạch; chưa triển khai canvas. Người dùng đã chọn ưu tiên **người gửi cá nhân hóa và tự thiết kế cơ bản trước, rồi mở rộng Creator**.

Mục tiêu là tạo trải nghiệm quà tặng web có bố cục, cảnh, chuyển động và thao tác của người nhận. Đầu ra chính vẫn là link/QR. Canvas là không gian biên tập trải nghiệm này; dữ liệu thiết kế phải chạy được ở cả xem trước và trang mở quà.

Bộ kế hoạch gồm:

- Tài liệu này: phạm vi sản phẩm, vị trí canvas, thứ tự triển khai và các quyết định.
- [Đặc tả editor và element](CANVAS_EDITOR_SPEC.md): màn hình, trạng thái, công cụ, thuộc tính element và kịch bản người dùng.
- [Hợp đồng dữ liệu và API](CANVAS_TECHNICAL_CONTRACT.md): schema, storage, CAS, xuất bản, asset và tích hợp thanh toán.
- [Backlog triển khai và nghiệm thu](CANVAS_IMPLEMENTATION_BACKLOG.md): gói việc, file dự kiến, dependency, test và rollback.
- [Rà soát v1.1 và bằng chứng Git/QA](CANVAS_V11_REVIEW.md): sự thật hiện tại, điểm lệch của kế hoạch cũ, rủi ro và giới hạn kiểm chứng.
- [Prompt triển khai](CANVAS_IMPLEMENTATION_PROMPT.md): hướng dẫn dùng trong cuộc trò chuyện tiếp theo.

Các bảng API/schema/công cụ chưa có trong source đều là thiết kế đề xuất. Giá, gói, quyền thương mại và chính sách riêng tư chưa được chốt không trở thành mặc định chỉ vì xuất hiện trong kế hoạch.

## 1. Cơ sở và hiện trạng

- Nhánh `feat/canvas-design-plan` đã fast-forward từ `0726760` tới upstream `6c44bdb` sau fetch, thêm 7 commit. Ban đầu không có unmerged entries; vướng thay đổi local trên `.gitignore` và `docs/README.md`. Đã sao lưu, stash chọn lọc, fast-forward và apply lại; không tạo merge commit, không push.
- Giữ cả ignore `graphify-out` ở local và ignore `database/private` từ upstream; giữ liên kết canvas và liên kết MySQL mới. Bản kế hoạch trước đồng bộ nằm trong `local/canvas-replan-20261117/before-sync/`; stash phục hồi vẫn còn, không apply lại lên bản kế hoạch mới.
- Graph cũ không đại diện v1.1. Đã dựng graph AST riêng tại `local/canvas-replan-20261117/ast/graphify-out/`: 146 file code, 755 node, 1.862 cạnh, không gọi LLM. Sáu file SQL thiếu parser nên đọc trực tiếp; tài liệu/CSS không được chứng nhận bởi graph AST này. `tokens.css` bị bộ lọc sensitive bỏ qua, không phải phát hiện secret trong file.
- Frontend vẫn JavaScript ES modules/HTML/CSS; backend một process Node.js. JSON mặc định còn hoạt động, **MySQL 8.4 có adapter runtime tùy module**; factory/service đã async. Chưa có scene editor hay schema canvas.
- v1.1 đã có nền tảng payOS/MoMo, webhook, entitlement và receipt. Không gọi đó là chỉ demo, cũng không gọi là đã kiểm chứng thương mại. Payment mặc định tắt; lần kiểm này không kết nối provider/DB thật.

| Nguồn hiện tại | Đã có | Khoảng trống cần xử lý |
| --- | --- | --- |
| `web/js/pages/gifts.js:6`, `:15` | `/create/:templateId`: form tên người nhận, người gửi, lời chúc, một ảnh; preview trực tiếp | Chưa kéo thả, lưu nháp, layout hay scene document |
| `web/js/pages/gifts.js:54` | `/g/:slug`: mở phong bì → bất ngờ → lời nhắn và reply | Ba trạng thái HTML viết cố định; không dựng từ thiết kế |
| `web/js/pages/creator.js:12` | Creator nhập metadata mẫu | Chưa thiết kế nội dung/cảnh và định nghĩa vùng cá nhân hóa |
| `web/js/pages/catalog.js:53` | Chi tiết mẫu, dùng thử, CTA cá nhân hóa | Preview mẫu là artwork; chưa phát trải nghiệm thật |
| `web/js/pages/admin.js` | Duyệt/từ chối mẫu | Chưa xem chính xác phiên bản thiết kế đang duyệt |
| `web/js/app/main.js:37`, `:58` | Router SPA, render bằng thay `innerHTML` toàn trang | Cần mount/dispose editor riêng, giữ focus/selection/history, tránh mất nháp |
| `src/modules/catalog/catalog.service.mjs:48` | Hàm `createDraft` tạo mẫu có `status: pending`, `scenes: 3` | Tên hàm chưa phản ánh nháp thực; thiếu vòng đời draft/revision/submit |
| `src/modules/gifts/gifts.service.mjs:42` | Tạo và xuất bản quà ngay; await license và repository; cleanup ảnh khi insert lỗi | Chưa có nháp, save revision, publish snapshot; chỉ một ảnh |
| `src/modules/gifts/mysql.repositories.mjs:32` | Ghi các cột legacy và payload JSON | Không được chỉ nhét document vào payload rồi bỏ qua FK, projection và transaction |
| `src/modules/checkout/mysql.repository.mjs:27` | License qua entitlement chưa revoke và order hợp lệ | Editor cần đọc quyền server hiện hành, không suy ra từ lịch sử đơn |
| `src/modules/payments/payment.service.mjs:39` | Intent, provider, webhook, status/receipt | Chưa gắn draft/revision và hành trình quay lại editor |
| `src/server/app.mjs` | Chỉ GET/HEAD/POST; POST có kiểm tra origin | Endpoint mới cần phù hợp contract này |
| `src/gateway/static.mjs:33` | CSP chặt, frame bị chặn | Editor/preview phải được thử với CSP thật, không hạ CSP để chạy |

Phạm vi sản phẩm vẫn ưu tiên sinh nhật, người nhận không đăng nhập và một role/tài khoản. `PRODUCT_SCOPE.md` cùng một số đoạn README/ARCHITECTURE chưa cập nhật đầy đủ MySQL/payment; dùng source v1.1 và các tài liệu `MYSQL_V09`, `MYSQL_V10`, `PAYMENTS_V11` để phân biệt capability đã có với gate chưa kiểm chứng. Đặc tả gốc `P:/entrepreneuer/Tai_lieu_chuc_nang_he_thong_day_du.md:100` yêu cầu người dùng tự thiết kế, lưu mẫu riêng, chia sẻ miễn phí; dòng 127–142 phân biệt công cụ người dùng và công cụ Creator. Các khả năng canvas này chưa có trong runtime.

## 2. Canvas sẽ xuất hiện ở đâu

Các route mới bên dưới là đề xuất. Giữ các đường dẫn và dữ liệu cũ hoạt động.

| Vị trí | Mức sử dụng | Trải nghiệm và hành động | Đợt |
| --- | --- | --- | --- |
| `/create/:templateId` hiện có | Cá nhân hóa nhanh | Chọn vùng trên preview để sửa tên/lời chúc/ảnh, chỉnh thuộc tính mẫu cho phép; nút mở thiết kế đầy đủ nếu được phép | Đầu |
| `/design/new` mới | Tự thiết kế cơ bản | Chọn trang trống hoặc bộ bố cục gợi ý; tạo design riêng cho người gửi | Đầu |
| `/design/:designId` mới | Editor đầy đủ theo quyền | Tiếp tục nháp, thêm element/cảnh, lưu, xem trước, xuất bản | Đầu |
| `/studio` hiện có | Quản lý, không nhúng editor | Nháp/thiết kế riêng có thể nhân bản, Quà đã gửi, Biên nhận; CTA Tự thiết kế và Tiếp tục. Thư viện mẫu cá nhân có version ở W14 | Đầu |
| `/template/:templateId` | Chỉ phát preview | Chạy bản demo mẫu, chuyển mobile/desktop, nút Dùng mẫu; không nạp editor nặng | Khi có mẫu scene JSON |
| `/creator` hiện có | Quản lý mẫu | Danh sách và trạng thái; CTA tạo/chỉnh trong `/creator/templates/:templateId/edit` | Sau |
| `/creator/templates/:templateId/edit` mới | Chuyên sâu | Dùng chung editor, thêm vùng tùy biến, khóa layer, biến thể, timeline, đóng gói mẫu, gửi duyệt | Sau |
| `/admin` và màn xem mẫu cần duyệt | Chỉ kiểm tra | Phát đúng revision đang duyệt; xem asset/quyền, lỗi, điểm thay đổi; duyệt/từ chối revision đó | Sau |
| `/g/:slug` | Chỉ phát quà | Runtime nhẹ: mở quà, tương tác, nhạc, reply; không thanh công cụ thiết kế | Đầu |
| `/success/:slug` | Chia sẻ | Giữ copy link, QR, nút xem; có thể thêm thumbnail, không editor | Đầu |
| `/payment-result/:orderId` hiện có | Trạng thái/biên nhận, không editor | Đọc server status; thêm quay lại đúng design qua context xác thực; không tự xuất bản | Đầu |
| Home, Explore, Favorites, Login, Checkout | Không cần editor | Thumbnail hoặc đoạn demo ngắn được tải khi cần; CTA dẫn đến đúng luồng | Theo luồng |

Không khóa quyền tự thiết kế cơ bản sau role Creator. Ngược lại, nút bật chế độ chuyên sâu cũng không tự cấp quyền bán mẫu hoặc quyền dùng tài nguyên.

## 3. Các vùng của editor

Desktop dùng workspace riêng, giữ nhận diện tím/hồng/kem và font hiện tại trong `BRAND_UI.md`. Giảm header/footer marketing khi biên tập để dành chỗ cho tác phẩm.

```text
Tên thiết kế · Đang lưu/Đã lưu/Lỗi · Undo/Redo · Xem trước · Xuất bản
┌─────────────────┬────────────────────────────┬──────────────────┐
│ Thêm element    │ Thanh chọn thiết bị / zoom │ Thuộc tính       │
│ Mẫu bố cục      │                            │ Nội dung         │
│ Tệp của thiết kế│           STAGE            │ Bố cục           │
│ Layer / Cảnh    │  Khung quà + vùng an toàn  │ Kiểu dáng        │
│                 │                            │ Tương tác        │
└─────────────────┴────────────────────────────┴──────────────────┘
Danh sách cảnh · Thêm / nhân bản / sắp xếp       Timeline ở đợt sau
```

- **Thanh trên:** tên, back về studio, trạng thái lưu thực, hoàn tác/làm lại, preview, xuất bản. Phân biệt Lưu nháp và Xuất bản.
- **Thư viện trái:** tìm kiếm element, nhóm nội dung/trang trí/tương tác, asset thiết kế, nhãn quyền và lý do chưa sử dụng được.
- **Stage giữa:** chọn, kéo, resize, rotate phù hợp loại element, căn giữa, snapping có thể tắt, zoom/fit, khung nhìn và vùng an toàn. Dấu chọn và tay nắm không đi vào nội dung xuất bản.
- **Inspector phải:** nội dung, font/màu, kích thước/vị trí, crop, opacity, thứ tự; chỉ hiện thuộc tính hợp lệ. Text hỗ trợ tiếng Việt và nhập liệu IME.
- **Layer:** đổi tên, đưa trước/sau, ẩn trong bản nháp, khóa thao tác, nhóm/ungroup ở đợt nâng cao; phân biệt khóa thao tác với quyền chỉnh nội dung.
- **Scenes:** xem thumbnail, thêm, nhân bản, sắp xếp, chọn cảnh mở đầu; xóa cảnh phải xử lý các liên kết đang trỏ tới cảnh đó.
- **Preview:** chạy từ đầu/dừng/reset, thử thiết bị, tắt nhạc/giảm chuyển động. Preview dùng dữ liệu trong nháp nhưng không gửi reply thật hay tạo quà.
- **Mobile:** stage ở giữa, thêm element/layer/thuộc tính trong bottom sheet; nút điều khiển đủ dễ chạm; nhập tọa độ/căn chỉnh là lựa chọn thay kéo thả. Không bắt người gửi dùng timeline phức tạp.
- **Khả năng truy cập:** thao tác bằng bàn phím và form thuộc tính; focus nhìn thấy được, tên truy cập cho icon, phím tắt không chiếm thao tác nhập text. Không đặt `touch-action: none` cho cả trang.
- **Thông báo hỗ trợ đọc màn hình:** `web/index.html:33` đang đặt `aria-live` trên toàn `main`; editor phải điều chỉnh phạm vi này và dùng vùng status nhỏ cho thông báo lưu/chọn, tránh đọc lại tác phẩm khi drag/type.
- **Lưu và phục hồi:** debounce, lưu ngay sau thao tác quan trọng, hiển thị offline/lỗi/đang xung đột; chỉ ghi Đã lưu sau ACK server. Bản phục hồi cục bộ tách theo user/design và không thay server thành nguồn dữ liệu chính.
- **Rời editor:** bảo vệ nháp trước điều hướng nội bộ, Back/Forward/`popstate` và refresh/đóng tab theo khả năng trình duyệt. Khi còn dirty hoặc save pending/failed, cho lưu/thử lại hoặc xác nhận bỏ; không hứa refresh luôn kịp autosave. Response đến muộn của editor cũ không được cập nhật thiết kế vừa mở.

## 4. Công cụ khác với element

Undo, snap, layer, zoom, crop, timeline, autosave là **công cụ biên tập**. Text, ảnh, phong bì, nhạc, nút chuyển cảnh là **element trong tác phẩm**. Registry element cần mô tả renderer, schema, defaults, inspector, loại event/action được phép, quyền, asset, accessibility và khả năng export preview.

### 4.1 Bộ element cơ bản cho đợt đầu

| Nhóm / element | Thuộc tính cần có | Tác dụng / điều kiện nghiệm thu |
| --- | --- | --- |
| Scene / nền | Màu, gradient preset, ảnh nền, fit/position | Khung trải nghiệm; cảnh mới có điểm vào hợp lệ |
| Text / lời chúc | Nội dung, font được cấp, cỡ chữ, màu, căn lề, khoảng dòng | Không vỡ dấu tiếng Việt; kiểm tra tràn nội dung |
| Trường người nhận / người gửi | Binding có tên, giá trị demo, validation | Một nơi nhập cập nhật mọi vị trí liên quan |
| Ảnh / khung ảnh | Asset ID, alt text, crop, fit, bo góc | Đổi ảnh không phá bố cục; giữ xử lý ảnh an toàn hiện có |
| Hình cơ bản / đường | Rectangle, ellipse, line, fill/stroke | Trang trí và phân cách; không nhận SVG tùy ý từ người dùng |
| Sticker / icon được duyệt | Asset ID, màu nếu hỗ trợ, size/rotate | Tim, hoa, nơ, ngôi sao; chỉ asset có quyền |
| Nút hành động | Nhãn, kiểu dáng, hành động định sẵn, target | Chuyển cảnh, mở quà, xem lại; dùng được bằng bàn phím |
| Phong bì / hộp quà preset | Màu, chữ bìa, target khi mở | Tạo được khoảnh khắc mở quà đúng mục đích Momevia |
| Khối lời đáp | Nhãn, vị trí, binding gift runtime | Dùng backend reply hiện hữu; preview không ghi dữ liệu |
| Khối bố cục gợi ý | Cụm text + ảnh + trang trí | Giúp người gửi bắt đầu nhanh; không phải component code tùy ý |

Tối thiểu phải hoàn tất một quà: bìa/phong bì → lời chúc có ảnh → phản hồi, đồng thời cho phép tạo bố cục riêng. Ba cảnh là preset khởi đầu và dữ liệu legacy, không phải trần sáng tạo của schema.

### 4.2 Element nâng cao sau khi luồng cơ bản ổn định

| Element | Thông số chính | Phụ thuộc cần hoàn tất |
| --- | --- | --- |
| Nhạc nền / giọng nói | Asset, volume, loop, nút mute/play | Upload/giấy phép audio, điều khiển người nhận, xử lý autoplay bị chặn |
| Video ngắn | Poster, controls, fit, caption | Media pipeline, giới hạn tài nguyên, tải chậm và lỗi media |
| Album / slideshow | Danh sách ảnh, caption, cách chuyển | Nhiều asset, điều khiển bàn phím và touch |
| Animation preset | Fade, slide, pop, delay, duration, easing | Runtime hủy/reset được, chế độ giảm chuyển động |
| Confetti / cánh hoa / bướm | Loại, mật độ, vùng, thời lượng | Budget hiệu năng, pause khi ẩn trang, phiên bản ít chuyển động |
| Thiệp lật / sách kỷ niệm | Mặt trước/sau hoặc các trang | Trật tự đọc, thao tác thay thế vuốt/lật |
| Cào để mở / kéo để mở | Vùng che, ngưỡng, nội dung được mở | Canvas cục bộ cho hiệu ứng, nút Mở thay thế, không khóa nội dung với người không kéo được |
| Hotspot / vùng khám phá | Nhãn, hit area, action | Thứ tự focus, trạng thái đã khám phá, không dựa riêng vào hover |
| Đếm ngược | Thời điểm, timezone, nội dung kết thúc | Quy tắc thời gian, trạng thái quá hạn; không dùng đồng hồ client để cấp quyền |
| Câu hỏi / lựa chọn nhẹ | Câu hỏi, nhánh tiếp theo, nút bỏ qua | Action graph hữu hạn, không thu dữ liệu nhạy cảm mặc định |
| Timeline kỷ niệm | Mốc, ảnh, chú thích | Bố cục responsive, đọc được khi tắt animation |
| Chữ viết tay / nét vẽ | Path được chuẩn hóa, màu, độ dày | Giới hạn điểm/bytes, sửa/xóa, phương án text thay thế |

Mức kỹ thuật cơ bản/nâng cao không đồng nghĩa miễn phí/trả phí. Quyền dùng từng element do policy riêng, chưa chốt gói hoặc giá mới.

### 4.3 Công cụ và element chuyên sâu cho Creator

- Component tái sử dụng và biến thể: vùng editable, khóa bố cục, defaults, schema đầu vào, version dependency.
- Timeline nhiều track, keyframe và đồng bộ chuyển động/âm thanh; cho thử scrub và reduced motion.
- Sơ đồ sự kiện: `tap`, `sceneEnter`, `animationEnd` → `show`, `hide`, `nextScene`, `playAudio`; validate target, ngăn vòng lặp không giới hạn.
- Thiết kế nhiều breakpoint, constraints, nhóm lồng nhau và asset library có giấy phép thương mại.
- Đóng gói mẫu, preview demo, thumbnail, metadata, kiểm tra trước gửi duyệt, so sánh revision.
- Element tự biên soạn, vector/path chuyên sâu và import animation là backlog riêng, cần sanitizer/validator tương ứng.
- Custom HTML/CSS/JS là pha riêng sau cùng: origin cô lập, CSP/sandbox, giới hạn mạng và CPU, bridge thông điệp cho phép rõ ràng. Không nhúng script người dùng vào trang chính.
- Cộng tác thời gian thực, 3D/WebGL, AI tạo nội dung là tùy chọn tương lai; không phụ thuộc để ra mắt canvas đầu tiên.

## 5. Phân quyền và vòng đời sản phẩm

Tách bốn lớp: **quyền thao tác thiết kế**, **quyền sử dụng element/tài nguyên**, **quyền chia sẻ hoặc kinh doanh mẫu**, **quyền vận hành quà/link**. Có quyền một lớp không suy ra quyền các lớp còn lại.

| Chủ thể | Quyền canvas dự kiến | Ràng buộc |
| --- | --- | --- |
| Khách | Xem preview mẫu | Đăng nhập trước khi lưu thiết kế/xuất bản như hiện tại |
| Sender | Cá nhân hóa, tự thiết kế cơ bản, lưu nháp/mẫu riêng | Chỉ thiết kế thuộc sở hữu; tuân thủ quyền mẫu và element |
| Sender chia sẻ miễn phí | Tạo bản demo để người khác sử dụng ở pha riêng | Không tự cấp quyền premium; không chứa tên/ảnh riêng/reply của quà gốc |
| Creator được Admin cấp role | Các quyền Sender và biên soạn mẫu theo capability | Định giá/gửi duyệt trong luồng Creator; không tự duyệt |
| Admin | Xem revision, kiểm tra và duyệt/từ chối | Không âm thầm sửa tác phẩm của tác giả |
| Recipient | Chạy đầy đủ quà còn hiệu lực, gửi lời đáp | Miễn phí, không cần tài khoản; không kiểm tra gói của người nhận |

Đợt đầu giữ cơ chế role hiện tại; capability tối thiểu được ánh xạ từ role và ownership ở server. Khả năng thêm thiết kế riêng cho Sender không yêu cầu đổi Sender thành Creator. Chưa bật subscription, đa vai trò, thanh toán thật hoặc chính sách giá từ đặc tả dài hạn.

Giữ nguyên các luồng thanh toán v1.1 khi đã được cấu hình hợp lệ; "chưa bật" nghĩa là task canvas không tự thay cờ hoặc merchant credentials. Không xóa provider/webhook/receipt đã tồn tại. Trường hợp entitlement bị revoke dù order vẫn paid phải chặn xuất bản với lý do rõ; không tự bắt thanh toán lại.

Template chia sẻ và template bán phải phân biệt bằng mục đích/visibility, không chỉ `price === 0`. Chỉ chia sẻ bản dùng dữ liệu demo và asset được phép phân phối. Quyền nhúng trong quà đã phát hành cần gắn snapshot; thiếu quyền khi sao chép mẫu phải hiện chính xác element cần thay, không tự loại bỏ âm thầm.

## 6. Kiến trúc canvas đề xuất

### 6.1 Chọn cách dựng hình

Đề xuất stage bằng **DOM + CSS**, overlay SVG cho tay nắm/guide, Canvas API chỉ trong element cần vẽ hiệu ứng như scratch/particles. Đây là lựa chọn để thử nghiệm, chưa cài thư viện mới. Nội dung quà có text, form, button, audio và video nên dùng phần tử HTML phù hợp.

`<canvas>` là bitmap và không tự cung cấp ngữ nghĩa của các đối tượng được vẽ; phải bổ sung nội dung truy cập tương đương. Vì vậy không nên mặc định vẽ toàn bộ form/lời chúc/nút vào một bitmap. Nguồn: [MDN canvas accessibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas#accessibility).

Spike kỹ thuật phải chứng minh: kéo/resize không lệch khi zoom; tiếng Việt nhập đúng; preview và published render cùng kết quả; hoạt động dưới CSP hiện tại; dùng được bằng bàn phím/touch. Chỉ cân nhắc thư viện scene graph nếu spike cho thấy nhu cầu vượt khả năng triển khai nhỏ, và cần ghi rõ chi phí dependency/license/bundle.

Animation có thể dùng CSS/Web Animations API cho DOM; cần pause/cancel/reset và giảm chuyển động. Nguồn: [MDN Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API). Nhạc có nút điều khiển, khởi động sau tương tác và xử lý lỗi `play()`, theo [MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). Touch giới hạn xử lý riêng trong vùng drag phù hợp, theo [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

### 6.2 Tách editor và runtime

```text
Template version / Design draft
             ↓ validate + bind dữ liệu người gửi
      Document schema chung
        ↙               ↘
Editor store         Scene renderer + interaction runtime
Commands/history          ↑               ↑
Stage + inspector     Preview mode     Public gift snapshot
```

- Một schema và registry dùng chung; editor thêm UI điều khiển, runtime chỉ dựng và chạy.
- Preview mode dùng cùng render/action engine nhưng thay side effect bằng adapter giả lập (reply, analytics, navigation ra ngoài).
- Public gift tải runtime nhẹ; editor/timeline chỉ import khi vào route biên tập.
- Không gọi `render()` toàn app trên mỗi drag/keystroke. Editor có `mount`, `dispose`, store riêng; dọn listener, observer, timer, audio và object URL khi rời trang.
- Binding chỉ chấp nhận trường định nghĩa trước; không biểu thức JavaScript tùy ý. Text không đi vào `innerHTML` dưới dạng chưa xử lý.
- CSS editor có phạm vi `.editor-*`; không làm thay đổi trang catalog/auth/recipient ngoài chủ đích.

### 6.3 Mô hình dữ liệu

| Đối tượng | Trường và nguyên tắc |
| --- | --- |
| Design draft | ID, ownerId, revision, schemaVersion, source phân loại blank/template, document, updatedAt; private mặc định |
| Document | artboard/baseSize, responsive rules, theme tokens, scenes, elements, bindings, assets, interactions; không chứa session hoặc reply |
| Scene | ID ổn định, tên, background, thứ tự, element IDs, entry/exit; điểm vào và target phải tồn tại |
| Element | ID, type, version, transform/layout, style, props, bindings, accessibility, actions, editing policy; allowlist từng type |
| Asset | ID, owner, mime, bytes, dimensions/duration, hash, storage key, license/provenance, trạng thái; document tham chiếu ID thay base64 |
| Template version | Template ID, version/revision, document demo, personalization schema, asset refs, review status; phiên bản đã duyệt không bị sửa trực tiếp |
| Gift publication | Gift ID/slug giữ nguyên kiểu hiện tại, document snapshot, template version, asset manifest, quyền nhúng, TTL; bất biến theo lần xuất bản |

`schemaVersion`, `revision` và `templateVersion` có trách nhiệm khác nhau: định dạng dữ liệu, xung đột lưu nháp, phiên bản mẫu. Không dùng chung một số version cho cả ba.

Nguồn thiết kế được server xác lập: `source: { kind: 'blank' }` hoặc `{ kind: 'template', templateId, templateVersionId }`. Source/provenance và policy chỉnh sửa không nhận ghi đè từ payload save. Thiết kế từ trang trống xuất bản qua `from-design`, không gọi thẳng `GiftService.create()` vốn bắt buộc tìm template; không tạo template giả để vượt điều kiện. Quà mới vẫn có tiêu đề hiển thị từ tên thiết kế cho dashboard. Tên trường canonical và ví dụ JSON nằm trong hợp đồng kỹ thuật; các mô tả khái quát ở tài liệu khác không tạo schema thứ hai.

Lưu thiết kế bằng tọa độ logic của artboard; pointer phải chuyển từ viewport sang artboard có xét scale/pan. Text và form có constraints/reflow theo breakpoint; không thu nhỏ toàn bộ trải nghiệm đến mức không đọc được. Đợt đầu mobile là cấu hình chính, desktop có bố cục/khung hiển thị được thử riêng.

Khi sao chép/nhân bản, sinh ID mới cho node và remap toàn bộ binding/action target. Khi xóa scene/element, báo các liên kết bị ảnh hưởng. Các giới hạn bytes, số node, độ sâu, vòng lặp, media duration là giới hạn an toàn có cấu hình và kiểm thử, không tự biến thành phân hạng sáng tạo theo gói.

### 6.4 API và persistence

Đề xuất thêm module `designs` qua dependency injection tại `src/server/app.mjs`; Catalog sở hữu mẫu/review, Gifts sở hữu xuất bản/reply/TTL, Designs sở hữu nháp. Shared schema/validator thuần không đọc repository của module khác. Media có interface nội bộ; ownership và quyền đọc phải đi qua service.

| Endpoint đề xuất | Hành vi |
| --- | --- |
| `GET /api/designs/designs` | Danh sách nháp của tài khoản hiện tại |
| `POST /api/designs/designs` | Tạo riêng từ blank hoặc template version được phép |
| `GET /api/designs/designs/:id` | Chỉ owner đọc; không dùng public gift slug để truy cập draft |
| `POST /api/designs/designs/:id/save` | Nhận `expectedRevision` và document, validate rồi CAS; stale trả 409 |
| `POST /api/designs/designs/:id/duplicate` | Sao chép được cấp quyền, remap ID; không sao chép reply/lịch sử cá nhân |
| `POST /api/designs/designs/:id/assets` | Upload asset theo loại được hỗ trợ; response asset ID; xử lý binary tách khỏi scene JSON |
| `POST /api/designs/designs/:id/preflight` | Kiểm persisted revision, schema, quyền mẫu/element và media; trả lỗi theo node và quyền hiện hành |
| `POST /api/checkout/payments/orders/:orderId/design-contexts` | Tạo context owner/design/revision/order để quay đúng nháp; nhiều context trên một order, không PII trong URL provider |
| `GET /api/checkout/payments/orders/:orderId/design-contexts` | Owner xem danh sách context để chọn đúng design khi quay về từ tab/thiết bị khác |
| `GET /api/checkout/payments/orders/:orderId/design-contexts/:contextId` | Owner đọc context và xác minh lại design/source; không cấp quyền bằng context |
| `POST /api/gifts/gifts/from-design` | Nhận design ID, expectedRevision, expectedDocumentHash và idempotencyKey; server chốt snapshot, kiểm quyền và trả gift/link |
| Endpoint version/submit/approve của Catalog ở pha Creator | Lưu draft riêng, submit một revision xác định, duyệt đúng revision; giữ contract route cũ cho dữ liệu legacy |

Đây là contract đề xuất, chưa tồn tại. Các route đặc thù như `from-design` cần đăng ký trước các route động dễ bắt nhầm. Nếu muốn đổi sang PUT/PATCH phải xử lý đồng bộ method guard, origin/CSRF guard, client, legacy gateway và tests; không thêm method chỉ ở route.

Canvas hỗ trợ có kiểm chứng hai profile: JSON đồng nhất cho pilot một process, và MySQL đồng nhất cho Identity/Catalog/Designs/Gifts/asset metadata; Checkout MySQL khi dùng payment/entitlement SQL. Support có thể độc lập. Tổ hợp mới chưa có bảo đảm publish phải bị từ chối readiness, không tự dual-write hoặc chuyển storage. Các mixed mode legacy vẫn giữ nguyên phạm vi hiện có.

JSON cần critical section, durable publication intent/result và recovery; không có ACID nhiều file. MySQL cần `PublicationUnitOfWork` được inject, dùng cùng transaction connection cho chốt revision, snapshot, gift, asset refs và idempotency. Mỗi module tự có pool hiện nay nên chỉ `await designs.save(); await gifts.insert()` không tạo transaction chung. Không giữ SQL lock trong lúc upload, decode ảnh hoặc gọi provider.

Schema MySQL hiện dùng `JSON`, UUID `CHAR(36) ascii_bin`, template ID `VARCHAR(128) ascii_bin`; không dùng mô hình PostgreSQL/JSONB của kế hoạch cũ. `gifts.template_id` vẫn `NOT NULL` + FK, `templates.status` chưa có draft. Cần migration mới sau migration cuối thực tế để hỗ trợ blank design và các bảng designs/versions/assets/publication requests; không sửa 001–005 đã áp dụng. Blank gift phải có snapshot/design version hợp lệ, không template giả; gift legacy giữ template reference và toàn bộ ID/slug/TTL.

DDL MySQL có thể implicit commit; không coi một script migration gồm nhiều DDL là transaction rollback toàn bộ. Cần preflight schema, backup/restore, thử upgrade dữ liệu legacy và forward recovery. [MySQL 8.4 về implicit commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html). Hợp đồng chi tiết và các điểm quyết định nằm tại [CANVAS_TECHNICAL_CONTRACT.md](CANVAS_TECHNICAL_CONTRACT.md).

### 6.5 Luồng thanh toán gắn với thiết kế

1. Flush save và chờ ACK revision; lỗi lưu thì giữ editor và cho thử lại.
2. Server preflight đọc persisted draft; trả `allowed`, `needs_template_license`, `denied` hoặc `unavailable`. Lịch sử order không thay entitlement check.
3. Đợt đầu chỉ mua quyền mẫu theo contract v1.1. Blank + element cơ bản được cấp quyền không tự tạo order. Chưa tính tiền theo scene, element hoặc số lần phát hành.
4. Nếu cần checkout, server quản lý context owner/design/revision/order; amount hiển thị từ server/intent. Một intent theo user/template có thể liên quan nhiều draft nên context không phải một cột designId bị ghi đè trên order. Intent cũ có thể giữ giá khác giá catalog mới.
5. Giữ endpoint/provider/webhook hiện có. Redirect không cấp quyền; status server và preflight sau quay lại quyết định khả năng publish. Callback có thể đến trước hoặc sau redirect.
6. Quay đúng nháp; nếu đã sửa trong tab khác thì mở revision mới nhất và yêu cầu preview/preflight lại, không âm thầm xuất bản revision khác.
7. Publish là hành động riêng, có key chống trùng riêng. Đã paid nhưng publish thất bại thì retry publish, không thu lại tiền mẫu.
8. Pending/hủy/timeout giữ nháp; không giả lập paid/failed từ URL. Order/receipt cũ không có context vẫn mở được như trước.

Tách hardening payment khỏi công việc canvas: MoMo hiện có tổ hợp `NODE_ENV != production` + `PAYMENT_ENV=production` không bị live flag chặn đồng nhất với payOS. Đây là phát hiện source, chưa gọi provider; mọi QA canvas phải tắt payment hoặc dùng provider inject và chặn network ngoài. Xem [báo cáo v1.1](CANVAS_V11_REVIEW.md).

### 6.6 Asset, quyền và tính tương thích

- Giữ pipeline ảnh hiện có: PNG/JPEG/WebP, 2 MB, giới hạn pixel, bỏ EXIF; xem `src/modules/gifts/photo.mjs:4`. Mở audio/video/SVG động cần pipeline riêng, không nới validator ảnh chung.
- Endpoint media nháp chỉ owner; media published qua quyền của gift và TTL; public template chỉ asset demo được phép. Không trả filesystem path.
- Chốt asset manifest khi xuất bản; sửa/xóa nháp hoặc thay mẫu không làm hỏng quà đã gửi. Cleanup chỉ xóa asset không còn reference và theo lifecycle rõ ràng.
- Server kiểm quyền lại khi save/clone/submit/publish; client ẩn nút không phải bảo vệ. Source template/version và policy là dữ liệu server quản lý: save không được xóa/đổi nguồn để lách khóa/license. Clone/duplicate giữ provenance và các khóa có hiệu lực, remap ID không cấp quyền mới.
- Không nhúng HTML/script/URL tùy ý vào element. Giai đoạn đầu action allowlist; không fetch URL người dùng ở server nếu chưa có thiết kế chống SSRF.
- CSP hiện chặn iframe của app. Preview built-in dùng DOM runtime riêng trong workspace; không mở iframe app rồi tắt `frame-ancestors`/`X-Frame-Options` để chữa lỗi.
- Quà cũ không có `schemaVersion/documentSnapshot` tiếp tục dùng renderer legacy; không tự viết lại dữ liệu. Template legacy có thể được adapter đọc thành preset ba cảnh khi tạo nháp mới.
- Template/list API mới dùng projection metadata; tránh trả toàn bộ document/asset nội bộ qua list catalog hoặc public gift. `publicGift` hiện dùng spread, phải thay projection cho record mới để không lộ owner/policy/draft.
- Import/export hiện còn yêu cầu gift gắn template, chưa hiểu blank/design/assets. Phải nâng format và verifier hoặc fail rõ khi gặp record canvas; không im lặng bỏ snapshot/references. Backup gồm metadata và media; đổi storage flag không phải rollback dữ liệu.

## 7. Các bước triển khai và điểm nghiệm thu

| Bước | Công việc | Điều kiện hoàn thành |
| --- | --- | --- |
| 0. Baseline và contract | Đọc graph/source mới nhất, kiểm WIP, xác định HEAD/upstream, liệt kê compatibility fixtures; chốt schema/capability và spike DOM/CSP | Có quyết định kỹ thuật có bằng chứng; chưa đổi data thật |
| 1. Schema và runtime | Registry element cơ bản, validate, binding, scene renderer, adapter legacy, preview side-effect adapter | Fixture schema hợp lệ dựng được; invalid target/type/HTML bị từ chối; quà cũ giữ hành vi |
| 2. Draft và asset | Module Designs, ownership, revision/CAS, save/load, asset IDs; JSON và MySQL adapter theo profile, migration thiết kế riêng | F5 tải lại đúng; hai tab gây conflict; người khác không đọc draft; MySQL có gate thật riêng |
| 3. Canvas Sender | `/design/new`, `/design/:id`, tích hợp `/create/:templateId` và `/studio`; stage, inspector, layer, undo/redo, scene presets | Người gửi tạo từ trống và cá nhân hóa mẫu trên desktop/mobile; thay đổi tồn tại sau reload |
| 4. Publish và recipient | Preflight entitlement, checkout/resume, snapshot/idempotency/UnitOfWork, runtime `/g/:slug`, link/QR | Không mất draft qua checkout; không tự publish từ redirect; retry không trùng; sửa draft không sửa quà |
| 5. Nghiệm thu đợt đầu | QA toàn luồng, a11y, CSP, hiệu năng, offline/conflict, regression | Đủ các case bên dưới, báo rõ PASS/FAIL/BLOCKED/NOT RUN; đây là mốc giao canvas cơ bản |
| 6. Element nâng cao | Audio/video/album, animation, confetti, reveal/flip; rollout từng nhóm | Mỗi nhóm có validator/runtime/fallback/media policy và tests trước khi mở |
| 7. Creator Studio | Personalization schema, locked/editable vùng, version, review đúng revision, component/variant, timeline | Sender dùng template đúng vùng; pending/rejected không public; approved version không bị sửa ngầm |
| 8. Chia sẻ và chuyên sâu | Template cộng đồng dùng demo, quyền tài nguyên; code sandbox/cộng tác là các dự án nhỏ riêng | Chốt policy liên quan và có kiểm chứng riêng trước khi bật |

Bước 1–5 là một lát cắt hoàn chỉnh cho người gửi, không dừng ở giao diện kéo thả chưa lưu/xuất bản được. Sau mỗi bước: test → sửa → test lại; sau mỗi ba bước có regression tích lũy. Tích hợp với MySQL/payment đã có, không tự cutover DB thật, bật merchant live hay thêm code sandbox. Các gói việc và điểm dừng cụ thể ở [backlog](CANVAS_IMPLEMENTATION_BACKLOG.md).

## 8. Ma trận kiểm thử

| Nhóm | Case cần chứng minh |
| --- | --- |
| Unit domain | Schema/version, round-trip, defaults, invalid types/targets, duplicate/remap IDs, undo/redo, entitlement, immutable snapshot |
| API | Owner-only draft/assets, save 409, revision publish, retry/idempotency, crash recovery theo adapter, role revoke, thiếu quyền mẫu/element |
| Compatibility | 12 seed templates, gift/link/QR cũ, license demo/paid/revoked, receipt cũ, một ảnh legacy, TTL, reply, favorite, login/logout |
| Browser Sender | Blank → text/ảnh/phong bì → kéo/căn/resize → undo/redo → save → reload → preview → publish → copy/QR |
| Browser recipient | Không đăng nhập; mở đúng cảnh; keyboard/touch; reply hoạt động; preview không gửi reply thật; link hết hạn |
| Responsive | 320/375/390/768/1024/1440 px, dọc/ngang; text dài, tiếng Việt, không che CTA; inspector không chiếm hết stage |
| Accessibility | Tab/focus, đọc tên control, chỉnh không cần drag, không đọc lại cả stage khi drag/type, giảm motion, mute/play, ảnh có mô tả |
| Security | XSS/action/URL injection, thay owner/policy từ client, asset IDOR, CSP violations, dữ liệu nháp lọt public payload |
| Resilience | Mất mạng lúc save, request save trả sai thứ tự, conflict hai tab, double-click publish, navigate/Back/Forward/popstate/refresh khi dirty, response cũ sau đổi design, thiếu asset, renderer version lạ |
| Performance | Đo input/drag và thời điểm quà có thể xem trên fixture có số node/media xác định; kiểm listener/timer sau nhiều lần mount/dispose; runtime không nạp editor bundle |
| Creator sau này | Edit → submit revision → review → approve/reject; edit sau submit không đổi bản đang duyệt; clone thiếu quyền element có giải thích |
| MySQL thật cô lập | Upgrade legacy, FK/collation/Unicode, CAS bằng hai connection, publish/revoke/GC races, rollback trước commit và retry sau commit, profile readiness |
| Payment bằng provider giả | Save → checkout → redirect/reload → resume đúng draft; callback sớm/muộn; revoked grant; pending; paid rồi publish lỗi; receipt cũ; không gọi mạng provider |
| Backup/import/export | Count/hash/reference parity, blank gift, assets dùng chung, importer cũ fail rõ, khôi phục được metadata và file |

Chốt budget hiệu năng bằng fixture và thiết bị tham chiếu sau spike; không gọi một ngưỡng chưa đo là đã đạt. Fixture QA dùng data và cổng tạm theo `tests/integration/architecture.mjs`, không dùng `services/*/data` thật. Không dùng skip/xfail để báo pass.

Các lệnh hiện có: `npm run build`, `npm run check`, `npm test`, `npm run test:architecture`, `npm run test:browser`. `npm run test:database` hiện cũng là unit/mock/static, không phải MySQL integration. Browser và API gate phải báo riêng; unit PASS không chứng minh UX hoặc persistence thật. Fixture hiện kế thừa process env nên phải ép năm `*_STORAGE=json` và payment false trong process test riêng khi chạy JSON suite, không sửa `.env` người dùng.

## 9. Những quyết định còn mở

- **Đã chốt trong cuộc trò chuyện:** Sender cá nhân hóa/tự thiết kế cơ bản trước; Creator chuyên sâu sau.
- **Khuyến nghị kỹ thuật cần chứng minh:** DOM/CSS stage, registry/schema chung, runtime riêng, API POST action, JSON profile và MySQL UnitOfWork. Không đổi stack hoặc tự bật DB.
- **Cần chốt trước pha chia sẻ:** phạm vi public/cộng đồng, kiểm duyệt template Sender, quyền remix, việc phân phối asset được mua, chính sách giữ nháp.
- **Cần chốt trước pha premium:** nhóm element và capability cụ thể, gói/giá/license, thời hạn/quota. Các con số trong tài liệu gốc là backlog/đề xuất; không đưa vào code như đã được duyệt.
- **Riêng tư lời đáp:** runtime hiện cho người có link xem reply (`web/js/pages/gifts.js`, `GiftService.replies()`), đặc tả gốc dòng 275 muốn riêng cho người gửi. Canvas đầu giữ contract và cảnh báo UI hiện tại; không copy reply vào mẫu. Chỉ thay chính sách qua hạng mục được xác nhận riêng.
- **Chỉnh quà đã gửi:** đợt đầu sửa nháp hoặc tạo bản sao rồi xuất bản mới; cập nhật cùng slug cần chính sách version/rollback/TTL riêng, không tự làm.
- **Trước production:** MySQL transaction/migration thật, media storage, backup/restore, rate limits, payment hardening/provider E2E và quyền tài nguyên phải được kiểm chứng riêng.

## 10. Kết quả kiểm tra cho lần lập kế hoạch

- Chạy trên bản source `6c44bdb` cô lập ở `local/canvas-replan-20261117/qa`, cài dependency đúng lockfile tại đó; không ghi đè `node_modules` của app đang dùng.
- `npm run build`, `npm run check`: PASS. `npm test`: PASS 88/88, không skipped.
- `npm run test:browser` bằng Edge: PASS browser smoke, API architecture và các smoke/concurrency regression của suite; ép JSON storage và tắt payment trong process test. Chromium mặc định ban đầu thiếu binary; lần chạy Edge đã hoàn tất.
- MySQL thật, provider E2E, migration và canvas: NOT RUN/chưa triển khai. Các unit có tên MySQL/payment dùng mock/static, không nâng chúng thành bằng chứng DB/provider thật.
- Source mới đến từ fast-forward upstream. Các thay đổi tự soạn sau sync chỉ là tài liệu; `.env`, dữ liệu và WIP `.gitignore` được giữ. Chưa commit/push.

Prompt triển khai theo giai đoạn: [CANVAS_IMPLEMENTATION_PROMPT.md](CANVAS_IMPLEMENTATION_PROMPT.md).
