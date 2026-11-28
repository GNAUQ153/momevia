# Vật thể tự nhiên trong Canvas

## Kết quả rà soát sáu mẫu

| Thành phần | Đánh giá trước | Xử lý |
|---|---|---|
| Secret Santa / hộp quà | Khung rỗng không rõ thể tích. Bản ảnh cắt thử làm thiệp xuyên thân, không đạt mỹ thuật dù bấm/lưu được. | `lid-volume-v4`: các mặt ngoài/lòng/đáy/nắp/bản lề có chiều sâu thực; nơ satin sẵn có. Trạng thái đóng phải che kín chữ bằng các mặt hộp. |
| Midnight Soirée / phong bì, dấu sáp | Chữ nhật và oval chưa thể hiện nếp gấp/vật liệu. | `wax-letter-natural-v3`: dùng ảnh giấy và sáp của Momevia, mask các phần cùng một ảnh; tách chữ seal và `cardText` sửa được. |
| Graduation Mixtape / camera | Thân máy/lens đơn giản; bóng hình chữ nhật thừa và vùng ảnh trống lớn. | `object-natural-v3`: camera 3Dicons sẵn có; ảnh người gửi vẫn là slot riêng, chỉ xuất hiện sau chạm. |
| The Last Chapter / bằng, mũ | Mũ polygon và giấy chữ nhật thiếu vật liệu. | Dùng ảnh mũ vải/bằng cuộn sẵn có với mask phù hợp; không để mảnh mũ lọt vào bằng. Giữ thao tác mở/tung và phần chữ thật. |
| Garden Tea | Cửa đôi, nhóm cây/hoa/trà có nhận diện và chất liệu chủ ý. | Giữ bố cục và các thành phần đã phù hợp, kiểm lại hành trình và kích thước. |
| Graduation Countdown | Lịch, sticker, nhật ký và Polaroid là vật thể giấy, phù hợp cách thể hiện phẳng. | Giữ tương tác ngày đúng tháng/múi giờ và ảnh thật; không thay bằng tranh ghép không chỉnh sửa được. |
| Album, quiz, cào, vé, đĩa, RSVP/reply | Các cấu trúc cần đọc/sửa rõ; đĩa nhìn chính diện phù hợp dạng tròn phẳng. | Giữ chức năng thật, tách nội dung khỏi trang trí, kiểm lỗi/gửi lại và điều kiện nhạc mới quay. |

## Thư viện và chỉnh sửa

Tìm các ID `drive-santa-gift-box`, `drive-soiree-envelope`, `drive-camera-print`, `drive-ribbon-diploma`, `drive-cap-toss`. Đó là các mục tái sử dụng trong Canvas, không phải hình chỉ gắn vào một template. Các mục `natural-3d-gift`, `natural-satin-bow`, `natural-wax-seal` và các nguyên liệu khác vẫn có sẵn độc lập.

Hộp/phong bì có bộ chọn kiểu; hộp mặc định dùng cấu trúc có chiều sâu. Chỉnh chữ trên tấm thiệp và dấu riêng, màu thân/nơ/giấy, tốc độ và reaction R01/R02. Dừng/giảm chuyển động vẫn có hiệu lực. Ảnh cá nhân của camera là slot riêng với ảnh trang trí máy ảnh. Chèn/đổi kiểu tải tài nguyên thư viện qua pipeline ảnh bất biến có chủ sở hữu; không ghi URL công khai tùy ý vào tài liệu.

Ảnh trong props của vật thể được thu thập bởi `photoSlots`, nhờ đó dùng lại cùng quy trình materialize, validate, duplicate, save, publish và public projection. Khi đổi kiểu trên một khối có ảnh riêng, chỉ tài nguyên thư viện mới được nhập; ảnh đã sở hữu giữ ID. Chờ tải xong mới commit cả model và refs; kiểm lại model trước commit để tránh đè sửa đồng thời. Các mẫu không có kiểu tự nhiên không bị đổi hành vi.

## Hộp và giới hạn biểu diễn

Một ảnh hộp đóng không có mặt trong/nắp dưới. Không dùng hai mảnh ảnh đó để giả lập mở hộp. `lid-volume-v4` dựng các mặt theo cùng hệ tọa độ, nắp quay quanh cạnh sau và thiệp đi từ trong lòng hộp lên. Phong bì là vật liệu giấy mỏng nên có thể dùng các mask của cùng ảnh gốc để giữ nếp gấp. Các style ảnh thử cũ vẫn đọc được nhưng không tách nắp giả; chúng không phải kiểu hộp mặc định mới.

Hình và màu mới nằm trong tài liệu mới tạo hoặc sau lựa chọn kiểu rõ ràng. Không tự sửa nháp/snapshot đã lưu. Đây là renderer CSS 3D và vật liệu ảnh, không phải mô phỏng vật lý vải/giấy đầy đủ.

## Nguồn và quyền

- Nơ satin, phong bì, dấu sáp, mũ/bằng: Momevia Originals đã có trong `event-media`, kèm hash và quyền phân phối cùng quà. Không tạo hoặc sửa tệp ảnh gốc trong đợt này.
- Camera 3D và mục hộp 3D tĩnh trong thư viện: Vijay Verma / [3Dicons](https://github.com/realvjy/3dicons), CC0-1.0, đã đóng gói trong repo.
- Cách đặt các mặt khối CSS tham khảo [KILLERTIAN/3D-Box-Animation](https://github.com/KILLERTIAN/3D-Box-Animation), MIT © 2022 Om Sharma. Chỉ tích hợp kỹ thuật mặt khối; không dùng các reset/body CSS toàn cục hay vòng quay vô hạn của ví dụ. Notice đi kèm mã runtime.
- Đã đối chiếu Uiverse và LottieFiles; không thêm player/dependency hoặc gom thư viện bên ngoài khi tài nguyên hiện hành đủ dùng.

## Kiểm thử

`tests/unit/natural-objects.test.mjs`, `natural-insert.test.mjs` và `tests/browser/gift-volume.mjs` bảo vệ graph refs, quyền sở hữu, đổi kiểu, tỷ lệ vật thể và che khuất. Ca trình duyệt thay chữ trong trạng thái đóng: ảnh phải giống hệt vì thiệp bị thành hộp che; sau mở, thay chữ phải làm ảnh khác. Gate này được nối vào `npm run test:canvas:browser`.

Bằng chứng, chuỗi mở thật, gate Canvas trống và quà thử nằm tại `local/natural-objects-20261128`. Nghiệm thu cả JSON và MySQL cô lập; không ghi DB đang phục vụ. Safari, thiết bị vật lý và screen reader cần kiểm riêng; không suy ra từ Chromium.
