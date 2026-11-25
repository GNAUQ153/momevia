# Chọn cách ghi tên người nhận — bàn giao 24/11/2026

Triển khai trên nhánh `feat/recipient-naming-20261124`, từ `main` tại `85ef36a` (cây mã sạch, không có WIP khi bắt đầu). Không đẩy Git hoặc triển khai ra máy chủ bên ngoài. Bản cục bộ đang chạy tại http://127.0.0.1:4110.

## Kết quả theo chế độ

| Chế độ | Người gửi | Người nhận | Studio |
|---|---|---|---|
| Điền tên trước | Mặc định, nhập một tên; lưu cùng nháp | Vào thẳng thiệp | Giữ luồng phản hồi/số chưa đọc hiện có |
| Tải danh sách | XLSX/CSV UTF-8; cột `Tên người nhận`; xem trước tối đa 8 tên; lỗi có dòng gốc; xác nhận rồi mới xuất bản | Mỗi dòng có link riêng; hai dòng trùng tên có hai mã khác nhau | Dòng gốc, nguồn tên, link/QR từng người, lọc trạng thái và xuất XLSX |
| Người nhận tự điền tên | Một link/QR chung | Xác nhận tên trước nội dung; tải lại giữ lượt; có “Dùng tên khác” | Thấy lượt xác nhận ngay khi chưa có lời nhắn; phản hồi liên kết đúng lượt |

`{người nhận}` là biến duy nhất. Có nút **Chèn tên người nhận**. Canvas, Fabric, xem thử và trang công khai dùng cùng tên minh họa hoặc tên đã xác nhận. Biến khác được giữ nguyên. Thiệp đã phát không có dấu phiên bản cá nhân hóa giữ nguyên dấu ngoặc nhọn và cách vào thiệp.

Với chế độ danh sách/tự điền, vùng tên có sẵn trên bìa hiện “Gửi …”/“To …”. Nếu bìa không có vùng phù hợp, player đặt lời đề tặng trước nội dung, không chèn đè vào hình. Mẫu Creator chỉ bật chế độ động khi được phép sửa `recipientName`; nút chèn câu chữ còn cần quyền sửa lời chúc. Máy chủ kiểm tra lại policy.

## Luồng đã lần theo trong mã hiện tại

- `web/js/app/main.js`: từ mẫu vào `/create/:id` hoặc `/design/:id`, dùng Designer cho cả chỉnh nhanh và bố cục. Nhánh mở thiệp hỗ trợ Canvas và bộ hiển thị cũ.
- `web/js/pages/designer.js` → store/session: lựa chọn tên nằm trong document được lưu, phục hồi, undo/redo và tính hash cùng nội dung. Đổi chế độ không xóa tên thủ công, lời chúc hoặc danh sách đã xác nhận.
- `src/modules/designs/designs.service.mjs`: preflight theo chế độ; quyền mẫu trả phí; context thanh toán gắn revision/hash; xuất bản lại qua cùng khóa thao tác. Khóa xuất bản bao gồm hash document nên phân biệt cả chế độ và nội dung/thứ tự danh sách.
- `src/modules/designs/{json.repository,mysql-publication}.mjs`: một lần xuất bản ghi snapshot, tài sản ghim, cả danh sách và kết quả chống trùng trong một ranh giới ghi nguyên vẹn.
- Trang thành công/Studio → link/QR → `src/modules/gifts/`: xác thực quyền mở, mã lượt, phản hồi và quyền chủ sở hữu. `src/server/app.mjs` áp dụng cùng kiểm tra cho ảnh và âm thanh riêng.
- Thiệp cũ dùng quyền và renderer cũ; endpoint tạo thiệp cũ vẫn dùng được. Tạo danh sách qua endpoint cũ cũng cần khóa thao tác và chống tạo lô trùng.

## Dữ liệu, quyền và khôi phục khi mạng lỗi

- Một `DesignVersion`/snapshot và một bộ tài sản cho cả thiệp; không nhân 100 thiết kế hay tải 100 bộ ảnh. Mỗi receipt có UUID, nguồn, tên, dòng gốc nếu có, thời điểm tạo/xác nhận và mã ngẫu nhiên 256 bit. Không dùng tên/IP làm khóa nhận diện.
- Danh sách/lượt xác nhận nằm trong `gifts.payload.recipients` ở MySQL; JSON giữ chúng trong cùng aggregate xuất bản. Tên không nằm trong URL. API công khai không trả danh sách hoặc token của người khác.
- Link danh sách mang `r`; link chung phát cho người mới không mang `r`. Với link chung, phiên theo thiệp trong `sessionStorage` giữ token và tên trước khi POST. Token được giữ để thử lại khi mất ACK; cùng token/khác tên trả 409. “Dùng tên khác” thông báo giữ lại lượt cũ trước khi bắt đầu lượt mới.
- GET, xem thử và bot đọc link không tạo lượt. Chỉ POST xác nhận chủ động tạo lượt. Nút mở khóa trong khi đang gửi; lỗi giữ giá trị để thử lại. Player chỉ khởi chạy sau khi xác nhận thành công.
- Phản hồi mới có `recipient_id` và `card_name`, độc lập với chữ ký `name`. Đọc phản hồi công khai luôn lọc trong đúng lượt, sau khi kiểm tra quyền đọc riêng. Chủ thiệp vẫn đọc toàn bộ hộp thư; lọc danh sách không đánh dấu đã đọc.
- MySQL khóa hàng thiệp khi xác nhận/thu hồi/phản hồi; JSON dùng ghi thay thế nguyên tử, và Canvas có hàng đợi trong một tiến trình. JSON là profile một tiến trình, không dùng chung tệp giữa nhiều máy chủ.
- Nội dung, ảnh, âm thanh riêng, phản hồi kiểm tra trạng thái hết hạn/thu hồi và quyền ở máy chủ. Bảng XLSX/CSV chỉ chủ sở hữu truy cập; chủ có thể xem lịch sử kể cả sau thu hồi.

