# Ba thiệp tương tác Momevia — bàn giao 21/11/2026

Nhánh `plan/event-card-redesign`, bắt đầu đúng commit `6c09d33` và thư mục sạch. Không có thay đổi sau kế hoạch tại thời điểm bắt đầu. Phạm vi: ba ID cũ, mỗi ID ba cảnh, hai ngôn ngữ, sáu bìa; giữ 24 mẫu trong thư viện. Theo góp ý tiếp theo của chủ sản phẩm, bản cuối dùng **ảnh có chất liệu và chiều sâu** thay cho hình khối lớn: bánh kem, giấy phong bì/dấu sáp/ruy băng, mũ và bằng tốt nghiệp. Chữ, nút và ảnh là các lớp độc lập.

Commit triển khai cục bộ: `a7f80bd` — `feat(canvas): ship three photographic event cards with bilingual flows`. Bộ bằng chứng và công cụ QA được commit riêng ngay sau đó.

[Mở bảng bàn giao bằng trình duyệt](index.html) · [Sáu phác thảo](sketches/comparison.html) · [Sáu bìa cuối](final-covers.png) · [Bản đồ chín cảnh](scene-map.json) · [Nguồn ảnh và prompt](IMAGE_ASSETS.md).

## Mở và dùng

Môi trường dữ liệu thử cô lập đang phục vụ tại `http://127.0.0.1:4178`. Đây là bản ứng dụng thật chạy từ bản sao nguồn của nhánh, với tài khoản, nháp, quà và ảnh thử riêng; không dùng `.env` hay dữ liệu của workspace.

| Dịp | Trang mẫu | Thao tác |
|---|---|---|
| Sinh nhật | http://127.0.0.1:4178/template/birthday-radiance | Xem thử → Mở lời chúc → Hồi đáp/xem lại |
| Đám cưới | http://127.0.0.1:4178/template/hai-phong-bi | Xem thử → Một kỷ niệm / Một lời chúc → Về hai phong bì |
| Tốt nghiệp | http://127.0.0.1:4178/template/proud-of-you | Xem thử → Mở lời nhắn → Hồi đáp/xem lại |

`Dùng mẫu` mở cá nhân hóa nhanh, `Chỉnh bố cục` mở Canvas Designer. Có thể đăng ký tài khoản thử hoặc chọn đăng nhập demo trên trang đăng nhập. Trong mẫu cưới, ô **Nội dung kỷ niệm** hỗ trợ nhiều đoạn. Tên đôi dùng chung `recipientName`.

Nếu cần khởi động lại fixture từ repo: `node scripts/qa/event-card-fixture.mjs sync`, rồi `node scripts/qa/event-card-fixture.mjs serve`. Lệnh sync chỉ cập nhật code, giữ dữ liệu thử đã lưu. Không chạy lại script baseline để thay mốc cũ. Không có push, PR hay triển khai máy chủ.

## Quyết định thiết kế và các phase

| Phase | Kết quả |
|---|---|
| 0 | Lưu metadata và hash của 24 preset; chụp 18 ảnh cảnh cũ VI/EN; tạo ba nháp đã sửa và ba quà đã phát hành bằng bản cũ trong fixture. Snapshot nguồn ở `tests/fixtures/event-cards-before.json`, dữ liệu tài khoản/cookie chỉ ở `local/event-cards`. |
| 1 | Sáu SVG A1/A2, B1/B2, C1/C2 và bảng đối chiếu tại 150 px. Chọn A1 vì bánh/nến rõ và có dải tên riêng; B1 vì hai thư có trọng lượng ngang nhau trên điện thoại; C1 vì mũ/tua nhận ra tốt nghiệp mà không cần đọc tiêu đề. Tự rà, chưa có người tham gia thử nhận diện. |
| 2 | Chín cảnh trên 390 × 844, thứ tự đọc, tọa độ nội dung, đích nút, vùng chữ dài và danh sách lớp được ghi trong `scene-map.json`; bản chú giải SVG ở `storyboard/`. Nội dung VI/EN riêng từng dịp. |
| 3 | Canvas V1, ba binding chuẩn, lớp ảnh chọn/di chuyển/thay được; không gộp thiệp thành một ảnh. Bìa cưới có hai ảnh phong bì riêng và hai nút ngang nhau. Chưa nhập nội dung cá nhân thì nháp giữ binding rỗng. Câu chuyện minh họa chỉ nằm trong preview. |
| 4 | Danh mục và tìm kiếm VI/EN đúng trên seed mới và bản ghi cũ. Dùng phép chiếu đọc có kiểm ID/chủ hệ thống/giá trị mặc định cũ, không ghi đè DB. Sáu bìa sinh từ document đã validate; cache chuyển sang v5. Tái hiện và sửa lỗi 409 khi tặng lại quà cũ. |
| 5 | Ma trận 320/390/768/1440 px, tên đôi dài, lời nhiều đoạn VI/EN, gửi/nhận, quyền hồi đáp, nháp/quà cũ, cache cũ, MySQL cô lập và các bộ hồi quy. |

