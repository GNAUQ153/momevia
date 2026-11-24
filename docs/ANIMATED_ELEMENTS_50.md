# 50 element động và nhiều chuyển động trên một vật thể

Đã tích hợp trên nhánh `feat/animated-elements-50-20261124`, mã cục bộ và MySQL QA riêng. Không đẩy Git, không triển khai dịch vụ hay cập nhật dữ liệu người dùng thật.

## Xem và sử dụng

- [Thiệp QA đủ mở quà → lời chúc/ảnh → hồi đáp](http://127.0.0.1:4191/g/oxGNTc6dib_gC1ypppbXX1yjgMTt4qpH). Có thể mở ẩn danh; Enter mở hộp, thao tác chạm chuyển cảnh và gửi hồi đáp QA.
- [Quà QA chứa đủ 50 mẫu](http://127.0.0.1:4191/g/jBdDk9eInx-JSyuTIonYJG_xIHJ15vN6), năm cảnh với mười vật thể/cảnh; đây là trang xem mẫu.
- [Tim hai chuyển động](http://127.0.0.1:4191/g/6qUDgW1j7EB-M1gaaL_GUsTIn5DIK-Cc).
- Studio QA: [thiết kế đủ 50 mẫu](http://127.0.0.1:4191/design/37b72c06-a074-4009-835b-dafa40e4b449); cần phiên đăng nhập của tài khoản QA. Vào **Thêm → Chuyển động**, tìm bằng VI có dấu, không dấu hoặc tên EN. **Xem trước** ngay trong thư viện không ghi nháp; chọn mẫu để chèn một vật thể. Mở **Chỉnh → Chuyển động trên vật thể** để thêm/xóa, bật/tắt hoặc phát thử từng dòng.
- [Bảng đủ 50 ID và kết quả](animated-elements-50/acceptance.md), [ảnh tổng quan sáng](animated-elements-50/contact-sheet-light.png), [nền tối](animated-elements-50/contact-sheet-dark.png), [thumbnail 64 px](animated-elements-50/contact-sheet-thumbnails.png).

## Mốc so sánh và dữ liệu thật

Kho ban đầu sạch, nhánh `main`, HEAD `527e646`, sau mốc tham khảo `2fc7cbf`. Nguồn dựng sẵn ban đầu có 480 hàng thư viện, 243 element, 6 mục chuyển động. Cổng QA tham khảo cũ 4121 trả 200 nhưng không có danh mục DB để đếm; không dùng mốc đó làm bằng chứng MySQL.

MySQL QA đo được trước cập nhật **243 element / 6 chuyển động**; sau cập nhật **293 element / 56 chuyển động**, tổng 530 hàng active. Trong đó đúng 50 ID mới, nhóm thực tế 10 / 10 / 10 / 10 / 10. Tim giữ ID `natural-motion-heart`, là bản nâng cấp riêng. 51 định nghĩa trả qua API cuối cùng được so đầy đủ với định nghĩa dựng sẵn; 35 file runtime/Studio/server trùng SHA giữa nguồn bàn giao và bản QA phục vụ. Xem [verified-summary.json](animated-elements-50/verified-summary.json), [source-fingerprints.json](animated-elements-50/source-fingerprints.json).

## Contract và kết hợp

- Giữ reader Canvas 1/2/3; chỉ tài liệu có `motions` hoặc `assembly` dùng schema/registry 4. Danh sách chuyển động và bộ phận đều có `version:1`. Lưu nháp, public allowlist, clone và snapshot giữ hai cấu trúc đó.
- Tối đa 3 dòng chính, tính cả emphasis cũ nếu còn dùng; xuất hiện và phản hồi ở các lớp riêng. 12 bộ phận/vật thể, tối đa 24 track, 16 mốc/track; giới hạn 256 KiB, 400 element, 32 cảnh vẫn giữ. Hai mẫu hạt cục bộ dùng 6 hình/hạt cố định, không timer phát hạt, không RNG; seed quy ước 0.
- Mỗi dòng có ID, loại được duyệt, target whole/part, neo cục bộ 0–1, trigger scene, delayMs, periodMs, iterations, enabled, direction, amplitude. Chu kỳ 300–30000 ms; mỗi độ trễ 0–10000 ms; số vòng 1–5 hoặc infinite; amplitude 0–1 cho choreography đã vẽ, 0–2 cho nhịp đơn. X/y dùng đơn vị trên khung cục bộ 100×100, giới hạn ±35; góc theo độ ±720; scale .05–2; opacity/draw 0–1. Tất cả số phải hữu hạn.
- Ngoài cùng giữ layout, góc thiết kế và vùng bấm. Trong cùng mỗi lớp dùng T·R·S; dòng đầu ở trong, dòng sau bọc ngoài theo thứ tự danh sách. Góc quay cùng tâm cộng lại, scale/opacity nhân nhau. Hai dòng cùng thuộc tính không ghi đè nhau. Xuất hiện, emphasis cũ và phản hồi có lớp riêng để cùng tồn tại với các dòng mới.
- Dùng WAAPI và cùng motion controller trong Studio, Admin preview và player. Giữ pha theo element ID + row ID + track ID khi dựng lại Studio; sửa dòng hoặc phát thử dòng không đặt lại dòng khác. Đổi cảnh hủy hoạt ảnh cũ và bắt đầu cảnh mới; dispose/cancel hủy cả fill của đoạn chạy một lượt. Các đoạn một lượt giữ tư thế cuối đến khi rời cảnh.
- Vật thể ghép là một shape được duyệt, chứa đường path và các bộ phận/neo nội bộ. Hạt được giới hạn trong object; tuyết và vân hành tinh có clip ellipse, ảnh máy ảnh có clip rect tại khe. Không HTML, JS, CSS hoặc URL tùy ý trong document; pipeline ảnh một khung giữ nguyên.
- Ảnh, sticker, shape, line và button/envelope/gift-box phù hợp có thể thêm dòng. Reply và tương tác có nhiều input giữ quy tắc riêng; envelope ảnh/chú thích có bố cục đặc biệt được loại khỏi bộ này. Đồ trang trí không bắt focus/chặn chạm. Bảng di động dùng cùng trường có nhãn, thao tác Space bật/tắt đã thử.

## Tim và tương thích

Tim mới bật sẵn Đập (1800 ms) và Xoay quanh tâm (8000 ms, cùng chiều kim đồng hồ). Nhịp có scale 1.055 ở 18% và 1.04 ở 48%; easing áp dụng theo đoạn để hai đỉnh nằm đúng mốc. Xoay đều 360°, tách khỏi layout và nhịp đập; đây là tự xoay, khác quỹ đạo.

Với góc thiết kế 20°, ma trận đo tại 0/2/4/6/8 giây cho 20/110/200/290/20° (sai số <.02°); tâm lệch <.5 px. Hai đỉnh đo được 1.055000 / 1.040000. Đổi chiều được đo −90° sau hai giây trên lớp quay. Có bằng chứng tắt riêng từng dòng, lưu all-off/reload, ba dòng, undo/redo, nhân bản, copy/paste, khóa lớp, kéo/đổi cỡ, surface và entrance. [qa-report.json](animated-elements-50/qa-report.json), [controls-qa.json](animated-elements-50/controls-qa.json).

Sáu fixture vòng lặp cũ giữ riêng; nháp cũ có thể tự thêm spin. Nút bật lặp của nháp cũ đã được kiểm riêng: giữ hiệu ứng xuất hiện, giữ schema 2 và không tự thêm vòng xoay. Snapshot cũ không lấy chuyển động mới từ thư viện. A05 thực tế vẫn chạy đúng một lượt 640 ms rồi dừng. All-off lưu được và ngừng cả legacy emphasis lẫn dòng mới; tim tĩnh đo 19.99998°, scale 1.000000, 0 bộ phát dòng. Bật lại chỉ có một bản/dòng. Hai spin cùng lúc đo 199.99998°, và hai lớp opacity .65 cho pixel RGB 148/148/148 trên nền trắng, phù hợp với tích .4225. [extra-qa.json](animated-elements-50/extra-qa.json).

## Kiểm chứng và ngân sách

50/50 được bấm chèn trong Studio, tìm theo ba dạng tên, kiểm thumbnail tĩnh, phát thử thư viện, seek qua các mốc của cả hai dòng, lưu/reload, xem trước và phát snapshot công khai. Các đợt kiểm theo 10 mẫu đại diện của yêu cầu, 20 số nhỏ nhất còn lại, rồi 20 mục cuối; danh sách trong qa-report. 50/50 đi qua API Admin preview thật, 10 mẫu đại diện đi qua giao diện Admin. Các ảnh tĩnh được dựng lại ở 64/82/220/440 px trên hai nền; đã xem contact sheet.

Build/check và **767 unit tests** đạt. Bộ `test:canvas:browser` mở rộng duyệt toàn bộ 293 factory và các ca Canvas cũ: lưu/đọc JSON, quyền media, xuất bản, reply, offline/lost ACK, Creator, IME, nhiều kích cỡ, phím/touch và Fabric. Các nhãn log lịch sử “172” ở các lượt cũ chỉ là tên ca; vòng lặp dùng toàn bộ danh mục thực tế, không giới hạn 172.

Frame pacing trên 13th Gen Intel(R) Core(TM) i5-13400, Windows, Chrome 157.0.8103.79, viewport 390×844, CPU chậm 4×, ba lượt × 120 khung/cảnh. Đây là RAF lab, không phải phép đo điện thoại vật lý.

| Cảnh | Trước p95 ms | Sau p95 ms |
|---|---|---|
| Trống | 16.8–16.9 | 16.8–16.9 |
| Cùng 10 vật thể legacy | 16.8–16.9 | 16.8–16.9 |
| 10 vật thể mới, mỗi vật thể có hai dòng | Chưa có tính năng | 16.8–16.9 |

Mục tiêu 33 ms đạt ở cả ba lượt mới. Đỉnh 32 animation, 6 hạt cục bộ trong tập đại diện; sau thoát 0 animation và 0 pending controller. Bộ phận/hạt là hình có sẵn, không emitter/timer riêng. [performance-before-after.json](animated-elements-50/performance-before-after.json).

Mở lạnh, tắt cache, CPU 4×, cùng loopback/MySQL và ba lượt; số byte gồm HTML, CSS/JS, font, API và các tài nguyên mở ban đầu:

| Đường mở | Trước | Sau |
|---|---|---|
| Studio + thư viện | 2,692,815 byte; 42 yêu cầu | 2,973,413 byte; 42 yêu cầu |
| Cùng thiệp legacy mười vật thể | 573,145 byte; 34 yêu cầu | 577,438 byte; 34 yêu cầu |

50 mẫu mới không tải tệp artwork từ ngoài hoặc tự chạy 50 preview. Số liệu này là chi phí mở lạnh toàn trang, không chỉ riêng dữ liệu 50 mẫu. [network-before-after.json](animated-elements-50/network-before-after.json).

Chromium đã kiểm toàn luồng. Playwright WebKit đã phát đủ 50 và đo tim 2 giây ở 109.99998°. Firefox chưa chạy vì thiếu executable. Chưa xác minh Safari thật, điện thoại vật lý hoặc trình đọc màn hình. Kiểm pause/resume qua visibilitychange dùng mô phỏng thuộc tính hidden. Thử đổi tab Chrome headless thật ghi background=visible, returned=visible, observedHidden=false; chỉ gọi là đã quan sát tab ẩn khi giá trị observedHidden là true. Thử thêm Chrome có cửa sổ offscreen cũng chưa quan sát được tab ẩn; [native-visibility.json](animated-elements-50/native-visibility.json) ghi rõ chưa xác minh. Reduced-motion là tín hiệu trình duyệt được Playwright bật/tắt thực, cùng nút tắt trong player.

## Gói DB và vận hành QA

Gói mới `animated-elements-50-20261124-v1` chỉ 50 ID + tim; dependencies=[] vì dùng primitive nội bộ. Không mở rộng gói rollout cũ. Trên MySQL mới, seed và gói phát hành hội tụ: 530 hàng, 293 element, 51 unchanged, 0 ghi. Trên DB đã có dữ liệu: preview/fingerprint/CAS, gián đoạn 10 + tiếp tục 41, chạy lại 0, rollback 51 và rollback lại 0; các hàng khác giữ nguyên. Sửa của Admin trước áp dụng hoặc sau triển khai chặn gói/rollback và giữ nguyên dữ liệu. Dùng baseline mới được duyệt để tiếp tục; không ép revision hoặc bỏ fingerprint.

1. Xuất baseline đúng DB QA bằng CLI thư viện hiện có.
2. Tạo gói từ baseline: `node database/scripts/animated-elements-rollout.mjs --from-export <baseline.json> --output <bundle.json>`.
3. Preview: `node database/scripts/animated-elements-rollout.mjs --bundle <bundle.json>`. Muốn áp dụng thêm `--apply`; rollback thêm `--rollback --apply`.
4. Đường DB chỉ nhận opt-in `CANVAS_QA_MYSQL_ISOLATED=true`, host 127.0.0.1 và tên schema `momevia_canvas_qa_*`. Không tự đọc/ghi DB sản phẩm. Gói được ship khớp baseline gốc; DB có revision khác cần xem lại baseline, không sửa hash để bỏ qua xung đột.

Xem [gói phát hành](../database/updates/animated-elements-50-20261124-v1.json), [gói theo baseline QA cuối](animated-elements-50/qa-update-bundle-final.json), [MySQL mới](animated-elements-50/fresh-mysql.json), [xung đột DB thật](animated-elements-50/extra-qa.json). QA hiện chạy ở http://127.0.0.1:4191; phiên riêng và thông tin đăng nhập tổng hợp nằm trong `local/animated-elements-50` (ignored). Nguồn/hình của 50 mẫu không cần dịch vụ ngoài. Không có push/deploy cho người dùng thật.

## Nguồn và quyền

Artwork phát hành là vector mới do Momevia tự vẽ; provenance từng ID ghi SHA-256, owner, tệp nguồn và nghỉ tĩnh. Các trang Noto/Fluent/Tabler/confetti chỉ cung cấp ý tưởng về nhịp, độ nghiêng, đường nét hoặc cung hạt; không lấy SVG/APNG/Lottie/GIF/WebP hay mã nhúng của họ vào document. Tim dùng lại artwork nội bộ đã có, không thay tệp ảnh.

Tham khảo đã đọc: [Noto animated](https://googlefonts.github.io/noto-emoji-animation/), [định dạng/CC BY 4.0](https://googlefonts.github.io/noto-emoji-files/?view=docs), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [Fluent](https://github.com/microsoft/fluentui-emoji-animated), [MIT của Fluent](https://github.com/microsoft/fluentui-emoji-animated/blob/main/LICENSE), [Tabler balloon](https://github.com/tabler/tabler-icons/blob/main/icons/outline/balloon.svg), [giấy phép Tabler](https://tabler.io/license), [ví dụ confetti](https://www.kirilv.com/canvas-confetti/), [ISC](https://github.com/catdad/canvas-confetti/blob/master/LICENSE). Vì không tái phân phối tài sản ngoài, gói không gán các giấy phép đó cho artwork tự vẽ. Nút tắt và tư thế tĩnh theo [WCAG Pause/Stop/Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) và [reduced motion C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html).
