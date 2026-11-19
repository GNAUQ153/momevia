# Momevia Canvas — kế hoạch mở rộng thư viện lên 100 khối

Ngày khảo sát 19/11/2026. Tài liệu đề xuất cho Canvas của người gửi. Các số 01–100 dùng để đối chiếu danh mục. Trong ứng dụng, người gửi thấy tên tiếng Việt, hình minh họa và nhóm. Mã chữ trong bảng là khóa thư viện, độc lập với ID của từng lớp trên thiệp.

## 1. Hiện trạng đã kiểm tra

Bảng **Công cụ thiết kế → Thêm** đang có **28 thẻ chèn, 28 ID duy nhất, 6 nhóm**. Đã xem DOM trên Microsoft Edge qua Playwright ở 1440 px và 390 px, dùng giao diện do localhost:4100 phục vụ và giả lập hai phản hồi đọc tài khoản Sender/nháp trống trong phiên riêng. Cả hai kích thước cho cùng số thẻ. Tìm “ngoi sao” cho một kết quả “Ngôi sao”. Phạm vi browser lần này là mở bảng, đếm và tìm kiếm. Kiểm tra riêng trong bộ nhớ đã gọi từng factory và xác thực 28/28 tài liệu nháp. Đây là đường cơ sở cho kế hoạch. Việc nghiệm thu save, publish và hiệu ứng mới thuộc các đợt bên dưới.

| STT | Nhóm | Thẻ hiện có theo thứ tự trong bảng Thêm |
|---|---|---|
| 01–05 | Chữ | 01 Tiêu đề · 02 Đoạn văn · 03 Lời chúc · 04 Tên người nhận · 05 Chữ ký người gửi |
| 06–08 | Ảnh | 06 Ảnh thường · 07 Ảnh bo góc · 08 Polaroid |
| 09–13 | Hình và nét | 09 Chữ nhật · 10 Ô bo góc · 11 Bầu dục · 12 Hình tròn · 13 Nét phân cách |
| 14–20 | Sticker | 14 Trái tim · 15 Ngôi sao · 16 Hoa · 17 Lấp lánh · 18 Bóng bay · 19 Bánh sinh nhật · 20 Quà |
| 21–23 | Cụm trang trí | 21 Cụm hoa · 22 Cành lá · 23 Cụm sao |
| 24–28 | Tương tác | 24 Phong bì · 25 Hộp quà · 26 Đọc tiếp · 27 Xem lại · 28 Lời hồi đáp |

Chín loại dữ liệu hiện tại gồm `text`, `image`, `shape`, `line`, `sticker`, `button`, `envelope`, `gift-box`, `reply`. Một lần chọn Polaroid chèn ba lớp, còn Cụm hoa chèn bảy lớp. Các lớp có thể sửa riêng. Kho tài liệu tính theo lớp thực và hiện giới hạn 400 lớp, 32 cảnh, 64 asset và 256 KiB mỗi tài liệu. Để chốt con số 100, đếm mỗi mục có ID riêng, xem được trong bảng Thêm và chèn được bằng một thao tác đúng quyền. Mỗi mục mới cần hình dạng, bố cục hoặc hành vi sử dụng phân biệt được. Màu, tốc độ, kích cỡ và lựa chọn hiệu ứng là thuộc tính chỉnh sửa.

UI hiện dựng tất cả thumbnail cỡ 62 × 48 px ở lần mở tab đầu tiên. Tìm kiếm đã xử lý tiếng Việt có và không dấu. Trong chế độ cá nhân hóa nhanh, người dùng sửa nội dung. Với mẫu Creator đã duyệt, quyền nguồn hiện giới hạn các binding và một ô ảnh được chỉ định. Các thẻ mới triển khai trước cho Sender ở chế độ tự thiết kế/chỉnh bố cục có quyền thêm.

Phong bì và hộp quà hiện là điều khiển có biểu tượng và nhãn. Hành động canvas hiện hành gồm chuyển đến cảnh đích và xem lại từ đầu. Player thay nội dung cảnh khi kích hoạt. CSS có quy tắc giảm chuyển động. Các tên hiệu ứng ở metadata của mẫu cần đối chiếu với những gì người gửi thực sự cấu hình và người nhận thực sự nhìn thấy.

Nguồn để tiếp tục triển khai gồm [danh mục](../web/js/features/canvas-editor/library.js), [registry](../web/js/shared/canvas/registry.js), [schema và dữ liệu công khai](../web/js/shared/canvas/schema.js), [bảng Thêm và bảng chỉnh](../web/js/pages/designer.js), [runtime](../web/js/features/gift-runtime/index.js), [renderer](../web/js/features/gift-runtime/renderer.js), [hướng dẫn Sender](CANVAS_SENDER_GUIDE.md).

## 2. Danh mục đích

| Nhóm trong bảng Thêm | Đang có | Bổ sung | Đích |
|---|---:|---:|---:|
| Chữ | 5 | 10 | 15 |
| Ảnh | 3 | 11 | 14 |
| Hình và nét | 5 | 10 | 15 |
| Sticker | 7 | 14 | 21 |
| Cụm trang trí | 3 | 9 | 12 |
| Kể chuyện và kỷ niệm | 0 | 8 | 8 |
| Tương tác | 5 | 10 | 15 |
| **Tổng** | **28** | **72** | **100** |

Mỗi dòng dưới đây là một thẻ bổ sung. Thumbnail phải cho người gửi nhìn ra kết quả sau khi chèn. Trong bảng chỉnh, đặt thao tác thường dùng trước tọa độ và thông số kỹ thuật. Các ví dụ chữ, ngày và hình ảnh dùng dữ liệu minh họa. Giữ binding cho các trường có chủ đích cập nhật ở nhiều cảnh.


