# Kế hoạch thiết kế lại ba mẫu thiệp Momevia

**Phạm vi đề xuất** · Ba mẫu trong thư viện Momevia Originals, mỗi dịp một mẫu. Mỗi mẫu có hai phác thảo bìa để so sánh, sau đó phát triển một phương án thành thiệp hoàn chỉnh. Thành phẩm dự kiến gồm **3 thiệp chỉnh sửa được, 9 cảnh và 6 ảnh bìa VI/EN**. Đây là kế hoạch triển khai, các tên và câu chữ dưới đây là đề xuất để duyệt.

**Mốc khảo sát** · `origin/main` tại `572cda7`, ngày 21/11/2026. Nhánh kế hoạch `plan/event-card-redesign` tách trực tiếp từ mốc này theo lựa chọn của chủ dự án.

## 1. Chọn mẫu gốc và định nghĩa thành công

| Dịp và mẫu gốc | Giá trị có sẵn | Thay đổi người dùng sẽ thấy |
|---|---|---|
| Sinh nhật · `birthday-radiance` | Bánh, ba nến, confetti, lời chúc và hồi đáp. | Bánh chiếm tâm bìa, tên người nhận thành một phần của thiệp sinh nhật. Một lần chạm mở lời chúc. |
| Đám cưới · `hai-phong-bi` | Hai phong bì thật, mở theo thứ tự tùy ý. Một phong bì chứa kỷ niệm, một phong bì chứa lời chúc. | Thiệp từ bạn bè/người thân gửi cho đôi bạn. Người nhận chọn đọc kỷ niệm hoặc lời mừng cưới trước. Hai tên đứng cùng nhau trên bìa. |
| Tốt nghiệp · `proud-of-you` | Bố cục huy chương và vòng lá cho nhiều dạng thành tích, bao gồm tốt nghiệp. | Một tấm áp phích mừng ra trường. Mũ tốt nghiệp và tấm bằng giúp nhận ra đúng dịp khi ảnh bìa thu nhỏ. |

Cả ba đang có giá 0 đồng trong dữ liệu mẫu. Phương án là cập nhật bố cục khởi tạo cho ba ID hiện hữu. Giữ danh tính mẫu, giá/quyền thực tế trên máy chủ, mục yêu thích và nội dung quà đã gửi. Thiệp cưới phục vụ việc **gửi lời chúc cho đôi bạn**. Thiệp tốt nghiệp phục vụ người thân, bạn bè hoặc thầy cô chúc một người vừa hoàn thành chặng học tập. Việc chuyên biệt hóa hai mẫu đang dùng được cho nhiều dịp cần được Chủ sản phẩm duyệt tại mốc 1.

## 2. Ba hướng thiết kế

### A. Sinh nhật · “Ước một điều đi!”

**Người gửi và sắc thái.** Một người bạn gửi thiệp vào ngày sinh nhật. Hình dung khoảnh khắc cả bàn kéo chiếc bánh về phía người nhận. Bìa phải gợi được khoảnh khắc ấy ngay cả khi xem ở chế độ tĩnh.

| Cảnh | Hình, chữ và hành động |
|---|---|
| Bìa | Chiếc bánh kem bất đối xứng, ba ngọn nến, giấy màu tập trung hai mép. Tên nằm trên dải giấy trước đĩa. Nhấn **Mở lời chúc**. |
| Lời chúc | Dải giấy trên bìa trở thành đầu tờ thiệp, khoảng giữa dành cho lời người gửi. Chữ ký nằm sau lời chúc theo thứ tự đọc. |
| Hồi đáp | Một mẩu giấy cuối buổi tiệc dành cho lời cảm ơn. Hiện hành động hồi đáp theo quyền của quà và nút xem lại. |

- **Hai phác thảo** · A1 nhìn ngang chiếc bánh, tên trên đĩa. A2 nhìn từ trên xuống, các lát bánh bao quanh lời mời. Ưu tiên A1 nếu tên dài và nến vẫn rõ ở bìa nhỏ.
- **Màu và chữ** · Kem `#FFF5DC`, san hô `#F56C60`, vàng `#FFD056`, xanh ngọc `#41BCAF`, tím mực `#362644`. Dùng tím mực cho chữ trên kem, màu sáng cho phần trang trí. Tiêu đề dùng `heading`, nội dung dùng `body`.
- **Lời mẫu VI / EN** · “Ước một điều đi, An!” / “Make a wish, An!” · “Tuổi mới, mong bạn có thật nhiều ngày vui như hôm nay.” / “Here’s to a year full of days as good as this one.” Tên và lời riêng đến từ dữ liệu người gửi.
- **Nhịp mở** · Nhấn chủ động rồi chuyển sang lời chúc bằng chuyển cảnh có sẵn. Giấy màu có thể tĩnh. Đưa thao tác thổi nến bằng micro ra ngoài phạm vi.

