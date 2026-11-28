# Giấy có cạnh, nắp có bản lề và cuộn giấy — 28/11/2026

Tiếp từ `2c1a57a` trên nhánh review hiện tại, trong clone cô lập. Repo gốc `3856921` với 179 WIP được giữ nguyên. QA trước ở 56805 giữ source/data riêng. Đợt này chỉ đổi cấu trúc hai thành phần Canvas; bốn mẫu còn lại giữ thiết kế và được kiểm hồi quy. Không merge/deploy, không DB đang phục vụ; media và dữ liệu QA chỉ ở local.

## Khoanh vùng và quyết định

| Mẫu / cảnh | Vấn đề | Thay đổi | Điểm dùng chung / hồi quy |
|---|---|---|---|
| Midnight Soirée / bìa | Relief trước làm sáng/tối nhưng nắp vẫn nằm trong hoạt cảnh 2D | `paperConstruction: physical-v2`: thân có mặt cắt phải/đáy, các lớp giấy, túi trước; nắp có mặt ngoài/mặt trong/cạnh, `rotateX` quanh nếp gấp. Thư là lớp nằm giữa lưng và túi, không lộ lúc đóng | Shared geometry/cover, Source-envelope dispatch theo enum. Sáp được tách thành helper giữ cùng owned asset/tint. Không có enum tiếp tục dùng Silviya/relief cũ |
| Last Chapter / bằng | Hai núm của Noto giống chốt gỗ; giấy mở giống mảng ghép | Trụ giấy 16 mặt quanh trục ngang, đầu có vòng giấy, cuộn dưới lăn khi giấy trải. Mép trên nhỏ 10 px; cuộn dưới 34 px thu về khoảng 23 px. Nơ Noto tái dùng, chữ thật trên giấy | Chỉ Studio diploma chọn physical-v2. Giữ Noto/relief cũ, mũ/camera, pager và form/API |
| Canvas/contract | Cần chọn, chỉnh và tắt được trước khi ghép mẫu | Bộ chọn `Cấu trúc giấy`: Giấy gấp 3D / Minh họa nguồn; độ dày/ánh sáng và depth 0–16, nhịp có sẵn. Default mới 10 khi tạo/chọn kiểu; không tự sửa tài liệu cũ | Enum allowlist, đúng kind, cùng schema/serialization/asset pipeline. Template writer chỉ sáu ID hiện có; thay đổi thực ở hai mẫu |

Đây là cấu trúc vector/DOM với CSS 3D, không phải đổi ảnh tĩnh hoặc chỉ thêm bóng. Không dùng WebGL/dependency/CDN mới. Phong bì dựng native theo nếp gấp; bằng dùng các mặt trụ và đầu cuộn giấy. Nơ giữ nguồn Noto/Apache-2.0 đã có, dấu sáp dùng tài nguyên Momevia có sẵn. Giữ nguồn Silviya và giấy phép cho reader minh họa cũ.

## Canvas trước mẫu

Gate trống đã dùng UI để tìm/chèn hai card, chọn physical-v2, sửa chữ/màu/nhịp/depth, tắt vật liệu, đặt 0, preview; nhân bản, lưu, mở lại, preview và quà local. Chỉ sau gate mới đổi default trong `studioObject`. Các bản sao giữ enum/depth, mỗi part có ID fragment riêng. Source không có ảnh/JS/URL bên ngoài, vẫn theo budget hiện hành.

`paperConstruction` vắng mặt hoặc `illustrated-v1` giữ cấu trúc đã lưu. `paperRelief` và `objectDepth` điều khiển độ dày/ánh sáng của cấu trúc mới; 0/tắt không chặn thao tác mở. Tắt chuyển động dùng điều khiển hiện hành hoặc reduced motion và hiện ngay nội dung. Schema từ chối giá trị enum khác và field ở interaction không hỗ trợ. Không thay scene/library ID, giá, source/license, quyền hoặc asset graph.

## Hình học và nhịp