Sinh nhật dùng kem/san hô/vàng/xanh ngọc, lời mở “Ước một điều đi!”. Cưới dùng giấy ngà, mâm xôi và lá xanh, giọng chúc đôi bạn từ người thân/bạn bè. Tốt nghiệp dùng xanh đêm/vàng/xanh trời và ghi nhận nỗ lực, không gắn năm, trường hay bậc học.

## Nghiệm thu từng mẫu

| Hạng mục | Sinh nhật | Đám cưới | Tốt nghiệp |
|---|---|---|---|
| Tìm đúng dịp VI/EN, thư viện cũ/mới | Đạt | Đạt | Đạt |
| Ba cảnh và bìa VI/EN | Đạt | Đạt | Đạt |
| 320/390/768/1440 px, tên dài/nhiều đoạn, không cắt chữ hoặc tràn ngang | Đạt | Đạt, tên đôi tiếng Việt dài | Đạt |
| Chỉnh lời và vị trí lớp ảnh; lưu, tải lại | Đạt | Đạt, sửa cả kỷ niệm | Đạt |
| Dùng mẫu / Chỉnh bố cục | Đạt | Đạt | Đạt |
| Gửi từ UI VI và UI EN; mở bằng trình duyệt người nhận ẩn danh | Đạt | Đạt | Đạt |
| Hồi đáp thật bật, form ẩn và API từ chối khi tắt; preview chỉ mô phỏng | Đạt | Đạt | Đạt |
| Bàn phím và vùng chạm mục tiêu ≥44 px ở player | Đạt | Đạt, hai thứ tự mở thư | Đạt |
| Giảm chuyển động và chặn tải ảnh | Đạt | Đạt | Đạt |
| Nháp cũ / quà cũ / tặng lại | Đạt | Đạt | Đạt |

`browser-results.json` ghi hành trình riêng từng mẫu; `guardrail-results.json` ghi gửi EN trên điện thoại mô phỏng, player thật ở bốn độ rộng, CPU 4× và cache HTTP thật. 72 tổ hợp cảnh/ngôn ngữ/độ rộng có tên/lời dài được kiểm bằng chính renderer chung; hành trình UI đầy đủ được chạy riêng VI/EN. Ảnh `after/*-long-320-*.png` cho thấy văn bản nối dài theo luồng; ảnh `*-en-public-*.png` lấy từ quà đã phát hành thật trong fixture.

## Dữ liệu, ảnh và tương thích

- Giá 0 ở seed của ba mẫu được giữ; giá/quyền thực tế luôn do Catalog/checkout quyết định. Không ghi lại giá, trạng thái, yêu thích hay metadata đã tùy chỉnh. Bản ghi Creator không nhận phép chiếu hệ thống.
- 21 mẫu ngoài phạm vi giữ nguyên hash document và metadata so với mốc. Sáu ảnh bìa được tạo bởi pipeline sẵn có, ảnh WebP được nhúng nội bộ vào SVG, không có URL bên ngoài.
- Mỗi ảnh có tên tệp chứa hash, kiểm SHA-256 trước khi tạo nháp. Máy chủ tạo bản sao asset riêng cho nháp và commit asset/refs cùng giao dịch sẵn có. Preview chỉ cho phép đúng các đường dẫn ảnh hệ thống trong danh sách cố định. Quà phát hành ghim snapshot và bytes ảnh, người nhận dùng endpoint ảnh của quà.
- Lỗi 409 của cả ba quà cũ được tái hiện trước khi sửa. Tặng lại giờ kiểm nguồn/quyền hiện tại, giữ hình học snapshot, xóa tên/lời/kỷ niệm/ảnh cá nhân. Chỉ ảnh có hash trùng artwork công khai đi kèm mẫu mới được giữ và cấp asset mới. Không hạ quyền Creator; tạo mới trực tiếp từ fingerprint cũ vẫn bị từ chối.
- Nháp cũ và quà cũ giữ nguyên document, source, policy, quyền và nội dung. Không materialize lại khi GET/reload nháp đã sửa.
- Nền trong suốt của ảnh chỉ áp dụng cho artwork mới có marker phiên bản riêng; ảnh trang trí legacy giữ cách hiển thị cũ. Có kiểm tra trình duyệt đối chiếu hai trường hợp.