### B. Đám cưới · “Hai phong bì mừng ngày chung đôi”

**Người gửi và sắc thái.** Một người bạn có mặt trong hành trình của hai người. Niềm vui đến từ hai lá thư được viết riêng, nét vẽ tay và màu quả mọng. Giữ giọng thân mật, không giả định giới tính hoặc gọi một người là nhân vật chính.

| Cảnh | Hình, chữ và hành động |
|---|---|
| Bìa | Hai nhẫn lồng phía trên tên đôi bạn. Hai phong bì có nhãn **Một kỷ niệm** và **Một lời chúc**. Cả hai đều mở trực tiếp. |
| Một kỷ niệm | Giấy thư có nét kẻ bên lề, một đoạn kỷ niệm người gửi sửa được trong trình thiết kế. Nút **Về hai phong bì** đưa người nhận trở lại đúng chỗ. |
| Một lời chúc | Lời mừng cưới và chữ ký có chỗ riêng. Người nhận có thể hồi đáp khi được phép hoặc quay lại đọc lá thư kia. |

- **Hai phác thảo** · B1 hai phong bì xếp dọc như hai lá thư trên bàn tiệc. B2 hai phong bì lệch trục nối bằng một dải ruy băng. Ưu tiên B1 trên điện thoại nếu B2 khiến một phong bì trông như vật trang trí.
- **Màu và chữ** · Giấy ngà `#FFF8EB`, hồng phấn `#F4C9C4`, đỏ mâm xôi `#963851`, xanh lá `#47715C`, mực mận `#442638`. Dùng `serif` cho tên đôi bạn, `body` cho nội dung. Nhẫn và dấu niêm nằm ngoài vùng tên.
- **Lời mẫu VI / EN** · “Mừng ngày chung đôi, An & Minh” / “To An & Minh, on your wedding day” · “Mong hai bạn còn kể lại chuyện hôm nay thật nhiều lần.” / “May you tell the story of today for years to come.”
- **Cá nhân hóa** · Dùng một trường `recipientName` cho tên đôi bạn, thử cả hai tên dài. Kiểm tra người gửi sửa đoạn kỷ niệm và người nhận đọc hai thư theo cả hai thứ tự. Không cần thu thập địa điểm tiệc, danh sách khách hay RSVP.

### C. Tốt nghiệp · “Mũ bay, chương mới mở”

**Người gửi và sắc thái.** Gia đình hoặc bạn bè đứng dưới sân trường nhìn người nhận tung mũ. Giữ dải băng khen từ mẫu gốc, chuyển điểm nhìn sang chiếc mũ bay. Phần lời chúc ghi nhận một nỗ lực cụ thể và mở ra tương lai, tránh mặc định ngành học hay bằng cấp.

| Cảnh | Hình, chữ và hành động |
|---|---|
| Bìa | Một chiếc mũ lớn đi chéo từ trái dưới lên phải trên. Tua mũ tạo đường dẫn tới tên. Dải băng phía dưới mang dòng **Mừng bạn tốt nghiệp!** |
| Lời chúc | Tờ giấy cuộn mở thành lá thư. Dòng đầu ghi nhận công sức, khoảng trống tiếp theo dành cho lời riêng và chữ ký. Không in sẵn năm hoặc trường. |
| Hồi đáp | Một tấm bưu thiếp nhỏ từ người vừa tốt nghiệp. Người nhận hồi đáp hoặc xem lại theo quyền hiện hành. |

- **Hai phác thảo** · C1 áp phích tung mũ với một đường chéo lớn. C2 tấm bằng buộc ruy băng nhìn từ trên xuống. Ưu tiên C1 nếu người xem nhận ra tốt nghiệp mà không cần đọc chữ.
- **Màu và chữ** · Xanh đêm `#172849`, xanh trời `#79CEEF`, vàng nghệ `#FFC857`, kem `#FFF8E7`, hồng cam `#F78A79`. Chữ kem trên xanh đêm ở bìa, chữ xanh đêm trên kem ở lá thư. Tiêu đề dùng `heading`, thân bài dùng `body`.
- **Lời mẫu VI / EN** · “Mừng bạn tốt nghiệp, Linh!” / “Hats off to you, Linh!” · “Những buổi ôn bài muộn đã đưa bạn đến hôm nay. Tự hào về bạn!” / “Those late nights brought you here. So proud of you!”
- **Nhịp mở** · Đường chéo và tua mũ gợi chuyển động ngay khi ảnh đứng yên. Nhấn **Mở lời nhắn** để đọc. Khi giảm chuyển động, người nhận vẫn có cùng nội dung và thứ tự đọc.