Migration `016_recipient_naming.sql` thêm hai cột nullable và index `(gift_id, recipient_id)` vào `gift_replies`. Không sửa dữ liệu thiệp cũ. JSON đọc được aggregate cũ mà không cần chuyển đổi.

## Nhập và xuất

- File tối đa 1 MiB, tối đa 1.000 người/file; tên 1–60 ký tự, có dấu/câu, không chứa xuống dòng/ký tự điều khiển. Tối đa 1.000 lượt tự khai/thiệp.
- Bộ đọc Excel chỉ tải khi chọn file XLSX. Kiểm tra ZIP trước giải nén: tối đa 8 MiB nội dung khai báo và 200 mục. CSV được giải mã UTF-8 nghiêm ngặt. Lỗi cuối file chặn xác nhận; không tạo lô một phần.
- Chỉ gửi `row`/`name` của danh sách vào document; không gửi workbook hoặc cột ngoài yêu cầu. Máy chủ kiểm tra lại. Document vẫn chịu giới hạn 256 KiB; endpoint lưu nháp 600.000 byte, xuất bản 4.096 byte, xác nhận tên 2.048 byte.
- Mẫu nhập: [recipient-template.csv](../web/assets/recipient-template.csv).
- Xuất chính là XLSX với ô kiểu chữ: giữ nguyên `=`, `+`, `-`, `@`, tiếng Việt, dấu câu, thứ tự, mã lượt và toàn bộ link/mã mời. API CSV UTF-8 dự phòng thêm dấu nháy đầu tên giống công thức để Excel không thực thi chúng.
- Đã mở bản xuất 100 người bằng Microsoft Excel: đủ 101 dòng gồm tiêu đề, 100 URL khác nhau, giữ hai tên trùng; ô `=SUM(1,2)` có `HasFormula=false`. Bài kiểm riêng giữ nguyên URL hơn 4.500 ký tự qua XLSX/CSV.

## Kiểm thử và bằng chứng

- Build đạt; kiểm tra mã, CSS và 3.076 khóa VI/EN đạt; **757/757 unit tests** đạt.
- `test:recipients`: 9 nhóm API + trình duyệt trên JSON đạt. `test:recipients:mysql`: cùng 9 nhóm trên MySQL thật đạt.
- Đối chiếu tự động **100/100 link với đúng tên**, hai dòng trùng tên riêng biệt; nhấn đồng thời xuất bản không tạo lô trùng; đổi payload với cùng khóa bị từ chối.
- XLSX/CSV lỗi dòng 101 bị chặn; bảng xuất chỉ chủ tài khoản đọc; tên giống HTML hiện như chữ, không tạo thẻ/đọc ảnh bên ngoài.
- Hai phiên Lan/Minh; nhiều lượt cùng tên; 5 lần thử lại cùng token; mất ACK sau khi máy chủ ghi; tải lại; dùng chung thiết bị; phản hồi bằng trình duyệt và API gắn đúng người, chữ ký riêng; số chưa đọc trước/sau đọc đúng.
- Link riêng/chung qua QR đã giải mã và mở lại. Kiểm tra invite, quyền gửi tắt, quyền đọc chỉ chủ, sai tài khoản, ảnh/âm thanh thiếu mã lượt và sau thu hồi; hết hạn chặn mở/xác nhận.
- Quay lại từ giao dịch mô phỏng giữ chế độ, danh sách, revision/hash; mua quyền mẫu mô phỏng xong xuất bản được. Không thu tiền thật.
- Tên dài trên 320/390 px không bị cắt hoặc tràn ngang, nút xác nhận nằm trong màn hình. Enter, giảm chuyển động, VI/EN đã chạy trong Edge.
- Bộ hồi quy `test:canvas:browser` đạt: 172 thẻ thư viện, 243 element, 33 hiệu ứng, tương tác công khai, Creator, chế độ nhanh/bố cục, thanh toán mô phỏng, viewport 320–1440 px và các luồng cũ.

