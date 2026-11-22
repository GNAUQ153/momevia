# Kế hoạch bản đầu của “Tớ đoán cậu sẽ chọn…”

Ngày 21/11/2026 · Đối chiếu mã nguồn Momevia trên nhánh `main`, phiên bản `54a4c83`.

Một người chuẩn bị hai món quà hoặc hai việc mình thật lòng muốn làm cho bạn. Trước khi gửi thiệp, người đó chọn **một dự đoán duy nhất** và viết lý do. Trong lần mở link đầu tiên, người nhận chọn món mình thích rồi đọc xem bạn mình đã đoán gì. Cái đáng nhớ là một chi tiết cho thấy hai người hiểu nhau, kể cả khi đoán trượt.

## Phạm vi bản đầu

Một mẫu sinh nhật trong thư viện, một người gửi, một người nhận, hai lựa chọn. Người gửi có thể sửa dự đoán khi còn là nháp. Khi phát hành, dự đoán và hai lời kết được chốt cùng phiên bản thiệp. Người nhận mở link từ ứng dụng nhắn tin và chơi ngay. Họ có thể bấm **Chơi lại** để thử cửa còn lại. Tải lại trang bắt đầu lượt mới.

Trong bản này, cú chạm chỉ phục vụ việc mở lời đoán trên thiết bị. Hai người có thể nhắn nhau để chốt món quà hoặc lịch hẹn. Ghi nhận lựa chọn vào Studio, đặt lịch và thống kê kết quả là các quyết định cho phiên bản sau nếu người dùng có nhu cầu.

## Momevia đã có gì và cần làm thêm gì

| Bước | Dùng lại từ Momevia | Công việc của bản đầu |
|---|---|---|
| Tạo quà | Thư viện mẫu, chế độ **Dùng mẫu**, trường tên người gửi và người nhận, lưu nháp và xem thử. [Trình tạo thiệp](../web/js/pages/designer.js) | Thêm mẫu sinh nhật và biểu mẫu nhập câu hỏi, hai lựa chọn, dự đoán, lý do và lời kết cho từng lựa chọn. |
| Chọn và bật mí | Canvas có hai cửa đến hai cảnh riêng, thẻ lật và vé cào. Hai cửa hiện chỉ điều hướng. [Danh mục tương tác](../web/js/shared/canvas/interactions.js) · [Trình xem](../web/js/features/gift-runtime/interactions.js) | Bổ sung một thẻ tương tác có hai trạng thái ngay trong cùng cảnh. Ban đầu chỉ hiện câu hỏi và A/B. Khi chạm, hiện lựa chọn của người nhận, dự đoán đã chốt, lý do và đúng lời kết. |
| Gửi và mở | Có luồng lưu nháp, kiểm tra trước khi gửi, chụp nội dung khi xuất bản, phân quyền, phát link/QR và thu hồi. [Luồng xuất bản](../src/modules/designs/designs.service.mjs) · [Hướng dẫn gửi quà](CANVAS_SENDER_GUIDE.md) | Đưa dữ liệu của thẻ mới qua các bước lưu, mở lại nháp, xem thử và xuất bản. Bản xem thử lấy đúng nội dung người gửi vừa nhập. |
| Bắt đầu một quà khác | Momevia có thao tác tặng người khác từ bố cục đã dùng. [Xử lý bố cục tặng lại](../web/js/shared/canvas/clean-layout.js) | Xóa câu hỏi riêng, A/B, dự đoán, lý do và lời kết khi tặng lại. Ví dụ của Minh và An chỉ xuất hiện ở bản minh họa. |

Trình xem hiện có thanh chuyển đến từng cảnh. Vì vậy, hai cảnh kết phù hợp để **dàn dựng demo**, còn thẻ cùng cảnh phù hợp để **đưa cho khách dùng**. Việc giữ bất ngờ ở bản đầu là hành vi giao diện. Người có quyền mở quà vẫn nhận được dữ liệu của phiên bản thiệp trên trình duyệt. [Điều hướng cảnh](../web/js/features/gift-runtime/scene-navigation.js) · [Cấu trúc Canvas](../web/js/shared/canvas/schema.js)

## Trình tự thực hiện