## 3. Phân công và các phase triển khai

Ước tính **7 ngày làm việc** với một người thiết kế, một người phát triển Canvas và người phụ trách nội dung, QA, sản phẩm tham gia theo mốc. Đây là vai trò để giao việc, chưa gán tên nhân sự. Nếu một người kiêm nhiều vai trò, giữ thứ tự phụ thuộc và ước tính lại lịch sau phase 1.

| Phase | Thời điểm, người chịu trách nhiệm | Việc nhỏ cần làm | Sản phẩm bàn giao và điều kiện chuyển tiếp |
|---|---|---|---|
| 0 · Khảo sát | Ngày 1 sáng · Dev Canvas chủ trì, QA phối hợp | 0.1 Ghi 3 ID, giá/quyền thực tế trên fixture, metadata và phiên bản. 0.2 Chụp bìa và các cảnh VI/EN hiện hành. 0.3 Tạo một nháp đã sửa và một quà cũ cho mỗi ID để đối chiếu về sau. | Bộ ảnh trước thay đổi, 3 cặp dữ liệu thử, danh sách khóa cần giữ. Dev và QA cùng kiểm khả năng mở lại. |
| 1 · Khám phá và chọn hướng | Ngày 1 chiều – ngày 2 · Thiết kế chủ trì, Nội dung VI/EN viết, Chủ sản phẩm quyết định | 1.1 Vẽ sáu bìa A1–C2 ở khung điện thoại. 1.2 Xem ảnh thu nhỏ cạnh nhau, che nhan đề và nhờ 3 người ngoài nhóm ghép bìa với dịp. 1.3 Chốt một bìa, tên và giọng văn cho mỗi dịp. | Bảng 6 phác thảo kèm lý do chọn. Mục tiêu mỗi bìa được ít nhất 2/3 người nhận đúng dịp. Mẫu dễ nhầm được sửa nét nhận diện rồi thử lại. |
| 2 · Dựng kịch bản và bố cục | Ngày 3 · Thiết kế chủ trì, Nội dung + Dev rà | 2.1 Dựng 9 khung trên artboard 390 × 844. 2.2 Đánh dấu thứ tự đọc, vùng tên dài, nút và lớp người gửi có thể sửa. 2.3 Viết bản VI/EN riêng cho bìa, lời dẫn, nút và phần hồi đáp. 2.4 Kiểm nhánh quay lại của thiệp cưới. | 9 khung, bảng câu chữ hai ngôn ngữ và sơ đồ hành động. Dev xác nhận tất cả lớp và hành động dùng được trong Canvas V1. |
| 3 · Dựng mẫu chỉnh sửa được | Ngày 4–5 · Dev Canvas chủ trì, Thiết kế duyệt từng mẫu | 3.1 Dựng sinh nhật trước để kiểm quy trình tạo bìa và nháp. 3.2 Dựng cưới, thử độc lập hai phong bì. 3.3 Dựng tốt nghiệp, thử mũ và bằng ở kích thước nhỏ. 3.4 Kiểm fingerprint và giới hạn document. Nội dung rà bản dựng song song. | 3 bố cục tạo được nháp hợp lệ. Từ editor có thể đổi lời, đổi màu hoặc di chuyển họa tiết, lưu và mở lại đúng kết quả. |
| 4 · Nối thư viện và phiên bản | Ngày 5–6 · Dev Canvas chủ trì, người phụ trách Catalog rà dữ liệu | 4.1 Đồng bộ nội dung hiển thị và tìm kiếm cho VI/EN. 4.2 Sinh bìa từ chính document. 4.3 Kiểm máy có cache bìa cũ và thư viện đã có dữ liệu. 4.4 Chạy thử nháp cũ, quà cũ, thao tác tặng lại. | 6 ảnh bìa khớp với cảnh đầu. Tìm được ba mẫu bằng từ chỉ dịp ở từng ngôn ngữ. Có bằng chứng bảo toàn dữ liệu và quyền. |
| 5 · Nghiệm thu và bàn giao | Ngày 6–7 · QA chủ trì, Thiết kế và Chủ sản phẩm ký duyệt | 5.1 Chạy ma trận dưới đây trên bản dựng. 5.2 Sửa lỗi theo mẫu, chạy lại đúng hành trình gặp lỗi. 5.3 So ảnh trước/sau, ghi hạn chế thiết bị và kết quả thật. 5.4 Lập danh sách thay đổi để rà trước khi phát hành. | Bộ ảnh, kết quả kiểm tra, danh sách lỗi đã đóng/còn mở. Chỉ đề xuất phát hành khi cả ba mẫu đạt các tiêu chí bắt buộc. |

