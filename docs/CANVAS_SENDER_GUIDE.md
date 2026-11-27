# Thiết kế và gửi quà trên web

Canvas hỗ trợ lưu MySQL, gồm toàn bộ nội dung/bố cục element và cấu hình effect, animation, chuyển cảnh, tốc độ, độ trễ, mật độ, lặp. Quà đã xuất bản giữ snapshot riêng. Ảnh được lưu thành tệp bất biến, DB giữ metadata và các tham chiếu; sao lưu cần cả DB và thư mục ảnh. Triển khai MySQL cần migration 013 (bao gồm định dạng chính xác ở 012) và chuyển dữ liệu bằng importer canvas; xem [hướng dẫn demo](DEMO_WEB.md#hồ-sơ-đã-chuyển-mysql).

## Sender

### Thư viện trên MySQL

Admin mở **Thư viện canvas** từ trang Admin hoặc menu tài khoản, tại `/admin/library`. Có bốn nhóm Element, Hiệu ứng, Chuyển động và Bố cục; nhóm Bố cục bao gồm các bố cục khởi đầu và mẫu thiệp hiện có.

1. Tìm theo tên/mã và lọc mục đang bật hoặc đã tắt. Chọn mục để sửa, bấm **Thêm mục** để tạo mới, hoặc **Nhân bản** để bắt đầu từ một mục sẵn có.
2. Nhập tên VI/EN. Element có thể ghép nhiều thành phần; chuyển động có bảng các mốc, bề mặt hoặc hạt; hiệu ứng chọn chuyển động và đối tượng áp dụng; bố cục chỉnh từng cảnh và từng ngôn ngữ.
3. Bản xem thử tự cập nhật khi dừng nhập. **Phát thử** chạy lại chuyển động; dữ liệu minh họa và ảnh xem thử không được ghi vào mục đang sửa.
4. Bấm **Lưu thay đổi** (hoặc Ctrl/Cmd+S). **Tắt mục**/**Bật mục** lưu cả trạng thái và các thay đổi trên biểu mẫu. Nếu có mục khác phụ thuộc, thao tác bị chặn và liệt kê các mục liên quan.
5. Khi có người khác sửa cùng mục, giao diện giữ bản đang nhập; có thể tải bản mới hoặc nhân bản thay đổi. Lỗi kết nối giữ nguyên biểu mẫu để thử lưu lại. Nếu DB đã ghi nhưng trình duyệt mất phản hồi, lần thử lại đối chiếu bản đã lưu và không tạo thêm phiên bản. Tải lại designer để thấy các mục mới.

Xem trước là thao tác chỉ đọc. Việc sửa/tắt mục thư viện không thay đổi các thiệp và quà đã lưu cấu hình riêng. Chỉ Admin được mở màn hình và gọi API quản lý/xem thử; các vai trò khác vẫn có thể dùng danh mục công khai trong designer.

Có thể xem thử mục đã tắt và chuyển động liên quan mà không bật chúng trong thư viện. Muốn bật hoặc lưu thật vẫn phải bật các phụ thuộc theo đúng thứ tự. Các cảnh VI/EN được chỉnh riêng; chuyển ngôn ngữ sẽ chọn một cảnh/lớp hợp lệ của ngôn ngữ đó.

Kiểm tra chuyên sâu: thêm `CANVAS_ADMIN_DEEP_AUDIT=true` khi chạy `npm run test:canvas:storage` với cấu hình schema QA riêng. Bộ thử này tạo/sửa/tắt bằng giao diện, đưa mục vào canvas, kiểm tra ảnh hưởng của các phiên bản thư viện, lỗi mất phản hồi sau commit và các kiểu chuyển động khác nhau. Có thể kết hợp `CANVAS_LIBRARY_EXPANDED_BROWSER=true` để chạy thêm toàn bộ hồi quy canvas.

Migration 013 thêm `canvas_library_items` và `canvas_library_history`. Canvas tải thư viện qua `GET /api/designs/library`, có thể thêm mục mới bằng DB/API rồi tải lại editor. Ảnh bìa mẫu cũng được dựng lại từ tài liệu DB, có VI/EN. Không cần đăng ký thêm ID trong danh sách frontend. Cấu hình đã chèn được giữ trong tài liệu nên thay đổi thư viện chỉ tác động các lần chèn/tạo mới.

| kind | Nội dung quản lý |
| --- | --- |
| `element` | Tên VI/EN, nhóm, từ khóa và danh sách layer của một element/cụm tái sử dụng |
| `element_type` | Thông số mặc định của 10 primitive đã có bộ dựng hình |
| `artwork` | Đường nét SVG dạng dữ liệu cho sticker/hình/nét/mặt nạ |
| `animation` | Engine `builtin`, `keyframes`, `surface` hoặc `particles` và các thông số |
| `effect` | Nhóm hiệu ứng, mục animation dùng, loại element/cảnh áp dụng và mặc định |
| `preset` | Bố cục khởi đầu VI/EN, xuất hiện ở trang Tự thiết kế |
| `template` | Tài liệu VI/EN của mẫu theo ID trong Catalog; giá/quyền vẫn do Catalog quản lý |

Xuất thư viện hiện tại: `npm run db:canvas-library -- --export <file-mới.json>`. Sửa hoặc tạo một mục bằng `npm run db:canvas-library -- --put <mục.json>`. File mục gồm `kind`, `id`, `expectedRevision` (0 khi tạo mới), `status` (`active`/`disabled`), `sortOrder` và `definition`. Thông tin kết nối lấy từ `.env`/môi trường của DB cần quản lý. CLI kiểm tra toàn bộ quan hệ trước khi ghi; không tự ghi đè revision mới hơn.

Admin đang đăng nhập có thể dùng `GET /api/designs/admin/library` và `POST /api/designs/admin/library/:kind/:id` với cùng nội dung (không cần `kind`/`id` trong body). API lưu phiên bản cũ trong history; tài khoản khác bị từ chối. Giao diện `/admin/library` dùng các API này và `POST /api/designs/admin/library/preview/:kind/:id` để xem thử chưa lưu.

Cũng có thể dùng SQL để thêm/sửa `definition` (JSON), tăng `revision`, đặt `status` và `sort_order` trong `canvas_library_items`. Sau đó tải `GET /api/designs/library` để kiểm tra toàn bộ cấu hình. Nên dùng CLI/API để có kiểm tra và lịch sử; cập nhật SQL trực tiếp không tự ghi lịch sử API. Tắt mục bằng `status='disabled'`. Muốn tắt animation đang được dùng, tắt các effect phụ thuộc trước.

Ví dụ file tạo một animation mới (sau đó tạo một mục `effect` có `family='entrance'`, `animationId='my-gentle-rise'`, `targets.types=['text','image']` để đưa vào bộ chọn):

```json
{
  "kind": "animation", "id": "my-gentle-rise", "expectedRevision": 0,
  "definition": {
    "engine": "keyframes", "duration": 700, "easing": "ease-out",
    "keyframes": [
      { "opacity": 0, "transform": "translateY(24px) scale(0.96)" },
      { "opacity": 1, "transform": "translateY(0px) scale(1)" }
    ]
  }
}
```

Các thành phần mới có thể ghép từ primitive hiện có và các chuyển động khai báo được kiểm tra. Loại tương tác/bộ dựng hình hoàn toàn mới cần thêm bộ xử lý trong ứng dụng. Dữ liệu DB không thực thi JavaScript, HTML hay CSS tùy ý. Keyframe tối đa 16 mốc, thời lượng 100–10.000 ms, tối đa 5 lượt mỗi lần chạy; hạt có tối đa 24 phần tử và dừng khi rời cảnh hoặc bật giảm chuyển động.

### Thao tác gửi

1. Chọn **Dùng mẫu** để điền các trường mẫu hỗ trợ. Chọn **Chỉnh bố cục** để mở editor. Studio nhớ chế độ gần nhất theo tài khoản và nháp. **Tự thiết kế** hiển thị hình của ba bố cục khởi đầu gồm Trang trống, Phong bì và lời chúc, Hộp quà sinh nhật.
2. Điền tên hai bên và lời chúc. Mẫu có khung ảnh cho thay PNG/JPEG/WebP tới 2 MiB. Vùng khóa lấy từ phiên bản đã duyệt.
3. Bấm **Lưu nháp** hoặc chờ **Đã lưu · rN**. **Xem như người nhận** mở player xem thử với hồi đáp mô phỏng.
4. Bấm **Gửi** và chọn riêng quyền mở, gửi hồi đáp và đọc hồi đáp. Có thể tắt hồi đáp. Nếu mẫu có giá, app giữ nháp qua checkout và Sender chọn xuất bản khi quay lại. Thiệp trống cần chèn lời chúc hoặc ảnh vào một cảnh trước khi gửi.
5. Sao chép link, chia sẻ qua thiết bị nếu có hoặc tải QR. Nếu clipboard bị từ chối, sao chép thủ công từ ô được chọn. URL chia sẻ lấy từ `PUBLIC_BASE_URL`.
6. Studio hiển thị thời hạn, trạng thái quà và bộ lọc **Chưa đọc** trong hộp thư. **Tặng người khác từ bố cục này** tạo nháp sạch, dùng đúng phiên bản nguồn khi còn quyền. **Lưu trữ bản nháp** cất nháp. **Ngừng chia sẻ món quà** thu hồi quyền mở link, ảnh và hồi đáp công khai.

Link mời cấp quyền cho người giữ link. Người nhận hồi đáp theo quyền đã chọn khi gửi. Quà legacy giữ quyền ban đầu đến khi hết hạn hoặc bị thu hồi. Quà đã gửi giữ bản chụp và ảnh từ thời điểm xuất bản.

### Tớ đoán cậu sẽ chọn…

Trong thư viện, tìm **Tớ đoán** và chọn mẫu sinh nhật miễn phí của Momevia Originals. **Dùng mẫu** mở nháp trống có câu hỏi, hai lựa chọn, một dự đoán A/B, lý do và lời kết riêng cho từng lựa chọn. Có thể lưu khi đang viết dở. Khi gửi, điền đủ nội dung và giữ hai lựa chọn khác nhau. Đổi nhãn lựa chọn không đổi mã dự đoán. Người nhận chọn rồi mới thấy dự đoán; lời kết theo điều người nhận chọn. **Chơi lại** hoặc tải lại giữ nguyên dự đoán đã gửi. [Demo sinh nhật và kịch bản quay](TO_DOAN_CAU_SE_CHON_BAN_DAU.md).

### Chỉnh bố cục

- Vào **Thêm** để chọn trong 100 thẻ. Chọn **Tất cả** hoặc một trong bảy nhóm, rồi tìm bằng từ có dấu hoặc không dấu. Ví dụ, “con dau” tìm được Con dấu sáp và “anh ghep” tìm được Ảnh ghép một lớn hai nhỏ. Hình thu nhỏ hiển thị các lớp sẽ được chèn. [Danh mục 100 thẻ](CANVAS_100_ELEMENTS_PLAN.md#2-danh-mục-đích)
- Khối có nhiều lớp được nhóm ngay khi thêm vào thiệp. Kéo từ bất kỳ thành phần nào để di chuyển cả khối. Tay nắm ở góc đổi kích thước cả nhóm theo tỷ lệ. Chọn trực tiếp từng ảnh hoặc dòng chữ để sửa nội dung. Với các lớp rời đã chèn trước đây, giữ Shift khi chọn từng lớp trên thiệp hoặc trong bảng **Lớp**, rồi bấm **Nhóm các lớp đã chọn**. Fabric Studio giữ cố định vị trí từng thành phần khi sửa nội dung. Để di chuyển hoặc xoay cả nhóm, dùng canvas chính.
- Chọn một lớp trên thiệp hoặc từ **Lớp**. Với chữ, dùng **Sửa trên thiệp**, nhấp đúp vào chữ, hoặc nhấn Enter khi vùng thiệp có focus. Ctrl+Enter xác nhận, Escape hủy. Chữ liên kết dùng chung tên hoặc lời chúc trong các cảnh. Bảng **Chỉnh** có mẫu font, cỡ, màu, căn chữ, giãn dòng và độ mờ. Tọa độ, rộng, cao, xoay và căn vị trí phần tử nằm trong **Vị trí và kích thước**.
- Với ảnh, chọn **Thay ảnh**, **Lấp khung** hoặc **Vừa ảnh**, rồi kéo điểm lấy nét hoặc nhập phần trăm ngang và dọc. **Đặt lại crop** đưa điểm nét về giữa. Mô tả ảnh tối đa 240 ký tự. Chọn **Ảnh trang trí** nếu ảnh không cần đọc mô tả. Chọn từng lớp ảnh trong dải phim, bưu thiếp hay ảnh ghép để sửa riêng. Album vuốt cần ít nhất một ảnh và thanh so sánh cần đủ hai ảnh. Mỗi ô có mô tả và chú thích riêng.
- Với **Hai cửa chọn câu chuyện**, đặt một cảnh đích riêng cho mỗi cửa. Với **Đồng hồ đếm ngược**, chọn múi giờ và nhập ngày giờ theo múi giờ đó. Quà hiện lời chúc khi đến giờ. Nút **Mở ngay** trên vé cào và **Trước/Sau** trong album cũng dùng được bằng bàn phím.
- Chọn một lớp để mở **Kiểu bề mặt**, **Khi xuất hiện**, **Nhấn mạnh** và **Khi kích hoạt** theo loại lớp. Chọn cảnh để chỉnh **Khi vào cảnh** và **Không khí**. **Xem thử** phát hiệu ứng đang chỉnh. Chọn **Tắt** hoặc **Bỏ hiệu ứng** để bỏ thiết lập. Người nhận có thể tắt chuyển động cho phiên xem.
- **Cảnh** có hình thu nhỏ và menu để nhân bản, đổi thứ tự, đặt cảnh mở đầu hoặc xóa. Nút chuyển cảnh cần chọn **Cảnh đích** theo tên và hình thu nhỏ. Đổi thứ tự lớp thay đổi lớp nào nằm trước trên thiệp. Trình tự đọc và Tab theo thứ tự nội dung.
- Trên điện thoại, dùng **Thêm**, **Lớp**, **Chỉnh** và **Cảnh** ở thanh dưới. Nút đóng hoặc Escape trả focus về nút mở bảng. Mỗi lần chèn cụm, kéo phần tử hoặc kéo điểm nét là một bước hoàn tác.

## Creator và Admin

Creator vào **Mẫu của tôi** để tạo, mở, nhân bản và xem thử nháp. Khi gửi duyệt, chọn vùng chữ, khung ảnh, cảnh dùng làm bìa và ghi nguồn/quyền phân phối ảnh demo. Với lớp tên đang hiển thị, mở trường tên để Sender nhập hoặc đổi lớp đó thành chữ cố định trung tính. Lần gửi tiếp theo nạp cấu hình gần nhất, yêu cầu xác nhận nguồn ảnh mới và hiển thị thay đổi cho Creator lẫn Admin.

Ảnh đại diện, chi tiết, preview và nút dùng mẫu trỏ cùng phiên bản đã duyệt. Rút mẫu hoặc mất vai trò Creator dừng lượt dùng mới. Nháp Sender đã bắt đầu giữ quyền theo nguồn, và quà đã gửi giữ snapshot. [Thử các trạng thái bằng web demo](DEMO_WEB.md)

## Khi lưu bị gián đoạn

| Hiện tượng | Cách xử lý |
| --- | --- |
| Đang lưu | Chờ ACK khi chuẩn bị checkout hoặc xuất bản |
| Mất mạng | Mở lại bằng đúng tài khoản và chọn khôi phục bản cục bộ rồi thử lưu lại |
| Xung đột revision | Xem bản server trước khi chọn dùng bản server hay giữ bản chỉnh cục bộ |
| Ảnh lỗi | Dùng ảnh trước hoặc chọn tệp hợp lệ để thay |
| Checkout đang xác nhận | Kiểm trạng thái/biên nhận ở trang kết quả rồi quay lại đúng nháp |

[Cờ canvas, sao lưu và cập nhật ứng dụng](OPERATIONS.md)