### Chữ và lời nhắn

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 29 | `quote-block` | Trích dẫn có ngoặc | Một câu đặt giữa hai dấu ngoặc lớn, có dòng tác giả. Sửa câu và tên riêng. |
| 30 | `drop-cap` | Chữ cái mở đoạn | Chữ đầu cỡ lớn cạnh đoạn mở thư. Khi đọc bằng trình đọc màn hình, câu vẫn liền mạch. |
| 31 | `postscript` | Lời tái bút | Dòng “P.S.” ở lề và lời nhắn riêng bên cạnh. Sửa cả ký hiệu và lời. |
| 32 | `name-ribbon` | Ruy băng ghi tên | Dải ruy băng có hai đuôi, ở giữa lấy tên từ trường người nhận. Sửa màu và cỡ chữ. |
| 33 | `date-label` | Nhãn ngày kỷ niệm | Miếng lịch có ngày lớn, tháng và năm ở dưới. Sender nhập ngày để in trên thiệp. |
| 34 | `spine-title` | Chữ gáy thiệp | Một dòng chữ xoay dọc mép trang như gáy sách. Sửa chữ, hướng và vị trí. |
| 35 | `sticky-note` | Giấy nhắn dán | Một mảnh giấy nghiêng, có miếng băng dán và nội dung viết tay bằng font sẵn có. |
| 36 | `speech-bubble` | Bong bóng lời thoại | Khung thoại có đuôi trỏ dùng đặt cạnh ảnh hoặc nhân vật. Sửa chữ và màu. |
| 37 | `poem-card` | Thẻ thơ hai khổ | Hai vùng thơ và một dòng đề tặng, giữ ngắt dòng do người gửi nhập. |
| 38 | `bilingual-note` | Lời nhắn song ngữ | Hai đoạn song song hoặc xếp dọc trên màn nhỏ. Người gửi tự điền cả hai ngôn ngữ. |

### Ảnh và khung ảnh

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 39 | `round-portrait` | Chân dung tròn | Một ô ảnh cắt tròn. Giữ tâm khuôn mặt khi phóng và đổi kích thước. |
| 40 | `arch-photo` | Ảnh vòm cửa | Ảnh có đỉnh vòm, đáy thẳng. Cho chọn ảnh và chỉnh điểm lấy nét. |
| 41 | `heart-photo` | Ảnh trái tim | Cắt một ảnh theo biên trái tim. Cho chỉnh crop bên trong mặt nạ. |
| 42 | `film-strip` | Dải phim ba ảnh | Ba ô ảnh dọc với lỗ phim hai bên. Mỗi ô có ảnh và mô tả riêng. |
| 43 | `photo-diptych` | Ảnh đôi trước và sau | Hai ảnh cạnh nhau với hai nhãn thời điểm. Cả hai hiện đồng thời. |
| 44 | `photo-postcard` | Bưu thiếp ảnh | Một bên là ảnh, bên kia là địa danh, vài dòng thư và ô tem trang trí. |
| 45 | `magazine-cover` | Bìa tạp chí cá nhân | Ảnh chân dung dưới tên tạp chí và hai dòng tít. Người gửi sửa từng dòng. |
| 46 | `panorama-caption` | Ảnh toàn cảnh có chú thích | Khung ảnh ngang rộng kèm thanh chú thích tách khỏi ảnh. Chú thích dài có thể xuống dòng. |
| 47 | `quad-album` | Album bốn ô | Lưới ảnh 2 × 2 để kể bốn khoảnh khắc ngang vai. Thay từng ô độc lập. |
| 48 | `torn-photo` | Ảnh mép giấy xé | Ảnh có viền xé bất quy tắc từ hình dựng sẵn. Viền giữ hình khi người gửi crop. |
| 49 | `hero-collage` | Ảnh ghép một lớn hai nhỏ | Một ảnh chính chiếm nửa bố cục, hai ảnh phụ xếp chồng bên cạnh. Sửa thứ tự ảnh. |

### Hình và nét

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 50 | `triangle` | Tam giác | Mảng tam giác để làm cờ hoặc tạo mảng màu. Sửa màu, viền và góc xoay. |
| 51 | `diamond` | Hình thoi | Mảng bốn cạnh để làm nền số hoặc chữ. Sửa tỷ lệ và màu. |
| 52 | `hexagon` | Lục giác | Mảng sáu cạnh có thể ghép thành tổ ong. Sửa màu và viền. |
| 53 | `arch-shape` | Hình vòm | Mảng màu đỉnh bán nguyệt, dùng làm nền sau chữ hoặc ảnh. |
| 54 | `arc-line` | Nét vòng cung | Một cung hở để ôm tiêu đề. Sửa màu, độ dày và hướng. |
| 55 | `stitched-line` | Đường chỉ may | Nét đứt có đầu tròn, dùng viền giấy hoặc phân đoạn nội dung. |
| 56 | `curved-arrow` | Mũi tên cong | Mũi tên có thân cong và đầu chỉ hướng. Sửa độ dày, màu và xoay. |
| 57 | `wave-line` | Nét lượn sóng | Một đường lượn liên tục để ngăn phần thư. Co giãn theo chiều ngang. |
| 58 | `brace` | Ngoặc ôm đoạn | Dấu ngoặc nhọn cao để gom nhiều dòng. Đảo hướng hoặc xoay. |
| 59 | `corner-frame` | Khung bốn góc hở | Bốn góc chữ L chừa khoảng trống ở mỗi cạnh. Chỉnh cỡ, màu và nét. |

