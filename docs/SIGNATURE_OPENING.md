# Signature S5B — hiệu ứng mở thiệp

S5B nối sáu hiệu ứng vào Recipient Player hiện có. Người nhận kích hoạt bằng nút chạm, click hoặc Enter/Space. Không sử dụng camera, microphone, script từ HTML gốc, font mới hoặc tài nguyên bên ngoài. Đây là mô phỏng mở thiệp bằng một lần kích hoạt, chưa phải thao tác kéo ruy băng vật lý, điều chỉnh thanh lấy nét hoặc chụp ảnh thật.

| Mẫu | Chuyển động |
| --- | --- |
| Secret Santa | Nơ và ruy băng rời hộp, nắp nâng, giấy thư đi lên |
| Midnight Soirée | Dấu sáp biến mất, nắp thư lật 3D, giấy thư trượt lên |
| Garden Tea | Hai cánh cửa xoay theo trục riêng, lá và dấu hoa chuyển động |
| The Last Chapter V2 | Vòng ống kính thay đổi độ nét, dấu lấy nét và núm điều chỉnh chuyển động |
| Graduation Mixtape | Nút chụp mô phỏng, màn hình lóe nhẹ, khung ảnh trượt ra |
| Graduation Countdown | Sticker lịch xoay và rời giấy, lịch và quả cầu phản hồi nhẹ |

## Hợp đồng runtime

Nhận diện các shape qua `props.kind` và artwork, trong entry scene có `signature-cover-decoration`. Không dựa vào tên hoặc UUID nên hỗ trợ bản nhân đôi. Khi Sender ẩn/xóa dấu hiệu nhận diện, thêm cụm không rõ ràng hoặc thiết lập reaction riêng thì dùng cơ chế chuyển cảnh cũ. Chỉ animate layer còn hiển thị và xác định được; ảnh Polaroid đi cùng khung khi nằm ngay sau khung trong thứ tự layer. Không chỉnh sửa dữ liệu Canvas. Rotation và opacity của model là cơ sở cho keyframe. Mọi track giới hạn 720–950 ms, sử dụng WAAPI và motion lifecycle hiện có; nút bị khóa tạm thời để tránh mở hai lần. Tắt motion hoặc reduced motion vẫn chuyển cảnh; đổi scene hoặc dispose hủy công việc đang chạy. Không thêm quyền hoặc thay đổi backend.

## Nghiệm thu local

`npm run demo:web -- --signature --port 4116 --no-watch`

Mở Catalog QA, xem preview sáu mẫu và dùng nút mở bìa. Tạo bản nháp thử đổi màu, xoay hoặc ẩn layer, rồi preview. Kiểm tra mở lại và tắt chuyển động. Không sử dụng profile QA với dữ liệu cá nhân thật. Mẫu cũ đã lưu giữ nhãn nút do Sender lưu; nhãn mới chỉ áp dụng cho document tạo sau nâng cấp/preview mới.

`node --test tests/unit/signature*.test.mjs`

S5B chưa kích hoạt Catalog production, chưa hoàn thiện toàn bộ thiết kế HTML gốc, interaction khám phá, RSVP tích hợp và kiểm thử thiết bị thực.
