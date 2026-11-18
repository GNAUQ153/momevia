# Thí điểm sinh nhật Momevia

## Kịch bản nghiệm thu

Dùng một mẫu sinh nhật miễn phí do Creator tạo, có ba vùng chữ và một ảnh demo được phép phân phối. Dùng tài khoản riêng cho từng vai trò và ảnh tổng hợp trong QA. Khi thí điểm với người thật, ghi kết quả theo sự đồng ý và chính sách lưu đã duyệt.

| Vai trò | Thao tác | Kết quả cần ghi nhận |
| --- | --- | --- |
| Creator | Tạo mẫu, thêm ảnh demo có nguồn, chọn vùng Sender được sửa, gửi V1. Sau khi có phản hồi từ người nhận, sửa nháp và gửi V2 | Nháp V2 sửa được khi V1 đang chờ. Lý do yêu cầu sửa V2 xuất hiện trong Mẫu của tôi |
| Admin | Mở V1 trong hàng đợi, thử tên, lời chúc và ảnh khác ngay trong bản xem thử. Xác minh nguồn ảnh và quyền phân phối, duyệt V1. Mở V2 và yêu cầu sửa | Trang duyệt mở đúng V1 hoặc V2 và lưu đúng quyết định theo phiên bản. Danh mục tiếp tục dùng V1 nếu V2 cần sửa |
| Sender | Trên điện thoại, chọn mẫu, điền ba trường, thay ảnh, mở Chỉnh bố cục và quay lại. Tải lại khi gặp mạng chậm hoặc quay lại sau checkout. Xem như người nhận, chọn quyền mở, gửi và đọc hồi đáp, rồi chia sẻ link và tải QR | Cùng ID nháp, đúng ảnh và chữ, quyền được chọn rõ trước khi xuất bản. QR mở đúng link. Từ Studio đọc được hồi đáp và có thể ngừng chia sẻ |
| Người nhận | Mở từ ứng dụng nhắn tin, mở lại bằng camera quét QR, đi qua các cảnh và gửi hồi đáp từ link mời. Thử đường link thường khi quyền được giới hạn. Mở lại sau khi Creator gửi V2 rồi sau khi Sender thu hồi | Mở và hồi đáp theo quyền mà không cần tài khoản. Sau V2 vẫn thấy ảnh/lời chúc V1. Sau thu hồi nhận thông báo rõ, URL ảnh và API hồi đáp trả trạng thái đã ngừng |

Chạy lần lượt trên Safari iOS, Chrome Android và trình duyệt trong từng ứng dụng nhắn tin tham gia. Quay lại nháp bằng lịch sử và tải lại toàn trang. Làm một lượt mạng Wi-Fi, một lượt mạng di động yếu và một lượt mất mạng khi ảnh đang tải. Thử hủy hộp chia sẻ và từ chối clipboard. Ghi mã lượt thử, phiên bản OS/trình duyệt/ứng dụng, kiểu mạng, phương thức link/QR, thời điểm bắt đầu, bước cuối hoàn thành, bước bị kẹt, lỗi hiển thị và cách khôi phục. Đo cảnh đầu từ lúc chạm link đến lúc có nội dung đọc được.

## Chỉ số và khoảng quan sát

Chốt ngày bắt đầu, ngày kết thúc và khoảng theo dõi trước pilot. Mọi chỉ số dùng khoảng UTC `[from, to)`. Xuất số lượng theo mẫu số và tử số. Chốt một khoảng quan sát sau lượt cuối hoặc đánh dấu lứa dữ liệu gần ngày kết thúc là chưa đủ thời gian.

| Chỉ số | Cách tính |
| --- | --- |
| Nháp đến xuất bản | Số nháp được tạo trong khoảng có ít nhất một xuất bản thành công trước `to` / số nháp tạo trong khoảng |
| Từ chọn mẫu tới có link | Trung vị từ lúc chọn mẫu tới lượt xuất bản thành công đầu tiên của từng nháp trong lứa. Kèm số quan sát, đơn vị mili giây |
| Quà có lượt mở tương tác | Số quà xuất bản trong khoảng có ít nhất một lần mở bằng tương tác người nhận / số quà xuất bản trong khoảng |
| Quà đã mở có hồi đáp | Số quà trên có ít nhất một hồi đáp được server chấp nhận, sau lượt mở tương tác / số quà có lượt mở tương tác |
| Mẫu Creator được người khác dùng | Số mẫu có phiên bản được duyệt trong khoảng và có ít nhất một Sender khác tác giả tạo nháp từ một phiên bản được duyệt trong cùng khoảng / số mẫu có phiên bản được duyệt trong khoảng |

Sự kiện được công nhận gồm `template_approved`, `draft_created`, `gift_published`, `gift_opened` và `reply_sent`. Gắn mã mờ ngẫu nhiên theo phiên pilot cho tác giả, Sender và đối tượng đo. Dùng cùng mã sự kiện khi thử lại. Chỉ đánh dấu mở tương tác khi người nhận có thao tác xác nhận hoặc tương tác thực tế trong quà. Tải HTML, bot xem trước link và bản preview dùng chế độ riêng. Bản ghi mở chưa xác định được nguồn dùng `unclassified` và được loại khỏi tử số.