**Phụ thuộc.** Phase 3 bắt đầu khi ba hướng đã chốt và hành động được đối chiếu với schema. QA chuẩn bị dữ liệu cũ từ ngày 1. Có thể rà nội dung và tích hợp bìa sinh nhật trong lúc dựng hai mẫu còn lại. Nếu chậm lịch, cắt chuyển động trang trí trước, giữ đủ ba dịp, hai ngôn ngữ và luồng gửi/nhận.

## 4. Hướng dẫn triển khai trong Momevia

1. **Dùng đúng điểm dựng mẫu.** Đối chiếu `web/js/shared/canvas/basic-templates.js` cho hai phong bì và các cảnh dùng chung, `collection-2027.js` cho bìa sinh nhật/tốt nghiệp, `presets.js` cho luồng tạo. Giới hạn thay đổi theo ID để 21 mẫu còn lại giữ nguyên bố cục. Mỗi trang trí chính là layer riêng, có tên dễ chọn trong editor. Dựng nhẫn bằng hai vòng, mũ và tua bằng hình/đường xoay, bằng tốt nghiệp bằng cuộn giấy. Sticker mở rộng M55 thuộc V2. Phương án cơ sở dùng các thành phần V1 hợp lệ theo `schema.js` và `registry.js`.
2. **Tách lời minh họa khỏi nháp cá nhân.** Lưu câu giao diện ở `web/assets/locales/vi.json` và `en.json`, dùng các trường `recipientName`, `senderName`, `message`. Nội dung kỷ niệm trong phong bì đầu là lớp chữ có thể sửa. Ví dụ ở mục 2 dùng trong preview hoặc gợi ý. Nháp mới có các binding sạch và vẫn gửi được sau khi điền lời chúc mà không tải ảnh. Dùng token chữ, hành động mở cảnh/quay lại và cơ chế hồi đáp sẵn có.
3. **Chọn đúng đường tìm kiếm.** Trang `/explore` đang tìm theo tiêu đề, mô tả, phong cách và danh mục đã dịch. Hai phong bì đang nhận danh mục Sinh nhật mặc định từ `src/modules/catalog/seed.mjs`, còn Proud of You thuộc Chúc mừng. Dev Catalog bổ sung cách hiển thị và tìm đúng dịp cho các ID hệ thống trên cả dữ liệu mới lẫn cũ. Ưu tiên ánh xạ có kiểm tra ID/chủ sở hữu/giá trị hệ thống cũ. Nếu cần cập nhật bản ghi, lập thử danh sách thay đổi trên fixture JSON/MySQL, giữ giá, trạng thái và các giá trị đã tùy chỉnh. Sửa seed đơn thuần chỉ ảnh hưởng bản ghi mới. Ô tìm kiếm hiện tại đủ cho phạm vi này.
4. **Tạo bìa và kiểm phiên bản.** `scripts/build/template-previews.mjs` sinh SVG theo document cho từng ngôn ngữ. Chạy `npm run build`, xem 6 bìa trên nền thư viện thực. Kiểm tham số phiên bản bìa tại `web/js/features/catalog/template-copy.js` để trình duyệt có bản cũ tải đúng bìa mới. Đối chiếu fingerprint bố cục mới, phiên bản nguồn do máy chủ cấp, chủ sở hữu và quyền. VI/EN của cùng bố cục cần nhận đúng phiên bản nguồn.
5. **Bảo toàn quà cũ.** Thử mở nháp đã chỉnh, mở link của quà đã gửi và dùng “Tặng người khác từ bố cục này” trên cả ba fixture cũ. Luồng tặng lại có thể gặp lỗi 409 nếu đòi đúng phiên bản nguồn cũ. Nếu gặp, lưu ca tái hiện bằng fixture, xử lý đường chọn phiên bản được phép và kiểm lại với người gửi. Không âm thầm đổi nội dung, xóa nháp hay chuyển sang mẫu trắng. Nếu cần lùi bản phát hành, khôi phục bộ preset, locale, bìa và phiên bản cache tương ứng rồi thử cả snapshot trước và sau thay đổi.