Phong bì dùng cùng tọa độ cho cover và runtime. Mặt cắt thay theo depth; mặt ngoài và mặt trong có backface riêng. Khi mở, nắp xoay từ 0 đến −178° quanh mép trên, đổi thứ tự lớp gần lúc đi qua cạnh, rồi thư trượt từ sau túi lên. Dấu sáp rời trong 0–16%, nắp lật 16–60%, thư lên 56–88%, cuối nhịp giữ tư thế đọc. Không nghiêng toàn bộ nút hoặc chữ để giả nắp mở.

Bằng giữ stage 190 px. Nơ rời trước 28%, cuộn và giấy mở 24–84%, cuộn dưới xoay khoảng 285°; đoạn cuối ổn định. Giấy/mép cong có vùng đọc riêng, không còn hai chốt gỗ. Tua mũ/camera không đổi. Chữ dài dùng pager hiện có, riêng giấy mới 48 ký tự/phần để cả chuỗi không có khoảng trắng vẫn nằm trong mặt giấy, không bỏ nội dung hoặc giảm chữ quá nhỏ.

Chuyển động theo `motionSpeed` và reaction speed hiện hành. Không có loop mới, không tự phát âm thanh. Header motion-off/reduced mở ngay; off giữa chừng kết thúc trạng thái đọc. Replay/reset khôi phục đúng lớp. Abort bỏ timer, hủy animation của phần đóng/mở, không có callback mở muộn. Thư ở phong bì mới còn có trạng thái `aria-expanded` và lời thư qua status khi mở tại chỗ; đây không phải kiểm screen reader thực tế.

## Kiểm thử và bằng chứng

- `tests/unit/physical-paper.test.mjs`: serialize/duplicate/enum, unsupported kind, depth/0, SVG parse độc lập 0/10/16, unique fragment ID và không markup/remote image/script ngoài.
- `tests/browser/physical-paper.mjs`, được gọi từ Canvas browser: ma trận xoay 3D thật ở giữa nhịp và góc mở cuối, hai mặt backface, 32 mặt trụ/4 đầu, nút không dịch, replay/reset, document không mutation, off/abort/reduced/0; đọc dài gồm từ rất rộng vẫn đầy đủ trong giấy. Ba viewport 320×568, 390×844, 1440×900.
- Giữ hai bộ kiểm minh họa/relief cũ bằng lựa chọn `illustrated-v1` rõ ràng, không đổi chúng thành kiểm kiểu mới và bỏ reader cũ. Nguồn hộp Goodeisgn v6 giữ nguyên.
- QA tạo mới sáu thiệp, kiểm 54 cảnh VI/EN, lưu/mở lại/gửi, hai người trùng tên, RSVP/reply thật, mất phản hồi/gửi lại và chủ thiệp tải lại. Snapshot và SVG bìa sáu quà trước được so chính xác với source QA 2c1a57a.
- Build/check/unit/templates/Canvas browser và MySQL QA cô lập: thư viện mới/có Admin sửa, CAS/conflict/retry/rollback, snapshot quà đã gửi. Kết quả thực, ảnh giữa nhịp và video nằm tại `local/folded-paper-20261128/REPORT.html`; không dùng kết quả lượt trước để báo pass mã mới.

Vùng đọc vẫn sáng, chữ mực giữ palette hiện hành; không tuyên bố mọi màu tùy chỉnh đều đạt contrast. Kiểm geometry/fit và vùng bấm thực; không cắt phần tràn để che lỗi. Chưa kiểm Safari, thiết bị vật lý, screen reader, native browser zoom hoặc FPS trên điện thoại thật.

## Hoàn nguyên

Trước phát hành có thể revert commit này và dùng QA 56805. Nếu đã có snapshot physical-v2 ở môi trường khác, hoàn nguyên writer/thư viện bằng CAS nhưng giữ schema/reader/geometry/CSS của enum này và asset đã pin. Không xóa nháp/quà/media. Repo gốc có WIP riêng và chưa được tích hợp vào nhánh review này.