### Sticker

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 60 | `ribbon-bow` | Nơ ruy băng | Nơ hai vòng và hai đuôi, dùng gắn lên góc ảnh hay miệng hộp. |
| 61 | `wax-seal` | Con dấu sáp | Dấu sáp viền lượn có họa tiết dập nổi, dùng niêm thư. |
| 62 | `paper-crane` | Hạc giấy | Hình hạc origami với các đường gấp nhìn rõ ở cỡ nhỏ. |
| 63 | `butterfly` | Bươm bướm | Bướm nhìn từ trên với hai cánh đối xứng. |
| 64 | `sun` | Mặt trời | Mặt trời tròn có tia ngắn, dùng cho lời chào buổi sáng. |
| 65 | `crescent` | Trăng khuyết | Vầng trăng cong, dùng trên thiệp đêm hoặc lời chúc ngủ ngon. |
| 66 | `rainbow` | Cầu vồng | Các dải màu hình cung với hai chân ngắn. |
| 67 | `rain-cloud` | Mây mưa | Một cụm mây và vài hạt mưa, dùng cho lời động viên. |
| 68 | `tea-cup` | Tách trà | Tách có quai, đĩa lót và nét hơi nước. |
| 69 | `film-camera` | Máy ảnh phim | Máy ảnh cổ nhìn chính diện với ống kính nổi bật. |
| 70 | `flower-bicycle` | Xe đạp giỏ hoa | Dáng xe nhìn ngang và giỏ hoa phía trước, dùng cho thiệp hẹn. |
| 71 | `birthday-candle` | Nến sinh nhật | Một cây nến độc lập để trang trí cạnh tuổi hoặc tên. |
| 72 | `lantern` | Đèn lồng Hội An | Lồng đèn có nan và tua rủ cho thiệp lễ hội. |
| 73 | `sea-shell` | Vỏ sò | Vỏ sò xòe nan, dùng trên thiệp du lịch và kỷ niệm biển. |

### Cụm trang trí

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 74 | `string-lights` | Dây đèn treo | Dây võng với các bóng đèn ở nhiều vị trí. Người gửi di chuyển hoặc bỏ từng bóng. |
| 75 | `laurel-wreath` | Vòng nguyệt quế | Hai nhánh lá tạo vòng trống ở giữa để đặt tên hoặc số năm. |
| 76 | `balloon-arch` | Vòm bóng bay | Hai cụm bóng cao thấp tạo vòm. Sửa màu và vị trí từng cụm bóng. |
| 77 | `washi-corners` | Góc dán washi | Các dải băng giấy xếp chéo ở góc ảnh, có họa tiết và màu riêng. |
| 78 | `layered-waves` | Sóng biển nhiều lớp | Ba dải sóng có cao độ khác nhau ở chân thiệp. Sửa màu theo lớp. |
| 79 | `lantern-street` | Phố đèn lồng | Hai dây treo xen kẽ và các lồng đèn ở nhiều cao độ. |
| 80 | `wrapped-bouquet` | Bó hoa gói giấy | Giấy gói, thân, hoa và nơ là các lớp có thể chỉnh. |
| 81 | `lace-border` | Viền ren quanh thiệp | Bốn dải ren có họa tiết lặp, giữ trống vùng nội dung ở giữa. |
| 82 | `birthday-table` | Bàn tiệc sinh nhật | Một bàn nhỏ có đĩa bánh, nến và cờ dây. Có thể bỏ bớt từng món. |

### Kể chuyện và kỷ niệm

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 83 | `three-milestones` | Dòng thời gian ba mốc | Ba mốc gồm ngày, tên sự kiện và câu kể. Sắp theo thứ tự đọc. |
| 84 | `diary-page` | Trang nhật ký | Ngày ở đầu trang, một đoạn kể và một dòng tâm trạng. |
| 85 | `date-ticket` | Vé hẹn gặp | Vé có đường xé, tên buổi hẹn, giờ và địa điểm do người gửi điền. |
| 86 | `friendship-recipe` | Công thức tình bạn | Danh sách “nguyên liệu” và lời dặn như một trang công thức. |
| 87 | `three-appreciations` | Ba điều mình quý ở bạn | Ba lời ghi nhận đánh số, mỗi lời có tiêu đề và ví dụ ngắn. |
| 88 | `date-menu` | Thực đơn bữa hẹn | Thẻ thực đơn có tên bàn, ba món và một lời mời. |
| 89 | `journey-map` | Bản đồ hành trình | Sơ đồ minh họa ba điểm đến và đường nối, người gửi tự đặt tên địa điểm. |
| 90 | `milestone-badge` | Huy hiệu cột mốc | Hoa thị có con số lớn, đơn vị và dòng ghi công cho một dịp kỷ niệm. |

### Tương tác

