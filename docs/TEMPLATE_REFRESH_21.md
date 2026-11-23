# 21 mẫu quà tự nhiên và thư viện element · 23/11/2026

## Áp dụng DB thật theo yêu cầu tiếp theo

Đã cập nhật momevia_dev tại 127.0.0.1:3306: 75 hàng nội dung/mẫu và 12 element nguồn ngoài; tổng thư viện 480 hàng. 34 bảng nghiệp vụ và 4 tệp ảnh cũ giữ nguyên theo hash so với backup đủ 36 bảng. Chạy lại hai gói ghi thêm 0 hàng. Backup riêng ở database/private/natural-refresh-live-20261123, không commit. Chỉ khác thứ tự và UUID nội bộ so với baseline QA; đã giữ thứ tự thực tế và tạo expectedRevision/fingerprint đúng snapshot đang dùng. Cổng 4100 đã chạy mã mới: kiểm đủ 21 mẫu VI/EN, ba cảnh bằng bàn phím, bìa DB và 243 element; không tạo bản ghi người dùng để kiểm. Sau khởi động, 34 bảng nghiệp vụ và 4 ảnh cũ tiếp tục khớp hash backup. [Ảnh danh mục thật](template-refresh-natural-20261123/live/catalog-4100.png) · [Báo cáo trình duyệt 4100](template-refresh-natural-20261123/live/browser-4100.json). [Bằng chứng áp dụng](template-refresh-natural-20261123/live/database-rollout.json).

Các phần QA bên dưới ghi lại kết quả trước lần áp dụng này. Kiểm bổ sung cho guard live đạt; unit hiện tại 746/746.

Bản hiện tại là **Natural Originals V4**, thay hướng minh họa vector trước đó bằng vật thể có chất liệu, ảnh, đồ họa tự nhiên và các lớp chỉnh sửa độc lập.

