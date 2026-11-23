# Làm mới 21 mẫu quà · 23/11/2026

Bản nội dung chạy tại [Catalog QA 4121](http://localhost:4121/explore). [Trang bàn giao có ảnh, 21 link mẫu và 21 quà QA](http://localhost:4121/assets/template-refresh-qa/index.html). [Cổng 4100](http://localhost:4100/explore) giữ nguyên để đối chiếu.

## Phạm vi và phiên bản

- Nhánh `feat/template-refresh-21`, worktree `P:/entrepreneuer/project/momevia-template-refresh-21`, xuất phát từ `38c465d007687f54190adcb521dadfea04ad9d40` trên `feat/recorded-audio-library`.
- Worktree gốc `P:/entrepreneuer/project/momevia` sạch khi bắt đầu và khi đối chiếu cuối; không chép đè hoặc đổi nhánh của agent UI. Không cập nhật DB/ứng dụng ở 4100, không push/deploy.
- 21 ID, giá, quyền và trường cá nhân hóa giữ nguyên. Mỗi mẫu có ba cảnh, VI/EN, đạo cụ mở có tên truy cập và nút thật. Bảy định nghĩa đối chứng được so nguyên tài liệu VI/EN với fixture trước thay đổi.
- Cảnh dọc 390×844. Bìa danh mục 390×330 tương ứng khoảng 380×322; bìa mùa 390×466 tương ứng 268×320. Cùng path, lớp, màu và bản tài liệu đang hoạt động; không lấy ảnh tĩnh cũ để thay định nghĩa Admin. Bìa cũ không có marker mới giữ bản dọc làm dự phòng.
- Cache phân biệt ID, ngôn ngữ, phiên bản (`coverRevision` của DB; release 8 của nguồn dự phòng) và biến thể. Preload và ảnh thật dùng cùng URL.

## Ảnh và bảng 21 mẫu

[Trạng thái 21 mẫu, một câu mô tả khác biệt và link chạy](template-refresh-20261123/status-21.json).

| Bằng chứng | Nội dung |
| --- | --- |
| [Bìa danh mục](template-refresh-20261123/covers.png) | 21 vật thể tại cùng tỷ lệ; thêm ảnh từng đợt `wave-1-covers.png` đến `wave-4-covers.png` |
| [Bỏ tên và chuyển xám](template-refresh-20261123/covers-grayscale.png) | Không có tiêu đề/ID trên ảnh, nhận diện bằng hình dáng |
| [Mở quà](template-refresh-20261123/browser-covers.png) | 21 ảnh từ player thật trong Chrome |
| [Lời chúc](template-refresh-20261123/browser-wishes.png) | 21 ảnh từ player thật, có cả phản hồi focus khi đi bàn phím |
| [Hồi đáp](template-refresh-20261123/browser-replies.png) | Giữ biểu mẫu và quyền hiện có, đặt trên vật hồi âm của mẫu |
| [Kệ mùa VI](template-refresh-20261123/seasonal-live-vi.png) / [EN](template-refresh-20261123/seasonal-live-en.png) | Bốn mẫu cùng lúc, chụp ngay từ Catalog |
| [182 mục gốc](template-refresh-20261123/elements.csv) | 54 dùng nguyên; 3 biến thể; 125 hưởng sửa renderer Fabric |
| [203 thumbnail](template-refresh-20261123/library-203-contact-sheet.png) | Có 21 cụm đạo cụ mới; chèn/undo từng mục qua UI |
| [Nguồn và chất liệu](template-refresh-20261123/artwork-rights.json) | Ánh sáng, mặt nhận bóng, vai trò, tỷ lệ và SHA theo mẫu |
| [Bốn cặp Studio / Fabric](template-refresh-20261123/material-pilot-comparison.png) | Cùng vật thể trong bốn mẫu thử, ảnh trực tiếp từ canvas trình duyệt |

Ảnh từng mẫu, từng cảnh tiếng Việt và tiếng Anh nằm trong `template-refresh-20261123/browser/`. Ảnh Studio/Fabric theo mẫu nằm trong `template-refresh-20261123/editor/`. Hai mẫu ảnh có thêm ảnh ngang/dọc và kết quả đổi crop bằng UI.

Artwork là minh họa vector gốc được tạo cho Momevia, không phải ảnh chụp sản phẩm. Chữ, tên, lời chúc, ảnh cá nhân, nút và từng bộ phận có ý nghĩa được giữ ở các lớp riêng. Không thêm ảnh ngoài, URL media từ xa hoặc ảnh cá nhân bắt buộc. Font local tiếp tục dùng giấy phép có sẵn, gồm Lora OFL.

## Element và Fabric

Thêm 21 cụm `object-<templateId>` trong Cụm trang trí, có tên VI/EN. Cập nhật Flowers, Leaves và Stars theo bộ hình mới; các bản đã lưu/đã phát hành giữ artwork được ghim.

Thử và dùng các recipe hiện có: `cotton-paper-v2`, `paper-shadow-v2`, `contact-shadow-v1`. Đế sát mặt có bóng hẹp; dải ảnh và tai kéo có bóng mềm hơn. Các nét kính, chốt đồng, thớ gỗ, đường vá vàng, nếp giấy, sợi ruy-băng và nhung là path riêng. Winter có một lượt tuyết; Confetti bung một lượt và dừng khi rời cảnh hoặc giảm chuyển động.

Fabric nhận artwork và bề mặt đã ghim, dùng cùng vân giấy, font, phản xạ và bóng. Bổ sung dựng vector, phần xem tĩnh của điều khiển, crop ảnh và blur của lớp bóng; sửa tọa độ gốc, đường không tô và phần đo bounds gây lệch hình học. Có thử chọn lớp chữ/vật thể, dịch một lớp, áp dụng/lưu, xác nhận mọi lớp không sửa giữ nguyên hình học và nguồn/quyền. Hai khung ảnh tùy chọn tiếp tục thay ảnh, đổi điểm lấy nét và undo được. Quick mode chuyển tới cảnh có ảnh khi tải ảnh và khi mở lại nháp đã có ảnh.

## Kiểm thử

| Bộ kiểm | Kết quả quan sát |
| --- | --- |
| Build / check | Đạt; 2.963 key VI/EN, kiểm cú pháp, scope, i18n và CSS |
| Unit | 736/736 đạt, không skip |
| `test:templates` | 28 mẫu; tạo/lưu/tải lại, quyền free/paid, nguồn/phiên bản, bìa, CAS và mất ACK |
| Ma trận 21 mẫu | 252 tổ hợp: 21 × VI/EN × 320/390/1440 CSS px × full/reduced motion; ba cảnh, Enter/Space, hồi âm mô phỏng, replay và trả focus |
| Nội dung dài / zoom | 126/126 tổ hợp bổ sung: cả 21 mẫu, VI/EN, tên 60 ký tự và lời 1.000 ký tự theo giới hạn hiện hữu; 320/1440 CSS px và mô phỏng desktop zoom 200% (720 CSS px, DPR 2); không cắt chữ ngang, lời dài nằm trọn vùng cuộn, mở/hồi âm/replay bằng bàn phím |
| Hành trình QA | 21 tạo → sửa tên/lời dài → lưu → tải lại → preview → phát hành → người nhận → hồi đáp thật; quyền trả phí chặn trước khi cấp quyền giả lập QA |
| Ảnh | Cả hai mẫu: mặc định không ảnh, ảnh ngang/dọc, crop, lưu/tải lại; quà đã phát trước khi sửa ảnh giữ snapshot |
| Studio/Fabric | 21/21; chọn lớp, áp dụng nudge, giữ hình học của lớp không sửa; crop preset và undo qua UI ở hai mẫu ảnh |
| Canvas browser | Đạt toàn bộ suite; 203 chèn/undo, 33 hiệu ứng cũ, private media, Creator, offline, CAS, quyền hồi đáp, template trả phí, QR và phiên bản cũ |
| Prediction browser | Đạt cả bốn tổ hợp dự đoán/lựa chọn, hai nhánh, replay/reload, đổi ngôn ngữ và revoke |
| MySQL 8.4.13 | DB trống và DB có 417 hàng thư viện; Admin conflict, expectedRevision, gián đoạn 7+38 hàng, chạy lại 0 ghi mới, history, rollback; 126 bìa 21×VI/EN×3 kiểu; HTTP/provider fixture riêng đạt |

Log và báo cáo máy đọc được: [thư mục bằng chứng](template-refresh-20261123/). Tài khoản, cookie và mật khẩu QA chỉ ở `local/`, không nằm trong gói bàn giao.

Hiệu năng: **40/40 lượt sau đều đạt LCP <2,6 giây**, lớn nhất **2.364 giây**. CLS lớn nhất **0.0384**. Tổng 80 lượt trước/sau, tám route × năm lượt mỗi bản. Cùng Chrome, 390×844, DPR 1, CPU 4×, latency 100 ms, download 200.000 B/s, upload 93.750 B/s, cache tắt, quan sát 4,5 giây sau load. Không chạy suite nặng cùng lúc đo. Bản trước là nguồn đóng băng commit xuất phát, JSON QA riêng tại 4122; bản sau là 4121. Đây là số đo lab JSON, không phải MySQL hay điện thoại thật.

| Route | LCP median trước → sau | LCP sau lớn nhất | KiB median trước → sau |
| --- | --- | --- | --- |
| /explore | 1.760 → 2.340 s | 2.364 s | 381 → 381 |
| /template/afterglow | 1.164 → 1.188 s | 1.256 s | 232 → 234 |
| /template/tiny-celebration | 1.092 → 1.208 s | 1.208 s | 211 → 234 |
| /template/winter-wishes-2026 | 1.328 → 1.208 s | 1.208 s | 233 → 234 |
| /template/polaroid | 1.304 → 1.208 s | 1.208 s | 233 → 234 |
| /template/thank-you-bloom | 1.244 → 1.208 s | 1.208 s | 233 → 234 |
| /template/spring-blessing-2027 | 1.240 → 1.208 s | 1.224 s | 233 → 234 |
| /template/cuon-phim-ngay-ay | 2.156 → 2.176 s | 2.356 s | 343 → 344 |

Catalog vẫn đạt ngưỡng nhưng median tăng từ 1,760 lên 2,340 giây trong lần đo này; không coi đây là cải thiện tốc độ. Giữ toàn bộ mẫu đo, gồm các lượt Catalog dao động 1,668–2,364 giây. [Số liệu gốc và cấu hình](template-refresh-20261123/performance/summary.json). Hai bìa lớn nhất trong nhóm mới là Thank You Bloom và Spring Blessing; Cuộn phim ngày ấy là bìa lớn nhất toàn thư viện và được đo riêng.

## Cập nhật thư viện có dữ liệu

Gói `database/updates/template-refresh-21-20261123-v1.json` có đúng 45 thay đổi: 21 template, 3 cụm hiện hữu, 21 cụm mới. Mỗi thay đổi có snapshot trước, `expectedRevision`, fingerprint và revision kế tiếp. Validator chỉ cho phạm vi này; không cho ghi Catalog giá/quyền hoặc bảy template đối chứng.

Đã dựng gói hai lần trong process mới và đối chiếu SHA giống nhau (`bundle-reproducibility.json`). ID con của cụm trong gói được chuẩn hóa ổn định; khi người gửi chèn, cơ chế materialize vẫn cấp ID mới. Việc chạy lại cùng gói không phụ thuộc UUID ngẫu nhiên của factory seed.

`database/scripts/refresh-21-library-rollout.mjs` mặc định dry-run. Chỉ nhận DB loopback có prefix `momevia_canvas_qa_` và cờ QA rõ ràng. `--apply` cập nhật, `--apply --rollback` hoàn nguyên bằng revision/history mới; cụm mới chuyển disabled. Seed trên DB có dữ liệu không ghi đè bản Admin. Có chỉnh sửa Admin hoặc thay dependency thì dừng để đối chiếu, không tự nâng quyền ghi đè. Fixture `tests/fixtures/refresh-21-before.json` là thư viện nguồn trước sửa, không phải bản xuất dữ liệu người dùng ở 4100.

Chạy lại: `node scripts/build/refresh-21-bundle.mjs`, `node scripts/qa/refresh-21-mysql.mjs`. Script MySQL tự tạo container/db ngẫu nhiên, chạy migration và bỏ container QA khi xong. Không đọc `.env` ứng dụng hoặc gọi merchant thật.

## Điểm tích hợp với agent UI

Nội dung nằm trong `refresh-21-config.js`, `refresh-21-art.js`, `refresh-21.js`, gọi một nhánh tại `basic-templates.js`. Điểm gắn bìa nhỏ: `templateCover(template,{variant:'catalog'|'seasonal'|'portrait'})`. `components.js` chỉ chọn tỷ lệ; `pages/catalog.js` chỉ chọn seasonal; `catalog-bootstrap.js` đồng bộ preload. Không sửa lưới, menu, phân trang, footer hay màu/nút ứng dụng. CSS mới chỉ dành cho hotspot của tài liệu có marker refresh.

QA 4121 dùng JSON fixture riêng tại `local/event-cards-refresh/app/services/`. Đồng bộ code bằng `node scripts/qa/event-card-fixture.mjs sync event-cards-refresh 4121`. Khi source server thay đổi, khởi động lại đúng process QA với `node scripts/qa/event-card-fixture.mjs serve event-cards-refresh 4121`. Nguồn cũ đóng băng cho đo tải tại 4122 dùng commit xuất phát; không thay 4100.

## Chưa xác minh

Chưa cập nhật thư viện MySQL hoặc ứng dụng ở 4100; chưa merge nhánh UI, push hoặc deploy. Chưa thử điện thoại vật lý, Safari/iOS, trình đọc màn hình và bàn phím ảo thật. 125 mục hưởng sửa renderer đã được rà inventory và thumbnail nhưng chưa có ảnh Fabric riêng từng mục cũ. Các kết luận về thiết bị là mô phỏng trình duyệt; các lần phát quà/hồi đáp là dữ liệu QA tổng hợp. Quà của người dùng đang chạy không bị ghi lại.