## Skill đã áp dụng

| Skill | Quyết định cụ thể |
|---|---|
| `momevia-template-design` | Giữ ID/giá/quyền, Canvas V1 và các binding chuẩn; ảnh/chữ/nút tách lớp; preview dùng chung player với quà thật; bảo toàn snapshot và CAS. |
| `graphify` | Truy đồ thị có sẵn từ Catalog/template tới draft/gift; đồ thị cũ chỉ cung cấp định hướng (525 nút, kết quả truy 9 nút, không đủ cạnh để chứng minh toàn chuỗi). Đối chiếu lại toàn bộ chuỗi trong mã nhánh hiện tại. |
| `animate` | Thao tác mở là hiếm, mục đích báo đổi trạng thái và dẫn tới lời chúc. Chọn chuyển cảnh trực tiếp của V1 và focus nội dung; không thêm vòng chuyển động trang trí, không nâng V2 chỉ để lấy hiệu ứng. Giảm chuyển động giữ nguyên nội dung/đường đi. |
| `animation-performance` | Dùng cơ chế có sẵn, không thêm thư viện, không animation layout/blur/will-change. Kiểm player thật ở 320 px, normal/reduced motion, CPU mô phỏng 4×; số đo là thời gian tới khung hình thứ hai sau đổi cảnh, không phải chứng nhận FPS điện thoại. |
| `imagegen` | Tạo ba ảnh mang chất liệu thật, nền alpha, không chữ; tối ưu WebP và đưa vào lớp image V1. Prompt và hash nằm trong `IMAGE_ASSETS.md`. |

Chuỗi đã xác nhận trong mã: `catalog/seed.mjs` + `event-metadata.mjs` → `template-preview.js`/`templatePreviewDocument` → `presets.js`/`paintEventCard` → `DesignsService.source/create` + `materializeBuiltinMedia` → Designer/save CAS → publish snapshot/asset pins → `gift-runtime`. Tặng lại đi qua `DesignsService.regift` và `cleanGiftLayout`.

## Kiểm thử và giới hạn

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` | PASS, 1.420 khóa VI/EN, 24 bìa mỗi ngôn ngữ |
| `npm run check` | PASS |
| `basic-templates`, `seasonal-viral`, `catalog-filter`, `event-cards` | PASS, 28 bài trong nhóm này |
| `npm test` | PASS, 372/372 |
| `npm run test:templates` | PASS, thư viện mới/cũ, ảnh owned/private, lưu/đăng, locale, cached-server CAS |
| `npm run test:canvas:browser` | PASS, gồm Canvas, Creator, hồi phục/CAS, 172 thẻ, 24 hiệu ứng và hai thư cưới |
| `npm run test:browser` với Edge | PASS |
| `test:canvas:mysql` qua wrapper DB cô lập | PASS, 13 ca gốc; thêm tìm dịp trên Catalog cũ và cả ba mẫu ảnh create/save/publish/pin/regift trên MySQL 8.4.13 |
| Hành trình riêng ba mẫu và cache/ảnh lỗi | PASS, xem JSON bằng chứng |

Thiết bị đã thử: Microsoft Edge/Chromium trên Windows với viewport mô phỏng, gồm touch, giảm chuyển động và CPU 4×. Chưa thử điện thoại vật lý, Safari/iOS, Firefox hay người dùng ngoài nhóm. Chưa có thử nhận diện với ba người; đây là phần cần đánh giá tiếp. Không coi các mô phỏng là kết quả trên thiết bị thật.