`scripts/quality/beta-metrics.mjs` ở chế độ CLI chỉ chạy dữ liệu tổng hợp và từ chối trường ngoài hợp đồng. `node --test tests/unit/beta-metrics.test.mjs` kiểm công thức, loại preview và lượt chưa phân loại, khử trùng, xử lý khoảng thời gian, bảo toàn mẫu số. Dữ liệu gồm mã ngẫu nhiên và thời điểm. Lời chúc, ảnh, lời đáp, email, slug, link mời và URL bí mật nằm ngoài bộ sự kiện.

## Nhập tay trong pilot

Chủ dự án đã chọn ghi tay theo phiên, dùng mã ngẫu nhiên và giữ bản ghi thô tối đa 30 ngày. Luôn có người điều phối xác nhận kết quả từng lượt. App không tự thu sự kiện hành vi.

```powershell
$momeviaPilot = (node scripts/quality/beta-pilot-manual.mjs new | ConvertFrom-Json).id
node scripts/quality/beta-pilot-manual.mjs record $momeviaPilot
node scripts/quality/beta-pilot-manual.mjs report $momeviaPilot
node scripts/quality/beta-pilot-manual.mjs purge
```

Tạo kỳ pilot trước lượt đầu. Chọn `check` để ghi vai trò, hệ điều hành, trình duyệt, phiên bản, mạng, cách mở, bước cuối, kết quả và nhóm nguyên nhân. Dùng cùng mã đối tượng ngẫu nhiên do công cụ tạo khi nhập các mốc liên quan. Ghi thời điểm thao tác theo UTC nếu nhập sau khi quan sát. Báo cáo trả số liệu tổng hợp cùng các mục kiểm tra theo thiết bị.

Tệp phiên nằm trong `local/beta-pilot/` trên máy người điều phối. Phiên hết hạn khi đủ 30 ngày kể từ lúc tạo. Công cụ xóa phiên hết hạn khi mở hoặc khi chạy `purge`. Trước lượt pilot thật, cấu hình chạy `purge` theo lịch trên máy người điều phối và kiểm chính sách giữ bản sao. Trích báo cáo tổng hợp trước ngày hết hạn khi cần đối chiếu.

## Khôi phục và vận hành

Phiên rehearsal dùng MySQL 8.4 cô lập. Nạp 001–006, tạo bản ghi Support theo schema cũ, áp 007 và kiểm bản ghi gốc. Dừng writer QA trong lúc dump. Sao lưu SQL, ảnh canvas có tham chiếu và ảnh gift legacy. Dùng một schema đích mới, đối chiếu dữ liệu bảng và hash ảnh, rồi khởi động app từ thư mục sạch. Mở lại cùng URL, kiểm quyền khi có hoặc thiếu link mời, đọc bản V1, đối chiếu bytes ảnh canvas và quà cũ. Lệnh và log nằm trong thư mục bàn giao cục bộ.

Trước khi mở beta, giao một người trực xử lý theo ca. Theo dõi số lần lỗi mạng, 5xx và thời gian phản hồi của hai thao tác `POST /api/gifts/gifts/from-design` và `GET /api/gifts/gifts/:slug` bằng mẫu route, nhóm status và mốc thời gian. Tách 403/410 thường gặp do quyền, hết hạn hoặc thu hồi. Dùng số lần thử lại ở cổng đo để tách lỗi tạm thời. Cấu hình access log để loại bỏ slug, query, URL thô, body và thông tin cá nhân trước khi gửi sang công cụ theo dõi. Khi lỗi 5xx lặp lại, xác minh bằng quà tổng hợp và kiểm trạng thái API, MySQL, kho ảnh. Nếu writer gặp sự cố, code hiện có hỗ trợ tạm tắt canvas publish trong cấu hình và giữ reader hoạt động.

Admin mở mục **Yêu cầu hỗ trợ**, nhận xử lý theo mã, ghi kết quả. Với báo cáo quà chỉ lưu ID nội bộ của đối tượng. Quản trị viên xử lý theo quyền vận hành đã được giao. Chính sách gỡ vì vi phạm, thời hạn phản hồi, hạ tầng và người trực beta cần chốt trước khi tiếp nhận người dùng thật.

Sau pilot, cân nhắc dịp cảm ơn/kỷ niệm khi người tham gia chủ động yêu cầu. Cân nhắc hẹn giờ khi nhiều Sender phải tự chờ mới gửi quà. Cân nhắc lời nhắn thoại khi nhiều người tìm cách đính kèm âm thanh và đồng ý phạm vi lưu. Các quyết định giá, phí, hoàn tiền, chi trả Creator và thanh toán thật có nghiệm thu riêng.

## Quyền và phiên bản trong ứng dụng

- Link thường và link mời dẫn tới cùng món quà. Ba quyền chọn lúc gửi có hiệu lực cả với ảnh và các API hồi đáp. Sau thu hồi, người gửi vẫn đọc được lời đáp đã nhận trong Studio. Trang nhận quà đang mở kiểm lại trạng thái định kỳ và khi trở lại tab.
- Creator dùng editor để tạo nháp mẫu. Khi gửi, hệ thống chốt revision, vùng chữ/ảnh và tài nguyên. Admin chỉ quyết định trên phiên bản đã chốt. Ảnh thử do Admin chọn chỉ dùng trong trình duyệt. Mẫu chỉ xuất hiện sau khi duyệt. Nếu ảnh demo là ảnh đã tải lên, nó được cấp từ phiên bản đã duyệt.
- Việc rút mẫu hoặc mất quyền Creator dừng lượt dùng mới. Nháp Sender đã lấy mẫu vẫn có thể xuất bản theo phiên bản đã lưu. Quà giữ bản chụp, ảnh và lịch sử hồi đáp riêng.