| STT | Mã thẻ đề xuất | Tên trong bảng Thêm | Kết quả khi chèn và phần được chỉnh |
|---:|---|---|---|
| 91 | `flip-card` | Thẻ lật hai mặt | Chạm để lật giữa câu hỏi và lời nhắn sau thẻ. Tab và Enter/Space làm được cùng việc. |
| 92 | `scratch-ticket` | Vé cào bật mí | Vuốt để xóa lớp phủ. Nút “Mở ngay” hiển thị cùng nội dung cho bàn phím và người muốn bỏ qua. |
| 93 | `foldout-letter` | Thư gấp ba nếp | Ba đoạn thư có tiêu đề riêng. Chạm vào một nếp để mở hoặc thu, có trạng thái mở rõ ràng. |
| 94 | `swipe-album` | Album vuốt ngang | Bộ ảnh có chú thích theo từng trang, chỉ báo vị trí và nút Trước/Sau tương đương với vuốt. |
| 95 | `photo-comparison` | Thanh kéo so sánh ảnh | Hai ảnh chồng cùng khung. Kéo hoặc dùng phím mũi tên để thay tỷ lệ so sánh. |
| 96 | `scene-choices` | Hai cửa chọn câu chuyện | Hai lựa chọn có nhãn và đích cảnh riêng. Tận dụng hai nút điều hướng hiện có. |
| 97 | `wish-pick` | Chọn một điều ước | Ba lựa chọn mở ba lời chúc khác nhau ngay trong cảnh. Cho phép chọn lại. |
| 98 | `light-a-candle` | Chạm thắp nến | Kích hoạt để ngọn nến sáng và hiện lời ước. Dùng được bằng nút và bàn phím. |
| 99 | `heart-puzzle` | Ghép ba mảnh tim | Chạm lần lượt ba mảnh để ghép hình và mở lời nhắn. Có nút xem lời nhắn ngay. |
| 100 | `event-countdown` | Đồng hồ đếm ngược tới hẹn | Sender nhập ngày, giờ và múi giờ. Hiện thời điểm hẹn, thời gian còn lại và lời chúc khi đến giờ. |

### Chỉ dẫn tạo hình cho cả bộ

| Họ hình | Quyết định thiết kế đề xuất | Cách kiểm bằng mắt |
|---|---|---|
| Giấy thư và sổ tay | Dùng nền giấy sáng, màu mực đậm, một điểm nhấn tím hoặc hồng. Cho dấu sáp, nét may và góc washi có hình dáng khác nhau kể cả khi chuyển sang đơn sắc. | Ở thumbnail 62 × 48 px vẫn nhận ra vé hẹn, bưu thiếp và giấy nhắn. Ở kích thước thiệp, vùng gõ tên và lời nhắn có đủ khoảng trống. |
| Ảnh kỷ niệm | Chân dung tròn, ảnh vòm và ảnh trái tim có đường bao rõ. Dải phim có nhịp ba ô, album bốn ô có trọng lượng đều, bố cục một lớn hai nhỏ nhấn vào ảnh chính. | Dùng cùng một bộ ảnh mẫu và cùng một màu nền để đối chiếu. Tên, chú thích và nút điều khiển vẫn đọc được khi đặt ảnh rất sáng hoặc rất tối. |
| Sticker và cụm | Thống nhất độ dày nét và góc bo. Dùng mảng màu đủ lớn để hình hạc, đèn lồng và xe đạp vẫn có đường bao dễ nhận. Dùng bảng màu hiện có làm xuất phát điểm, ví dụ tím nhạt `#DDD0FF`, hồng `#F0C4D2`, xanh lá `#BEDCCB`, vàng `#F2D591` và mực `#32243B`. | Xem từng hình trên nền sáng và nền tối. Trong cụm trang trí, các lớp chính vẫn chọn, đổi màu hoặc bỏ độc lập. |
| Tương tác | Vé cào có góc hé, thẻ lật có mép mặt sau, thư gấp có ba nếp. Nút dùng động từ cụ thể như “Lật thẻ”, “Mở ngay”, “Thắp nến”. | Người xem lần đầu nhận ra thao tác từ hình và nhãn. Kích hoạt bằng touch hoặc bàn phím không làm vùng điều khiển nhảy khỏi vị trí. |

Khi trình bày cả bộ, dùng một bảng ảnh thu nhỏ theo nhóm, cùng tỷ lệ và nền trung tính. Đối chiếu cạnh nhau để phát hiện thẻ quá giống, chữ bị cắt, nét quá mảnh hoặc lớp trang trí che nội dung trước khi đưa vào thư viện.

## 3. Thiết kế hiệu ứng và animation

Đề xuất **24 tùy chọn**, gồm 4 kiểu bề mặt tĩnh và 20 hiệu ứng có chuyển động. Mỗi mục có một nơi cấu hình, đối tượng áp dụng và trạng thái kết thúc. Có thể dùng phong bì cũ với động tác mở nắp mới. Thẻ lật vẫn đổi mặt ngay khi người nhận bật giảm chuyển động.