Môi trường: Windows, Node 24.14.0, Playwright với Microsoft Edge 158.0.4370.33, JSON một tiến trình và MySQL cục bộ thật. Chưa kiểm thử thiết bị vật lý, Safari/iOS, trình đọc màn hình hoặc thanh toán nhà cung cấp thật. Các fixture trình duyệt dùng tài khoản và tên tổng hợp, tách khỏi dữ liệu đang dùng.

Ảnh giao diện:

- Chọn danh sách ở Designer
- Trang chia sẻ 100 link
- Ô tên trước khi mở thiệp
- Lan / Minh
- Tên dài 320 px / 390 px
- Kết quả trong Studio

## Đo trước/sau

Đo tuần tự, mỗi lượt tạo context trình duyệt mới, cùng preset `envelope-basic`, dữ liệu người gửi/tên/lời chúc, viewport 390×844, CPU chậm 4 lần, RTT 80 ms, tải xuống 200.000 byte/s, tải lên 93.750 byte/s, giảm chuyển động. Baseline là mã `85ef36a`; mỗi số trang là trung vị 5 lần. Đồng hồ đo từ điều hướng đến phần tử dùng được/hiển thị, hoặc từ bấm Mở thiệp đến tên thật hiện trên bìa.

| Chỉ số | Trước | Sau |
|---|---:|---:|
| Luồng thủ công: đến tên trên bìa | 3002 ms | 3017 ms (+0.5%) |
| Link chung: đến ô tên dùng được | Chưa có | 1863 ms |
| Bấm Mở thiệp → tên thật trên bìa | Chưa có | 1436 ms |
| Đọc + xem trước 100 tên XLSX | Chưa có | 54 ms |
| Đọc + xem trước 100 tên CSV | Chưa có | 57 ms |

Thời gian file là một lượt trên trang người gửi desktop 1440×1000, không mô phỏng chậm mạng/CPU; không so trực tiếp với số mobile. Đây là số đo cục bộ, không phải cam kết thời gian trên thiết bị thật. Dữ liệu thô: trước, sau, lượt chức năng MySQL/file.


## Trạng thái dữ liệu cục bộ

- Đã sao lưu riêng `gifts`, `gift_replies`, DDL và lịch sử migration trước thay đổi. Đường dẫn được ghi trong `local/recipient-backup-path.txt`; backup nằm dưới `database/private/`, không commit.
- `momevia_dev`: migration 015 → 016; vẫn 0 thiệp/0 phản hồi.
- Profile đang chạy `momevia_demo_4110`: bổ sung các migration tương thích còn thiếu 014, 015 rồi 016; vẫn **7 thiệp/2 phản hồi**. Không dùng dữ liệu thật để tạo 100 lượt QA.
- Bản chạy 4110 đã kiểm tra health MySQL, đọc lại một thiệp cũ HTTP 200 không có ô tên, endpoint bảng yêu cầu đăng nhập HTTP 401, bộ đọc Excel HTTP 200.

## Bật dần và quay lui

1. Sao lưu, chạy `npm run db:migrate` trước khi khởi chạy mã mới trên mỗi schema MySQL. JSON không cần migration SQL. Chạy `npm run build` để có bộ đọc Excel và các gói trình duyệt.
2. Có thể đặt `RECIPIENT_NAMING_ENABLED=false` để chặn xuất bản mới ở chế độ danh sách/tự điền. Luồng thủ công và link đã phát vẫn đọc được; người mới vẫn có thể xác nhận tên qua link chung đã phát.
3. Bật `RECIPIENT_NAMING_ENABLED=true`; đặt `RECIPIENT_NAMING_OWNER_IDS=<UUID chủ thử nghiệm>` để chỉ nhóm chủ thiệp đó cấp link mới. Xóa danh sách giới hạn khi mở rộng. Người nhận của các link đã cấp không cần thuộc nhóm này.
4. Nếu cần dừng riêng lượt tự khai mới: `RECIPIENT_CONFIRMATIONS_ENABLED=false`. Các lượt đã ghi vẫn đọc/thử lại được. Chỉ dùng nút này khi chủ động muốn ngừng nhận người mới qua link chung.
5. Khi quay lui, giữ reader mới và migration 016 để đọc những link cá nhân đã phát. Tắt writer bằng các cờ trên; không xóa cột hoặc thay JSON bằng backup cũ vì sẽ làm mất lượt xác nhận/phản hồi mới.

Lệnh lặp kiểm tra: `npm run test:recipients`, `npm run test:recipients:mysql` (MySQL local; tạo rồi xóa schema QA riêng), `npm run perf:recipients:before` rồi `npm run perf:recipients:after` theo thứ tự, không chạy cùng tác vụ nặng khác. Trên máy có biến tài khoản demo, đặt `TEST_ACCOUNT_ENABLED=false` trong tiến trình chạy `npm test`.