1. **Dựng bản quay bằng Canvas hiện có.** Tạo một nháp qua **Tự thiết kế** gồm bìa có hai cửa, cảnh kết A và cảnh kết B. Trong **Chỉnh bố cục**, nối mỗi cửa với một cảnh kết riêng. Ghi cùng một lời đoán và lý do vào cả hai kết. Xem thử hai nhánh rồi xuất bản một bản để quay. Có thể bàn giao clip minh họa cho Hà ở mốc này.
2. **Làm mẫu tạo nhanh.** Đưa mẫu mới vào thư viện Originals. Người gửi nhập các trường trên điện thoại rồi chạm chọn A hoặc B tại câu **“Cậu nghĩ bạn mình sẽ chọn gì?”**. Dự đoán gắn với mã lựa chọn A/B để việc sửa nhãn giữ đúng ý người gửi. Cho phép lưu nháp đang viết. Khi gửi, yêu cầu đủ câu hỏi, hai lựa chọn khác nhau sau khi bỏ khoảng trắng thừa, đúng một dự đoán, lý do và hai lời kết. Báo rõ trường cần sửa. Bàn giao khi đóng rồi mở lại nháp vẫn sửa tiếp được mọi trường.
3. **Nối thẻ mới vào trình xem và luồng phát hành.** Khai báo dữ liệu thẻ trong cấu trúc Canvas, kiểm tra dữ liệu khi lưu/gửi và giữ các trường cần thiết trong phiên bản quà đã phát hành. Mở mẫu cho người dùng sau khi trình xem và máy chủ đều đọc được loại thẻ mới. Dùng cùng thẻ cho xem thử và link thật. Bấm nhanh hai lần chỉ tạo một màn kết. **Chơi lại** đặt lại lượt chọn và giữ dự đoán ban đầu. Thêm nhãn giao diện VI/EN theo ngôn ngữ đang dùng, giữ nguyên lời người gửi đã viết.
4. **Nghiệm thu qua đường đi của khách.** Tạo từ thư viện → nhập và sửa → tải lại nháp → xem thử → gửi link → mở ở phiên trình duyệt khác. Thử cả bốn tổ hợp dự đoán A/B và chọn A/B. Trước khi chọn, cả người nhìn màn hình lẫn người dùng trình đọc màn hình chỉ tiếp cận được câu hỏi và hai phương án. Sau khi chọn, kiểm tra thứ tự đọc, chữ dài, thao tác bàn phím, chơi lại và tải lại trang. Sau xuất bản, sửa nháp rồi mở lại link cũ để xác nhận lời đoán vẫn đúng với bản đã gửi. Thử thêm một thiệp cũ và một lần tặng lại. Chốt bằng một lượt mở từ ứng dụng nhắn tin trên điện thoại thật.

## Demo sinh nhật để Hà quay

Minh tặng An một bữa ăn mừng sinh nhật. Trước khi gửi, **Minh đoán An sẽ chọn quán mì**. Chuẩn bị các nội dung dưới đây trước khi bấm quay.

| Thành phần | Nội dung trên điện thoại |
|---|---|
| Bìa | “An ơi, sinh nhật này tớ bao. Cậu chọn món nào?” |
| Hai cửa | A · “Quán mì hồi năm nhất” và B · “Để Minh vào bếp” |
| Lời đoán, dùng cho cả hai nhánh | “Tớ đoán cậu chọn quán mì. Lần nào đi ngang cậu cũng nhìn vào.” |
| Lời kết khi An chọn A | “Biết ngay! Thứ Bảy ghé quán cũ, lần này tớ mời.” |
| Lời kết khi An chọn B | “Trật rồi! Để tớ nấu. Nhớ rồi, phần cậu không hành.” |

**Bản dựng chính · 18 giây · khung dọc 9∶16**

| Thời gian | Hình và thao tác | Chữ hoặc tiếng Hà có thể dùng |
|---|---|---|
| 0–3 giây | Mở thẳng bìa trên điện thoại của An, hai cửa ở trong khung hình. | “Bạn thân 7 năm đoán mình chọn món nào?” |
| 3–7 giây | Giữ đủ lâu để đọc hai nhãn. An chạm **Để Minh vào bếp**. | Để người xem kịp chọn thầm trước cú chạm. |
| 7–12 giây | Hiện lời Minh đã đoán. Giữ trọn câu lý do trên màn hình. | “Nó đoán mình chọn quán mì…” |
| 12–16 giây | Giữ hình câu “Nhớ rồi, phần cậu không hành.” | “Đoán trật mà vẫn nhớ mình không ăn hành.” |
| 16–18 giây | Khung cuối có tên Momevia và tên tính năng. | Bản minh họa dùng dòng **“Mẫu thử sinh nhật”**. Khi bản đầu phát hành, có thể đổi thành **“Tạo thiệp cho bạn thân”**. |

Hà có thể quay thêm nhánh A từ đầu với chính món quà đó để có một đoạn kết khác. Với demo thủ công, quay thao tác thật trong link quà đã xuất bản và cắt dựng từ cảnh kết. Khi có mẫu tạo nhanh, có thể quay thêm cảnh Minh đánh dấu dự đoán ở phía người gửi để dùng cho clip giới thiệu cách tạo.

**Chuẩn bị khi quay.** Dùng nội dung minh họa, mở quà ở phiên người nhận, quay màn hình điện thoại theo chiều dọc và dựng ra 1080 × 1920. Kiểm tra chữ đọc được khi tắt tiếng. Có thể tập trên máy bằng `npm run demo:web`. Khi quay trên điện thoại thật, dùng địa chỉ HTTPS của môi trường thử mà điện thoại mở được và kiểm tra link quà đã tạo đúng địa chỉ. [Hướng dẫn demo](DEMO_WEB.md)

**Dấu hiệu đáng theo dõi khi thử.** Đưa điện thoại cho người nhận trước khi giải thích trò chơi và quan sát họ có tự chọn được không. Sau đó hỏi *“Chi tiết nào khiến bạn thấy món quà này đúng là dành cho mình?”*. Với người tạo, quan sát họ có tự viết được hai lựa chọn và một lý do mang dấu ấn riêng hay cần người hướng dẫn gợi ý. Hai quan sát này giúp quyết định nên đầu tư tiếp vào phần bật mí hay phần gợi ý nội dung.