| Mã | Nhóm | Tên trong bảng chỉnh | Áp dụng cho | Trải nghiệm mong muốn |
|---|---|---|---|---|
| S01 | Bề mặt | Bóng đổ giấy | Ảnh, bưu thiếp, giấy nhắn | Bóng lệch nhẹ làm rõ lớp giấy. Khi giảm chuyển động vẫn giữ kiểu tĩnh. |
| S02 | Bề mặt | Viền kép | Khung và hình | Hai nét đồng tâm, sửa màu theo bảng màu thiệp. |
| S03 | Bề mặt | Vân giấy mịn | Bề mặt giấy và nền cảnh | Hạt tĩnh do ứng dụng cung cấp. Dành vùng phẳng cho chữ nhỏ. |
| S04 | Bề mặt | Viền sáng dịu | Sticker và hình | Viền sáng tĩnh để tách hình khỏi nền, có mẫu thử trên nền sáng và tối. |
| E01 | Xuất hiện | Hiện dần | Chữ, ảnh, cụm | Khi vào cảnh, đối tượng đi từ trong suốt đến độ mờ mà Sender đã đặt. |
| E02 | Xuất hiện | Nổi nhẹ từ dưới | Chữ, ảnh, sticker | Dịch lên quãng ngắn khi vào cảnh rồi dừng ở đúng vị trí. |
| E03 | Xuất hiện | Đánh máy từng cụm chữ | Lời nhắn và thư | Hiện dần theo cụm ký tự tiếng Việt. Có thể xem trọn ngay. Trình đọc màn hình nhận câu hoàn chỉnh. |
| E04 | Xuất hiện | Vẽ dần đường nét | Nét, đường may, vòng cung | Đường hiện theo chiều vẽ, kết thúc với hình dáng đã chọn. |
| A01 | Nhấn mạnh | Tim đập hai nhịp | Tim, huy hiệu và sticker | Phóng nhẹ hai lần rồi dừng. Tránh thay đổi vùng nhận chạm. |
| A02 | Nhấn mạnh | Nghiêng ảnh rồi trả về | Ảnh, Polaroid và thẻ | Dao động góc nhỏ quanh góc xoay gốc rồi dừng. |
| A03 | Nhấn mạnh | Vệt sáng lướt | Tem sáp, khung ảnh và nút | Một vệt sáng đi qua và kết thúc, giữ chữ và viền focus rõ. |
| A04 | Nhấn mạnh | Gạch chân lan | Tiêu đề và trích dẫn | Một đường màu chạy dưới dòng muốn nhấn. |
| T01 | Chuyển cảnh | Hòa mờ giữa hai cảnh | Cảnh đích | Hình cảnh cũ mờ đi và cảnh mới hiện lên. |
| T02 | Chuyển cảnh | Đẩy trang ngang | Cảnh đích | Hai trang chuyển theo chiều đọc, giữ vị trí cần focus ở cảnh mới. |
| T03 | Chuyển cảnh | Lật trang giấy | Cảnh đích | Một lớp giấy lật qua để lộ cảnh mới. |
| T04 | Chuyển cảnh | Mở rèm đôi | Cảnh đích | Hai mảng ở giữa tách sang hai bên khi đổi cảnh. |
| B01 | Không khí cảnh | Pháo giấy một lượt | Cảnh chúc mừng | Một đợt giấy màu rơi nhẹ ở rìa nội dung khi vào cảnh. |
| B02 | Không khí cảnh | Cánh hoa rơi | Cảnh lời chúc và tri ân | Cánh hoa rơi thưa trong một khoảng ngắn rồi tự dừng. |
| B03 | Không khí cảnh | Sao trôi | Cảnh đêm | Vài ngôi sao nhỏ lướt chéo, có thể giảm mật độ. |
| B04 | Không khí cảnh | Đom đóm | Cảnh tối | Các chấm sáng lên, dịu lại theo đợt ngắn và tránh vùng chữ. |
| R01 | Phản hồi khi chạm | Mở nắp phong bì | Phong bì | Kích hoạt để lật nắp và thực hiện hành động đã cấu hình một lần. |
| R02 | Phản hồi khi chạm | Bật nắp hộp quà | Hộp quà | Nắp nâng và nghiêng, hành động điều hướng giữ nguyên đích. |
| R03 | Phản hồi khi chạm | Bung tia sao khi chạm | Điều khiển có thao tác | Tia sao xuất hiện ở điểm kích hoạt, bàn phím dùng tâm của nút. |
| R04 | Phản hồi khi chạm | Ngọn nến bừng sáng | Chạm thắp nến | Phần lửa sáng dần. Khi tắt motion, nến chuyển trạng thái ngay. |

### Bảng chỉnh và quy tắc phát

- **Chọn phần tử → Chỉnh.** Mục “Kiểu bề mặt” cho chọn hiệu ứng tĩnh. Mục “Chuyển động” cho chọn lúc xuất hiện, nhấn mạnh hoặc lúc kích hoạt theo khả năng của phần tử. Hiển thị “Tắt”, tên hiệu ứng hiện dùng, “Xem thử” và “Bỏ hiệu ứng”. Hiệu ứng nhấn mạnh phát sau khi phần tử xuất hiện hoặc khi Sender chọn xem thử. Mỗi lần vào cảnh chỉ phát một lượt tự động.
- **Chọn cảnh → Chỉnh cảnh.** Đặt “Khi vào cảnh” và “Không khí” cạnh màu nền. Hiệu ứng chuyển thuộc về cảnh đích nên đi tới cùng cảnh bằng nút, thẻ rẽ nhánh hay thanh điều hướng cho kết quả nhất quán. Lần mở quà đầu tiên chỉ phát hiệu ứng vào của phần tử và hiệu ứng không khí đã chọn.
- **Điều khiển dễ hiểu.** Đề xuất ba tốc độ Chậm, Vừa, Nhanh, độ trễ 0/150/300 ms cho hiệu ứng xuất hiện và mật độ Thưa/Vừa cho hạt. Giá trị khởi đầu để thử nghiệm là 180–450 ms cho chuyển động ngắn, 2–4 giây cho một lượt hạt và tối đa 16 hạt đồng thời mỗi cảnh. Giới hạn và số đo này cần xác minh trên thiết bị di động.
- **Phối hiệu ứng.** Mỗi phần tử chọn tối đa một preset cho từng mục tương thích. Mỗi cảnh có tối đa một chuyển cảnh và một hiệu ứng không khí. Bố trí lớp hiệu ứng bên trong hoặc bên trên lớp đã có tọa độ, giữ nguyên góc xoay và độ mờ mà Sender đã chỉnh. Nếu hai chuyển động cùng sửa một thuộc tính, phát tuần tự. Thumbnail và canvas khi đang kéo, crop hoặc nhập chữ giữ tĩnh. Nút “Xem thử” chỉ phát cho mục đang chỉnh.
- **Điều hướng và hồi đáp.** Enter, Space, chạm và click cho cùng kết quả trên điều khiển thích hợp. Khi người nhận đổi cảnh liên tiếp, hủy lượt cũ, chỉ xử lý một lần mỗi lần kích hoạt. Chuyển focus đến tiêu đề hoặc khu vực nội dung phù hợp. Ngừng listener, timer và hiệu ứng khi rời cảnh, đóng preview hoặc phát lại. Hồi đáp chỉ đi qua adapter và chính sách hiện có.
- **Giảm chuyển động.** Tôn trọng cài đặt hệ điều hành và cho người xem tắt chuyển động cho phiên xem. Phong bì mở thẳng cảnh đích, thẻ lật hiện ngay mặt sau, vé cào có “Mở ngay”, hạt nền dừng. Nội dung thiết yếu hiển thị đầy đủ khi animation bị tắt hoặc bị gián đoạn. Các lớp trang trí không bắt sự kiện chuột, chạm hay focus.