- Chạy: [Danh mục QA 4121](http://localhost:4121/explore).
- Xem toàn bộ bằng chứng: [21 mẫu, ba cảnh, 40 element, kệ mùa và báo cáo](http://localhost:4121/assets/template-natural-qa/index.html).
- [4100](http://localhost:4100/explore) hiện dùng thư viện mới trong momevia_dev. Repo chạy chính ở nhánh feat/template-refresh-live-20261123; nhánh triển khai nội dung là feat/template-refresh-21, xuất phát 38c465d007687f54190adcb521dadfea04ad9d40. Tổng 9 commit, không commit trên main và chưa push. [Chuỗi commit](TEMPLATE_REFRESH_COMMITS.md).

## Trạng thái 21/21

| Đợt | Mẫu / ID giữ nguyên | Trạng thái | Khác biệt nhìn thấy hoặc thao tác được |
| --- | --- | --- | --- |
| 1 | Afterglow (`afterglow`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Mở chốt ô cửa tàu, đọc lời trên vé cạnh hoàng hôn và viết vào mặt sau vé. |
| 1 | Tiny Celebration (`tiny-celebration`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Tai kéo bằng vải mở ngăn hộp kraft; nhãn dưới đáy trở thành tờ hồi âm. |
| 1 | Winter Wishes (`winter-wishes-2026`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Chạm đế gỗ để có một lượt tuyết, vào ô cửa nhà ấm rồi mở thẻ ở chân cầu. |
| 1 | Captured Moments (`polaroid`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Máy chụp nhả dải ảnh; một ảnh tùy chọn đi trước lời nhắn và mặt lưng dùng để trả lời. |
| 2 | Calm Light (`calm-light`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Công tắc dây bật chụp đèn giấy; lời nằm cạnh vùng sáng và hồi âm tựa chân đèn. |
| 2 | On Cloud Nine (`cloud-nine`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Bậc thang đi giữa ba tầng mây giấy; đọc ở khoảng trời trống và viết dưới tầng cuối. |
| 2 | Make a Wish (`confetti`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Kéo dây ống pháo chéo, xem giấy bung một lượt và giữ cuống vé để trả lời. |
| 2 | Midnight Countdown (`new-year-spark-2027`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Chốt cơ học lật 23:59 thành 00:00, không phụ thuộc đồng hồ hay múi giờ của người nhận. |
| 2 | Spring Blessing (`spring-blessing-2027`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Mở bao lì xì trên mâm trà; lời chúc nằm trên giấy dó có hai thanh cuộn và thẻ lộc nhận hồi âm. |
| 2 | Velvet Valentine (`velvet-valentine-2027`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Chốt đồng mở hộp nhung, nhường phần lụa sáng cho lời riêng và thẻ ruy-băng cho lời đáp. |
| 3 | Little Greenhouse (`greenhouse`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Tay nắm cửa nhà kính mở vùng đọc; hồi đáp nằm trong nhãn cây có dây. |
| 3 | Gentle Apology (`gentle-apology`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Chạm đường vá vàng của bát gốm; tờ hồi âm cho phép người nhận khép quà mà không trả lời. |
| 3 | The Love Letter (`love-letter`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Nhấc mép tem hàng không, trải lá thư nhiều nếp và dùng nếp trống để viết lại. |
| 3 | Faraway Hug (`faraway-hug`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Máy bay giấy nối hai đường chân trời; lời tới mặt bưu thiếp chia địa chỉ và thư. |
| 3 | Lavender Field (`lavender`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Dải lanh mở sổ ép hoa, để cành oải hương ở lề và phiếu mẫu vật làm lời hồi đáp. |
| 3 | Một kỷ niệm của hai mình (`mot-ky-niem`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Khung ảnh gỗ giữ một ảnh tùy chọn; lật sang bìa sau để đọc, rồi lấy thiệp ở chân khung. |
| 4 | Midnight Bloom (`midnight-bloom`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Một nụ quỳnh khép trong vườn đêm mở cánh; khoảng tối ổn định giữ lời và nhãn người trồng nhận hồi âm. |
| 4 | Sunny Wishes (`sunny-wishes`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Chuông đồng trên xe đạp là điểm mở; lời cài ở giỏ và thẻ ở tay lái là chỗ trả lời. |
| 4 | Starlight Night (`starlight`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Núm trục đồng mở đĩa sao; lời nằm ngoài cụm sao rồi chuyển sang sổ quan sát. |
| 4 | Peachy Day (`peachy-day`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Nhấc nhãn tròn của quả đào để trải giấy kraft, rồi viết vào phiếu nhỏ trong túi. |
| 4 | Thank You Bloom (`thank-you-bloom`) | 3/3 · VI/EN · lưu/phát/hồi đáp/Fabric đạt | Thẻ dây đay trên bó hoa mở lời cảm ơn; mặt sau thẻ trở thành hồi âm. |

Mỗi mẫu có nguồn sáng và mặt nhận bóng được ghi riêng trong [status-21.json](template-refresh-natural-20261123/status-21.json). Các mô tả hành trình nằm trong refresh-21-config.js; các tên, lời chúc, chữ ký, điều khiển, ảnh tùy chọn và lớp trang trí vẫn nằm trong document có thể chọn/sửa. Hai mẫu ảnh giữ đúng một vị trí cá nhân hóa, ảnh minh họa khi chưa thêm ảnh, thay ngang/dọc và vùng lấy nét.

## Bằng chứng trực quan

- [21 bìa ở 380 × 322](template-refresh-natural-20261123/covers.png).
- [21 lời chúc](template-refresh-natural-20261123/wishes.png).
- [21 hồi đáp](template-refresh-natural-20261123/replies.png).
- [Che tên và chuyển xám](template-refresh-natural-20261123/covers-grayscale.png): vật thể vẫn phân biệt được qua hình dáng.
- [Studio/Fabric của 21 mẫu](template-refresh-natural-20261123/studio-fabric.png), đã chờ giải mã ảnh trước khi chụp.
- [Kệ mùa VI](template-refresh-natural-20261123/seasonal-live-vi.png), [EN](template-refresh-natural-20261123/seasonal-live-en.png); [bốn khung 268 × 320](template-refresh-natural-20261123/seasonal-vi.png).
- [Bảy bìa đối chứng trước/sau](template-refresh-natural-20261123/controls-before-after.png).
- [40 element mới](template-refresh-natural-20261123/natural-elements.png).

Ảnh bìa được chụp từ Chrome vì công cụ raster SVG dựa trên librsvg không hiển thị đúng WebP nhúng trong điều kiện hiện có. Không dùng kết quả ảnh trống làm bằng chứng. Các bảng cảnh được chụp từ trình xem thật; không phải mockup.

## Element và nguồn

Đã rà 182 mục gốc theo nhóm: 54 dùng nguyên, 3 có biến thể, 125 hưởng bản sửa renderer/Fabric. [Danh sách từng ID](template-refresh-natural-20261123/elements.csv). Các sửa hiển thị gồm artwork/effect được ghim, hình học và contain của ảnh, chữ/font, vân giấy, bóng tiếp xúc và bóng theo alpha. Fabric giữ tọa độ lẻ của lớp chưa sửa; áp dụng một lớp không làm tròn cả cảnh.

Thêm 21 cụm đạo cụ theo mẫu và 40 element tự nhiên: 6 hoa/lá, 6 giấy/vải/sáp/nơ, 8 vật thể 3D CC0, 6 chuyển động, 2 cụm thư/khung ảnh và 12 mục từ nguồn mới. Tổng thư viện **243 element**, 480 hàng thư viện tính cả template, effect, artwork và các loại khác. Phân loại tìm kiếm: Hình, Đồ họa, Ảnh, 3D, Chuyển động, Tương tác, Chữ.

56 ảnh hoạt động gồm 38 ảnh được tạo bằng công cụ tạo ảnh tích hợp và 18 ảnh CC0. Các hình tạo mới là ảnh tạo bằng AI theo hướng chất liệu thật, không ghi nhận là ảnh chụp hiện vật đã xác minh. Hai đồ họa Canvix là path gốc có thể đổi màu; không làm thành bitmap. [Manifest, prompt, mã hash và các biến thể](../web/assets/event-cards/natural-v4/manifest.json). Bản full/cover/thumbnail bất biến lần lượt tối đa 960/640/192 px; giữ tệp hash cũ để quà cũ không đổi tài nguyên.

Đã đọc/rà **9/9 nguồn** mới. Tích hợp 6 PNG Kitbitz, 2 hình Openclipart, 2 hình SVG Repo theo CC0 và 2 bộ path Canvix theo MIT. Canva/Envato/Freepik, Doory và Grida giữ ở mức tham khảo hoặc chưa có asset phù hợp để phân phối trong editor. Không cài repo, gói hoặc chạy lệnh/mã từ website. SVG nguồn được kiểm tra đặc tính chủ động/ngoại vi và raster hóa thành ảnh trước khi phân phối; không đưa HTML hay SVG thô của bên thứ ba vào runtime. Canvix chỉ dùng dữ liệu path đã đọc và chuyển tọa độ bằng tay.

[Sổ nguồn / tác giả / giấy phép / commit / biến đổi](template-refresh-natural-20261123/source-review-9.json). Thông báo giấy phép đi cùng web/assets/event-cards/natural-v4/licenses và docs/THIRD_PARTY_NOTICES.md. Không dùng asset nhãn hiệu trong các bộ mang tên thương hiệu.

## Dữ liệu và phiên bản

4121 dùng JSON QA tổng hợp tại local/event-cards-refresh/app/services, không đọc .env hoặc dữ liệu ứng dụng 4100. Quà công khai QA có thể mở từ bảng trạng thái. MySQL được thử ở container 8.4.13 với cổng ngẫu nhiên và DB momevia_canvas_qa_ riêng; container đã dọn sau kiểm tra.

Giữ ID, giá, quyền mẫu trả phí, source/policy, các trường cá nhân hóa và quà đã lưu. Bìa/preview/nháp mới dùng đúng phiên bản; quà đã xuất bản giữ snapshot và ảnh private đã ghim. Kiểm hash byte ảnh giữa owner và người nhận. Đã mở lại API của 21 quà QA được phát từ bản vector trước lần nâng cấp: cả 21 vẫn giữ document cũ; chụp một quà cũ trong trình duyệt và kiểm nó không nhận kiểu giấy của mẫu mới. [Bằng chứng quà cũ](template-refresh-natural-20261123/gallery-smoke.json). Chèn thư viện kiểm allowlist và SHA-256 trước upload; dùng khóa upload ổn định theo design để mất ACK/tải lại không nhân bản tài nguyên hoặc vượt quota ngoài ý muốn.

Gói cập nhật đã chuẩn bị:

- database/updates/template-refresh-natural-20261123-v2.json: 75 hàng từ thư viện nguồn 417 hàng.
- database/updates/template-refresh-natural-20261123-v2-from-vector-v1.json: 75 hàng từ bản vector 438 hàng.
- database/updates/natural-open-elements-20261123-v1.json: 12 element nguồn ngoài; chạy sau một trong hai đường nâng cấp trên hoặc độc lập nếu đã có đúng baseline.

Các gói có expectedRevision, snapshot trước và fingerprint, lịch sử, phát hiện Admin sửa riêng, tiếp tục sau gián đoạn, chạy lại không ghi thêm và hoàn nguyên bằng revision mới. Mục thêm mới chuyển disabled khi hoàn nguyên. Validator giới hạn đúng ID được rà. [Gói dựng lại cho cùng hash](template-refresh-natural-20261123/bundle-reproducibility.json); gói vector v1 được giữ nguyên. Sau rollback, muốn áp dụng lại cần baseline/revision mới, không bỏ qua CAS.

CLI database/scripts/natural-library-rollout.mjs mặc định xem trước; chỉ nhận loopback DB có prefix momevia_canvas_qa_ và cờ QA rõ ràng. --from-vector-v1 chọn đường từ vector, --open-elements chọn gói 12 mục; --apply ghi, --apply --rollback hoàn nguyên. Hai gói đã được áp dụng vào momevia_dev bằng baseline thực đã rà; đọc phần triển khai ở đầu tài liệu.

## Kiểm thử

[Chi tiết](template-refresh-natural-20261123/test-results.json). Build và check đạt; **746/746 unit**, test:templates, test:canvas:browser và test:prediction:browser đạt. Bộ Canvas tổng hợp đi qua 243 element (một số nhãn console lịch sử còn ghi 172 nhưng assertion thực tế là 243/243). Không hạ giới hạn ghi hay bỏ kiểm quyền để đạt.

- 252 tổ hợp VI/EN × 320/390/1440 × chuyển động thường/giảm × 21 mẫu; đi đủ ba cảnh, điều khiển bằng bàn phím, gửi thử và phục hồi focus.
- 126 tổ hợp tên 60 ký tự và lời chúc 1.000 ký tự; mobile, desktop và mô phỏng zoom 200%.
- 21 hành trình QA tạo, sửa, lưu, tải lại, xem trước, quyền trả phí, xuất bản, hồi đáp và bất biến snapshot; 21 lượt Studio/Fabric và crop qua UI của hai mẫu ảnh.
- 40 element mới lưu/tải lại/phát quà thật, ACL ảnh riêng, byte công khai khớp, thư nhiều nếp bằng bàn phím, motion thường và dừng khi đổi sang giảm chuyển động.
- MySQL hai baseline: conflict Admin đã có trước khi áp dụng không ghi hàng nào, CAS cũ bị từ chối, 7 + 68 tiếp tục, rerun 0, rollback 75; gói nguồn ngoài 5 + 7, rerun 0 và rollback 12. 252 biến thể bìa DB, history và 21 ca HTTP/trình duyệt MySQL thực với provider mô phỏng.

## Hiệu năng

Lượt chẩn đoán đầu có 4/40 mẫu vượt ngưỡng (cao nhất 2.612 giây). Đã giữ đầy đủ ở performance/after-before-deferred-preview.json. Tài nguyên mạng cho thấy metadata ảnh và schema/editor bị tải theo import của trang danh mục; đã tách metadata cặp đổi mẫu thành module nhỏ và chỉ tải bộ ảnh/trình xem khi mở preview. Không đổi chất lượng ảnh hoặc ngưỡng đo.

**40/40 lượt sau đạt LCP <2,6 giây và CLS ≤0,1**. LCP lớn nhất 2.388 giây, CLS lớn nhất 0.0384. [Toàn bộ số đo mới](template-refresh-natural-20261123/performance/summary.json). Tổng 80 mẫu so sánh cuối và 40 mẫu chẩn đoán trước tối ưu đều được giữ. Đo bằng JSON QA; chưa đo tốc độ trang trên MySQL thực tế. Điều kiện: Chrome, 390 × 844, DPR 1, CPU 4×, latency 100 ms, download 200.000 B/s, upload 93.750 B/s, cache tắt, quan sát thêm 4,5 giây sau load; tám route × năm lượt × trước/sau = 80 mẫu. Không chạy suite nặng đồng thời.

| Route | LCP median trước → sau | LCP sau cao nhất | KiB median trước → sau |
| --- | --- | --- | --- |
| /explore | 1.720 → 2.308 s | 2.388 s | 381 → 376 |
| /template/sunny-wishes | 1.072 → 2.324 s | 2.340 s | 211 → 372 |
| /template/cuon-phim-ngay-ay | 2.184 → 2.140 s | 2.172 s | 343 → 339 |
| /template/loi-moi-ben-hien | 2.112 → 2.076 s | 2.076 s | 333 → 328 |
| /template/hai-phong-bi | 2.056 → 2.024 s | 2.076 s | 320 → 316 |
| /template/mot-ky-niem | 1.176 → 2.056 s | 2.076 s | 241 → 324 |
| /template/greenhouse | 1.200 → 2.000 s | 2.056 s | 233 → 309 |
| /template/proud-of-you | 1.716 → 1.692 s | 1.716 s | 289 → 285 |

Median trang khám phá tăng từ 1.720 lên 2.308 giây trong lượt đo này. Các mẫu chuyển từ vector sang ảnh có chi phí tải cao hơn. Ghi nhận cả mức tăng và dao động, không chỉ lượt nhanh nhất.

## Phạm vi còn chưa xác minh

Chưa thử điện thoại vật lý, Safari/iOS, trình đọc màn hình hoặc bàn phím ảo thật. 243 thumbnail/chèn/undo không thay thế ảnh Fabric riêng của từng element cũ. Không gọi thanh toán/merchant thật, không sửa quà người dùng, đã cập nhật thư viện DB và ứng dụng 4100 theo yêu cầu bổ sung. Chưa push hoặc triển khai máy chủ bên ngoài. Các kết quả thiết bị là mô phỏng trình duyệt, các bản phát và lời đáp là dữ liệu QA.

Các bằng chứng vector trước đổi hướng được lưu dưới docs/template-refresh-20261123; chỉ là lịch sử, không dùng thay kết quả Natural V4.

