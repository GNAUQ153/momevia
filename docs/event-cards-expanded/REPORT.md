# Ba thiệp nhiều trang và hiệu ứng Canvas — 21/11/2026

Đã tích hợp trực tiếp vào ba ID `birthday-radiance`, `hai-phong-bi`, `proud-of-you` trên nhánh `plan/event-card-redesign`. Sinh nhật và tốt nghiệp có **5 trang**, cưới có **6 trang**. Các thay đổi được giữ cùng bản merge `50fda65` đã xuất hiện trên nhánh trong lúc làm việc. Không đổi giá, quyền, dữ liệu người dùng thật hoặc triển khai máy chủ.

Commit triển khai cục bộ: `26b1085` — thêm hiệu ứng Canvas và thiệp nhiều trang.

## Xem chuyển động thật

Bản xem tương tác mới chạy ở cổng thử riêng **4180**. Cổng 4178 tiếp tục giữ bộ dữ liệu QA trước đó. Bản mới dùng cùng mã nguồn và player của ứng dụng; không dùng HTML minh họa để giả chuyển động.

| Mẫu | Bản chạy tương tác | GIF ghi từ player | Ảnh tĩnh toàn bộ trang |
|---|---|---|---|
| Sinh nhật · 5 trang | [Mở xem thử](http://127.0.0.1:4180/template/birthday-radiance?preview=1) | [GIF](birthday-radiance-motion.gif) | [VI](birthday-radiance-full-vi.png) / [EN](birthday-radiance-full-en.png) |
| Cưới · 6 trang | [Mở xem thử](http://127.0.0.1:4180/template/hai-phong-bi?preview=1) | [GIF](hai-phong-bi-motion.gif) | [VI](hai-phong-bi-full-vi.png) / [EN](hai-phong-bi-full-en.png) |
| Tốt nghiệp · 5 trang | [Mở xem thử](http://127.0.0.1:4180/template/proud-of-you?preview=1) | [GIF](proud-of-you-motion.gif) | [VI](proud-of-you-full-vi.png) / [EN](proud-of-you-full-en.png) |

[Bảng bàn giao](index.html) ưu tiên hiển thị GIF. PNG là bảng ảnh tĩnh để xem bố cục, không phát animation. GIF có 321/358/322 khung hình thực lấy từ Chrome DevTools screencast; thời gian giữa các khung giữ theo bản ghi. Bộ ảnh đầy đủ chụp ở chế độ giảm chuyển động để đọc được toàn bộ nội dung. Ảnh album trong preview là ảnh minh họa AI, không phải ảnh người dùng thật.

## Các trang và cá nhân hóa

- Sinh nhật: bìa bánh/nến → hai đồng hồ → lá thư riêng → album → hồi đáp/xem lại.
- Cưới: hai phong bì → kỷ niệm → lời chúc → hai đồng hồ → album → hồi đáp. Hai thư vẫn mở độc lập theo mọi thứ tự và đều có đường về bìa.
- Tốt nghiệp: mũ/bằng → hai đồng hồ → lá thư ghi nhận nỗ lực → album → hồi đáp/xem lại.

Trong **Dùng mẫu**, người gửi có thể nhập hai ngày độc lập: đếm ngược tới ngày tương lai, và thời gian đã qua từ ngày kỷ niệm. Có lựa chọn múi giờ. Cả hai đều có thể bỏ trống; nháp mới không chứa ngày minh họa. Album có ba ô tải PNG/JPEG/WebP theo giới hạn ảnh sẵn có, kèm chú thích và mô tả. Có thể thay/bỏ từng ảnh. Album tự chuyển sau 5 giây khi có ít nhất hai ảnh, có nút tạm dừng, vuốt hoặc dùng nút Trước/Sau. Giảm chuyển động dừng tự chuyển ảnh; thông tin thời gian vẫn cập nhật.

Đã kiểm thực tế tải ba ảnh, nhập ngày, lưu, tải lại, đổi vị trí lớp ảnh, phát hành V2 và mở như người nhận. Khi tặng lại, ảnh và ngày riêng được làm sạch; artwork công khai đi kèm mẫu được giữ bằng kiểm hash và asset mới. Ba nháp/quà V1 có ảnh của đợt trước giữ nguyên snapshot và bố cục ba trang.

## Đã thêm vào bộ chọn Canvas

Bộ hiệu ứng chung tăng từ 24 lên **33**. Chín preset mới dùng được trong Canvas, không gắn cứng riêng vào ba mẫu:

| Nhóm trong Canvas | Preset mới | Đối tượng |
|---|---|---|
| Khi xuất hiện | **Ảnh ghép từ các mảnh**, **Ảnh hiện từ hạt tan** | Ảnh |
| Nhấn mạnh | **Ảnh xoay một vòng** | Ảnh |
| Khi vào cảnh | **Tan biến nhẹ**, **Nở rộ mở trang** | Cảnh |
| Không khí | **Bong bóng bay**, **Bướm bay**, **Pháo hoa rực rỡ**, **Hoa nở rộ** | Cảnh |

Chọn ảnh → bảng **Chỉnh** → **Khi xuất hiện/Nhấn mạnh**. Chọn cảnh → **Khi vào cảnh/Không khí**. Có tốc độ và mật độ theo cơ chế có sẵn; bấm **Xem thử**. Kiểm tra riêng đã chọn, lưu, xem thử từng preset và tải lại Canvas: [9 kết quả thực tế](canvas-effects-results.json), [ảnh Canvas](canvas-effects.png).

Các ảnh ghép mảnh chia thành 12 mảnh ảnh thật, giữ crop/chất liệu. Bong bóng dùng lớp sáng trong; bướm có hai cánh chuyển động; pháo hoa có nhiều đợt tia; hoa nở theo từng cụm. Các lớp trang trí không bắt sự kiện chạm. Hiệu ứng có giới hạn thời gian, hủy khi rời cảnh hoặc giảm chuyển động. Chữ đánh máy dùng cơ chế Unicode hiện có và nút bỏ qua; nội dung đầy đủ luôn có cho trình đọc màn hình. Album dùng chuyển ảnh xoay nhẹ theo phối cảnh. Các ID hiệu ứng cũ giữ nguyên hành vi.

## Bằng chứng và kiểm thử

| Nhóm | Kết quả |
|---|---|
| Build/check | PASS; 1.520 khóa VI/EN và 24 bìa ở mỗi ngôn ngữ |
| Unit | PASS, 377/377, gồm 33 hiệu ứng, optional clocks/photos và 21 mẫu ngoài phạm vi giữ nguyên |
| `test:templates` | PASS, thư viện mới/cũ, ảnh owned, CAS, locale, quyền đăng |
| `test:canvas:browser` | PASS, gồm toàn bộ 33 bộ chọn hiệu ứng, lưu/xem thử/tắt, Canvas/Creator/public/recovery |
| `test:browser` | PASS |
| MySQL cô lập | PASS, 13 ca gốc + ba mẫu create/save/publish/pin/regift trên MySQL 8.4.13 |
| Hành trình riêng ba thiệp | PASS, ảnh/ngày/lưu/gửi/nhận và 128 tổ hợp trang/ngôn ngữ/độ rộng, xem [JSON](browser-results.json) |
| Chín effect mới trong Canvas | PASS, chọn/lưu/xem thử/mở lại, xem [JSON](canvas-effects-results.json) |
| Bản ghi chuyển động | PASS, ghi được các effect đang chạy; bật giảm chuyển động hủy toàn bộ animation, xem [JSON](motion-results.json) |
| Mở preview trực tiếp | PASS, ba URL `?preview=1` mở đúng 5/6 trang và có animation đang chạy, xem [JSON](live-preview-results.json) |

Độ rộng đã thử: 320, 390, 768, 1440 px, trên Edge/Chromium Windows. Có kiểm cả chế độ thường và giảm chuyển động; chưa thử điện thoại vật lý hoặc Safari/iOS/Firefox. Bộ unit được chạy với `TEST_ACCOUNT_ENABLED=false` để tách cấu hình tài khoản thử trong `.env` của workspace. Không sửa `.env` hoặc thay quy tắc bảo vệ production để làm test xanh.

## Ảnh, skill và vận hành

Ba ảnh album minh họa mới do imagegen tạo theo phong cách ảnh chụp tự nhiên: nhóm bạn mừng sinh nhật, đôi bạn trong vườn cưới, nhóm bạn tung mũ tốt nghiệp. File WebP có hash trong tên dưới `web/assets/event-cards/`, đánh dấu `previewOnly`; nháp thật không dùng sẵn các ảnh này. Prompt mô tả ảnh chân dung dọc, bảng màu theo dịp, gương mặt/hành động tự nhiên, không chữ/logo/watermark; ảnh người gửi sẽ thay thế chúng.

`momevia-template-design`: lớp sửa được, binding chuẩn, snapshot/asset/quyền; `graphify`: đồ thị cũ chỉ định hướng, kiểm lại nguồn hiện tại; `animate`: chọn nhịp mở, chuyển cảnh và phản hồi, tái dùng token tốc độ; `animation-performance`: ưu tiên transform/opacity, chỉ dùng clip-path cho mở trang, không vòng JS mỗi frame, hủy đúng vòng đời; `imagegen`: tạo ảnh mẫu có chất liệu thực tế. Hiệu ứng bay/nở là đồ họa trang trí nội bộ; không nạp tài nguyên ngoài.

Nếu cần khởi động lại bản review: `node scripts/qa/event-card-fixture.mjs sync event-cards-live 4180`, rồi `node scripts/qa/event-card-fixture.mjs serve event-cards-live 4180`. Công cụ giữ riêng dữ liệu fixture và không sao chép dữ liệu người dùng trong workspace. Chỉ có commit cục bộ cho lượt này; không push, PR hay triển khai máy chủ.