### Ba thiệp mẫu để nghiệm thu thiết kế

| Dịp | Cảnh mở | Khoảnh khắc người nhận tham gia | Điều cần quan sát |
|---|---|---|---|
| Sinh nhật | Phong bì cài dấu sáp, người nhận mở nắp | Chạm thắp nến để đọc lời ước, pháo giấy một lượt, sau đó chọn gửi hồi đáp | Chạm nhanh hai lần vẫn mở đúng một cảnh. Người dùng bàn phím đọc được lời ước và đến ô hồi đáp. |
| Kỷ niệm | Bìa tạp chí cá nhân và tên người nhận | Vuốt album rồi kéo so sánh hai bức ảnh trước và sau | Caption dài, crop và mô tả khớp từng ảnh ở 390 px. Nút và bàn phím làm được cùng thao tác. |
| Cảm ơn | Bó hoa gói giấy và trích dẫn ngắn | Lật thẻ để đọc ba điều người gửi trân trọng, có lựa chọn xem lại | Câu tiếng Việt đầy đủ ở chế độ giảm chuyển động. Đổi mặt không để lại phần tử ẩn trong thứ tự Tab. |

## 4. Luồng dùng khi thư viện có 100 thẻ

1. **Tìm và duyệt.** Giữ vị trí ô “Tìm khối” như trong ảnh. Ngay dưới là bộ chọn nhóm có số lượng và hành động “Tất cả”. Khi chọn một nhóm chỉ hiển thị kết quả của nhóm. Tìm theo tên và từ đồng nghĩa, có hoặc không dấu. Ví dụ “con dau” tìm được Con dấu sáp, “anh ghep” tìm thấy bố cục ghép ảnh. Trạng thái rỗng có cách xóa tìm kiếm. Khi chèn xong giữ nguyên nhóm, từ khóa và vị trí cuộn.
2. **Nhìn ra kết quả.** Thẻ dùng hình tĩnh thể hiện đặc trưng riêng, có nhãn chữ. Với thẻ tương tác, ví dụ vé cào, hiển thị một góc đã hé để người gửi hiểu. Chỉ tạo thumbnail khi nhóm được mở hoặc sắp vào màn hình, vẫn tìm được toàn bộ danh mục bằng dữ liệu nhẹ. Giữ hai cột của sidebar desktop và kiểm tra bottom sheet mobile, tên tiếng Việt dài không bị khuất.
3. **Thêm và chỉnh.** Một thao tác chèn tạo một bước hoàn tác kể cả khi sinh nhiều lớp. Giữ thứ tự đọc, thứ tự xếp lớp, vị trí trong vùng nhìn và các phần tử đã khóa. Sửa nội dung phổ biến bằng trường có nhãn nghiệp vụ như “Ảnh chính”, “Mặt sau”, “Lời ước”. Với cụm gồm nhiều lớp độc lập, hiện lớp tương ứng khi chọn từ bảng Lớp. Nếu cần chỉnh cả cụm sau khi lưu, phải có định danh và tham chiếu nhóm được kiểm thử qua nhân bản, hoàn tác và tải lại.
4. **Xem như người nhận.** Preview và link quà dùng cùng cơ chế render và điều hướng. Preview mô phỏng hồi đáp. Bộ chọn preset có thể minh họa hiệu ứng bằng nút “Xem thử”. Giữ giao diện soạn và thumbnail tĩnh trong lúc chỉnh. Người nhận mở quà trên điện thoại bằng luồng hiện có.
5. **Nội dung cá nhân.** Ảnh có thể là ô tùy chọn hoặc dữ liệu cần cho tương tác. Khung ảnh tĩnh tùy chọn để trống có hình thay thế phù hợp hoặc ẩn vùng ảnh khi hiển thị công khai. Phần chữ vẫn đọc được. Album vuốt cần ít nhất một ảnh, thanh so sánh cần đủ hai ảnh. Khi thiếu dữ liệu bắt buộc, báo đúng khối và đúng ô trước khi xuất bản. Nhân bản ảnh giữ đúng tham chiếu và quyền.

## 5. Các đợt triển khai và điều kiện hoàn tất

Mốc số lượng tính trên thư viện mà Sender có quyền tự thiết kế. Mỗi đợt thực hiện theo thay đổi nhỏ, chạy kiểm thử liên quan, sửa rồi chạy lại. Cứ ba bước triển khai chạy hồi quy cộng dồn. Công việc với Creator sau cùng kiểm tính tương thích với mẫu và quyền hiện có.