## 5. Ma trận nghiệm thu và bằng chứng

| Nhóm | Cách kiểm và tiêu chí đạt | Bằng chứng / người phụ trách |
|---|---|---|
| Nhận diện | Xem cạnh nhau ở chiều rộng bìa khoảng 150 px. Phân biệt được bánh sinh nhật, hai thư mừng cưới, mũ tốt nghiệp. Tên dài không đè hình chính hay nút. | Bảng phác thảo, kết quả thử nhận diện, bảng ảnh bìa cuối · Thiết kế |
| Câu chữ | Cả 3 mẫu × 2 ngôn ngữ. Thử tên ghép dài có dấu, tên đôi dài, lời nhiều đoạn và tên người gửi. Khi đổi ngôn ngữ, nhãn được dịch, nội dung riêng giữ nguyên. | Ảnh từng trường hợp, danh sách khóa VI/EN · Nội dung |
| Điện thoại, bàn phím | Rà tại 320, 390, 768, 1440 px. Chữ tràn được đọc tiếp, nút còn trong luồng, vùng chạm mục tiêu 44 px, tương phản chữ thường mục tiêu 4,5:1. Kiểm Tab, Enter/Space, quay lại, đóng preview trả focus và chế độ giảm chuyển động. | Ảnh và ghi nhận thiết bị/trình duyệt đã thử · QA giao diện |
| Thư viện và bản xem trước | Tìm “sinh nhật / birthday”, “đám cưới / wedding”, “tốt nghiệp / graduation” trên fixture cũ và mới. So bìa, giá, mục yêu thích, nút dùng mẫu. Preview hiển thị dữ liệu minh họa, hồi đáp ở chế độ mô phỏng. | 6 ảnh bìa, kết quả tìm kiếm và đối chiếu metadata · Dev Catalog + QA |
| Chỉnh sửa và gửi | Mỗi mẫu tạo nháp mới, sửa tên/lời chúc và một lớp trang trí, lưu, tải lại, nhân bản và phát hành trong môi trường thử. Người nhận mở đúng cảnh. Riêng mẫu cưới mở hai phong bì ở cả hai thứ tự. Thử quà bật/tắt quyền hồi đáp. | 3 hành trình từ thư viện đến người nhận, bằng chứng cho hai nhánh cưới · QA chức năng |
| Tương thích và dữ liệu | Kiểm hợp lệ khi lưu/đăng, ID duy nhất, đích chuyển cảnh tồn tại, thứ tự đọc hợp lý. Tổng vẫn là 24 mẫu ở mốc khảo sát. So bố cục chuẩn của 21 mẫu ngoài phạm vi. So nháp và quà cũ, quyền và luồng tặng lại. | Kết quả so fixture trước/sau cùng danh sách ID, trạng thái và bằng chứng cho từng luồng · Dev + QA |

**Chạy kiểm tra khi có bản triển khai.** Dùng `npm run build` → `npm run check` → `node --test tests/unit/basic-templates.test.mjs tests/unit/seasonal-viral.test.mjs tests/unit/catalog-filter.test.mjs` → `npm run test:templates` → `npm run test:canvas:browser`. Bổ sung `npm run test:browser` cho điều hướng và locale, `npm run test:canvas:mysql` trong MySQL thử nghiệm nếu chạm dữ liệu/phiên bản nguồn. Ghi chính xác môi trường và ca chưa chạy. Chỉ bổ sung bài kiểm thử cho tình huống chưa được các bộ hiện tại bao phủ, nhất là metadata cũ và tặng lại sau đổi bố cục.

**Quyết định nghiệm thu.** QA giữ danh sách cho từng ID và ngôn ngữ. Lỗi mất nội dung/quyền, thay đổi quà đã gửi, sai dịp, không mở được cảnh, không đọc được lời chúc hoặc không dùng được nút trên điện thoại phải được sửa và thử lại trước phát hành. Gói bàn giao gồm ba mẫu, sáu bìa, bảng ảnh trước/sau, đường dẫn mẫu trong môi trường thử và kết quả nghiệm thu của từng vai trò.