| Đợt | Phạm vi | Tổng đích | Bằng chứng cần có trước khi chuyển đợt |
|---|---|---:|---|
| 0. Đối chiếu | Xem Git/WIP, registry, tất cả factory, từng nơi đọc phiên bản. Chụp bảng Thêm, ghi số nút, tìm kiếm, thời gian mở ở desktop/mobile. Lấy fixture V1 tĩnh từ trước thay đổi để đối chứng. | 28 ở baseline hiện tại | Bảng ID hiện hành, số nhóm và số đo. Nếu baseline đã đổi, ánh xạ thẻ tương đương và nêu phần chênh trước khi thay danh sách. |
| 1. Nền thư viện và phiên bản | Bổ sung dữ liệu nhẹ cho tìm kiếm và xem trước. Thiết kế registry dùng chung cho các kiểu mới, chiến lược đọc V1 và tài liệu mở rộng. Đưa đường đọc vào hoạt động trước khi writer sinh nội dung mới. | 28 | UI, tài liệu nháp, snapshot và quyền V1 mở được. Lần mở bảng đầu không phải dựng đồng loạt 100 thumbnail mẫu. |
| 2. Chữ, sticker, kể chuyện | 29–38, 60–73, 83–90. Thêm 10 thẻ chữ, 14 sticker có hình minh họa và 8 bố cục kể chuyện. Kiểm tỉ lệ, độ tương phản, dấu tiếng Việt ở cỡ thumbnail và trên thiệp. | 60 | 32 thẻ mới có hình và dữ liệu thật. Các vùng chữ sửa được. Tên người nhận giữ binding. Undo cả cụm một lần. |
| 3. Hình và cụm trang trí | 50–59, 74–82. Dựng hình học và đường nét từ hình cho phép, tái dùng trong 9 cụm trang trí. Giữ thành phần chính của cụm thành lớp có thể chọn và sửa. | 79 | 19 thẻ mới thấy được trên canvas, thumbnail và preview. Nét trang trí không đè nội dung hoặc chặn chạm ở mobile. |
| 4. Khung ảnh và album tĩnh | 39–49. Làm một lát cắt hoàn chỉnh với ảnh vòm và dải phim ba ảnh trước, sau đó triển khai các bố cục còn lại. Upload, crop, alt, thay từng ô, nhân bản, lưu và kiểm ảnh trong link quà. | 90 | 11 thẻ mới. Ô tùy chọn bỏ trống không cản gửi khi phần nội dung yêu cầu đã đủ. Ảnh công khai lấy đúng snapshot và đúng quyền. |
| 5. Tương tác | 91–100. Làm trước Thẻ lật và Hai cửa chọn câu chuyện để xác minh hai kiểu hành vi trong cảnh và chuyển cảnh. Tiếp tục vé cào, thư gấp, album, thanh so sánh, điều ước, nến, ghép tim và đếm ngược. | 100 | 10 thẻ phản hồi đúng trên touch, chuột và bàn phím. Có đường bỏ qua cử chỉ, nhãn trạng thái và kiểm thử điều kiện dữ liệu. |
| 6. Hiệu ứng | Giao trước bóng giấy, hiện dần, hòa mờ, mở nắp phong bì và pháo giấy để thử trọn hành trình. Hoàn thiện đủ S01–S04, E01–E04, A01–A04, T01–T04, B01–B04, R01–R04. | 100 + 24 tùy chọn | Kiểu tĩnh, chuyển động bình thường và giảm chuyển động đều có bằng chứng. Rời cảnh/đóng preview dừng ngay tác vụ cũ. |
| 7. Hồi quy và bàn giao | Xem đủ ba kịch bản mẫu, V1 và tài liệu mới, Sender/Creator, preview/public. Kiểm hai đường thumbnail DOM và cover SVG, hiệu năng bảng Thêm, lưu/khôi phục nháp và quyền link quà. | 100 + 24 tùy chọn | Xuất bảng đếm thực tế, ma trận đã chạy, ảnh desktop/mobile, số đo và phần còn thiếu bằng chứng. |

### Quyết định kỹ thuật theo chức năng

- **Dữ liệu thư viện.** Mỗi thẻ có ID ổn định, tên tiếng Việt, nhóm, từ khóa, ảnh xem trước tĩnh và hàm tạo. Dùng preset từ các lớp sẵn có cho bưu thiếp, vé hẹn, thực đơn, dòng thời gian và thẻ rẽ nhánh khi đáp ứng được đặc tả. Đồ họa mới dùng họa tiết do dự án quản lý, có nguồn/quyền sử dụng rõ. Bảng Thêm chỉ hiển thị hành vi mà người gửi có thể thực hiện ở ngữ cảnh đó hoặc giải thích trạng thái khóa hiện có.
- **Thẻ nhiều ô ảnh.** Ô ảnh có ID bền vững, dữ liệu crop/alt riêng, ánh xạ layer theo ID qua save, duplicate và redo. Polaroid cũ có placeholder được nhận dạng bằng nhãn trợ năng. Ô mới cần quan hệ tường minh để đổi tên hay bản địa hóa vẫn tìm được đúng ảnh. Nếu asset nằm trong danh sách của gallery, cập nhật bộ thu thập asset dùng chung và toàn bộ đường copy, kiểm quyền, public projection, thu hồi, backup. Mẫu Creator đã duyệt tiếp tục cấp quyền đúng binding và photoId được duyệt.
- **Trạng thái tương tác.** Chọn mặt thẻ, vị trí cào, trang ảnh, lựa chọn lời chúc hoặc mảnh ghép thuộc lần xem. Đề xuất về trạng thái đầu khi rời rồi quay lại cảnh hay bấm Xem lại. Nút tương tác thao tác được khi chuyển động đã tắt. Nội dung mặt ẩn ra khỏi thứ tự Tab. Caption, thư dài và nội dung sau khi bật mí phải tham gia tính lại chiều cao để không che phần sau.
- **Các trường hợp đặc biệt.** Album có nút Trước/Sau và trạng thái “Ảnh i/n”. So ảnh có thanh trượt dùng phím và mô tả cho cả hai ảnh. Hai cửa cần hai đích tồn tại, xử lý nhân bản/xóa cảnh. Đếm ngược lưu thời điểm tuyệt đối kèm múi giờ người gửi đã chọn, xác minh giá trị nhập, hiển thị mốc hẹn dễ đọc, ngừng bộ đếm khi đến giờ hoặc khi rời cảnh. Trình đọc màn hình chỉ nhận thông báo khi đến mốc có ý nghĩa.
- **Ghi và đọc phiên bản.** Các reader hiện chấp nhận V1, nơi publish gắn schemaVersion/runtimeVersion cố định, publicDocument liệt kê trường được xuất. Chọn một phiên bản tương thích cho tài liệu dùng tính năng mới và xác định rõ khi nào nâng một nháp. Dùng chung validator và bảng khả năng giữa editor, API, publish và player. Thử reader V1 với snapshot cố định và lưu lại nháp cũ chưa dùng tính năng mới. Đối chiếu preview Designer, duyệt Creator/Admin, Catalog, reader public, restore và cache đang phục vụ. Vỏ khôi phục của editor có vòng đời phiên bản riêng. Có phương án ngừng ghi nội dung mới trong khi reader tiếp tục đọc cả hai phiên bản.
- **Giới hạn.** Chèn cụm gần ngưỡng kỹ thuật phải kiểm tất cả lớp và số byte trước khi commit thao tác, tránh chèn một phần. Giá trị hình, thời lượng, mật độ, màu và action được validator chung chấp nhận theo danh sách cho phép. Bề mặt tĩnh và template chỉ dùng tài nguyên mà ứng dụng quản lý. Giữ URL, nội dung người gửi và xử lý hồi đáp trong các contract hiện có.

Các đầu mối ngoài thư viện gồm [bộ rút trích ảnh và hợp đồng public](../web/js/shared/canvas/schema.js), [lưu và xuất bản thiết kế](../src/modules/designs/designs.service.mjs), [quyền mẫu Creator](../src/modules/catalog/creator-templates.mjs), [khôi phục nháp](../web/js/features/canvas-editor/session.js), [backup và restore](../scripts/dev/canvas-backup.mjs), [thumbnail trong editor](../web/js/features/canvas-editor/thumbnail.js), [ảnh bìa SVG](../web/js/shared/canvas/cover-svg.js).

## 6. Tiêu chí nghiệm thu cuối

| Hạng mục | Cách kiểm và bằng chứng |
|---|---|
| Đếm và chèn | Đếm chính xác 100 ID duy nhất trong catalog và 100 lựa chọn truy cập được trên bảng Thêm. Tổng 7 nhóm lần lượt 15, 14, 15, 21, 12, 8, 15 theo bảng mục 2. Chạy cả 100 factory, mỗi thẻ trên một nháp sạch hoặc fixture riêng. Mỗi lượt chèn có hình/nội dung/hành vi đúng. |
| Chỉnh và lưu | Với 100/100, tự động hóa chèn, xác thực, round-trip và thumbnail. Kiểm đủ dữ liệu ảnh/cảnh đích khi thử publish. Với từng họ hành vi, thao tác qua UI thêm, chỉnh, hoàn tác/làm lại, lưu, tải lại, xem thử và mở link quà thử. Kiểm thẻ trùng tên hoặc chỉ khác màu bằng đối chiếu thiết kế. |
| Tương tác và hiệu ứng | Từng khối 91–100 có ca thành công, dữ liệu thiếu nếu áp dụng, bàn phím/touch và reset. Từng mã S/E/A/T/B/R có ca cấu hình, lưu, phát đúng chỗ và tắt. So hình ảnh trước, khi kích hoạt và kết thúc với ít nhất một ca mỗi họ trên mobile/desktop. |
| Hiệu năng | Đo thời gian từ bấm Thêm tới khi nhóm đầu sẵn sàng và từ gõ tới khi kết quả đổi. Ghi thiết bị/trình duyệt, viewport, CPU, số lần, cold/warm. Ngân sách đề xuất để thử ở mobile 390 px, CPU giả lập chậm 4×, sau khi tải editor, là p95 ≤ 300 ms mở bảng và ≤ 100 ms lọc, với 20 lần mỗi phép đo. Đo lần đầu riêng. So lại với baseline 28 và báo số thực. |
| Khả năng tiếp cận | Kiểm 320, 390, 768 và 1440 px. Kiểm Tab, Enter/Space, phím mũi tên ở thanh trượt, focus sau mở/đóng và sau chuyển cảnh, chữ Việt dài, tên có dấu, crop/alt. Người dùng giảm chuyển động vẫn thực hiện được toàn bộ tác vụ. |
| Phiên bản và quyền | Đọc lại quà V1 và bản chụp mới, so nội dung/hành vi trước và sau. Kiểm link có quyền, bị thu hồi, nháp tự do, mẫu Creator khóa lớp/ô ảnh. Preview mô phỏng hồi đáp, public tuân thủ quyền. Xác minh backup/restore nếu phiên bản/ảnh mới đi vào bản chụp. |
| Công cụ và báo cáo | Chạy các script `npm run check`, `npm run build`, `npm test`, `npm run test:canvas`, `npm run test:canvas:browser`, `npm run test:templates`. Chạy `npm run test:canvas:mysql` và `npm run test:canvas:mysql:api` trên MySQL cô lập khi thay đổi lưu/đọc snapshot hoặc asset qua backend. Ghi trạng thái riêng cho source, unit, API/JSON, browser, MySQL và runtime public trên fixture. |

Phạm vi kế hoạch là thư viện và hiệu ứng cho thiệp web có thể sửa. Các số hiệu năng, danh sách hình mới và lựa chọn tương tác là đề xuất để triển khai. Bằng chứng hiện tại chỉ xác nhận 28 thẻ của baseline. Các phép thử publish và MySQL trong phần nghiệm thu dành cho môi trường cô lập của đợt triển khai.
