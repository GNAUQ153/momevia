# Tốc độ Catalog và sáu thiệp · 22/11/2026

Nhánh `perf/interactive-cards-lcp`, xuất phát từ `7b684e1`. Ngưỡng chốt theo yêu cầu mới: **LCP dưới 2,6 giây**. Chỉ triển khai và kiểm tra local, không push/deploy hay ghi production. Bản chạy: [Catalog](http://localhost:4119/explore).

## Kết quả đo

<!-- LCP_TABLE_START -->
**Cả 35 lượt đều đạt LCP <2.6 giây; lượt lớn nhất 2.452 giây.**

| Route | LCP trước, median | LCP sau, median | LCP sau lớn nhất / 5 lượt | Tải trước → sau | CLS lớn nhất sau |
|---|---:|---:|---:|---:|---:|
| /explore | 6.448 s | 1.644 s | 2.452 s | 932 → 375 KiB | 0.0002 |
| /template/hai-phong-bi | 5.644 s | 2.104 s | 2.176 s | 666 → 315 KiB | 0.0384 |
| /template/birthday-radiance | 5.328 s | 1.168 s | 1.196 s | 605 → 254 KiB | 0.0384 |
| /template/proud-of-you | 5.480 s | 1.744 s | 1.768 s | 635 → 283 KiB | 0.0384 |
| /template/loi-moi-ben-hien | 5.712 s | 2.076 s | 2.116 s | 678 → 327 KiB | 0.0384 |
| /template/cuon-phim-ngay-ay | 5.732 s | 2.152 s | 2.160 s | 688 → 338 KiB | 0.0384 |
| /template/ban-do-ngay-ra-truong | 5.696 s | 1.744 s | 1.816 s | 662 → 290 KiB | 0.0286 |
<!-- LCP_TABLE_END -->

Mỗi route có năm lượt tải lạnh trên cùng hồ sơ Chrome 157, 390×844, DPR 1, mobile/touch giả lập, CPU 4×, latency 100 ms, download 200.000 B/s, upload 93.750 B/s, cache HTTP tắt. Cả trước và sau dùng backend JSON fixture riêng. Không chạy các bộ kiểm thử nặng cùng lúc đo. Theo dõi LCP đến 4,5 giây sau khi trang tải và có tiêu đề, kiểm tra ảnh thực trong viewport đã giải mã. Không kết thúc quan sát ở khung chữ tạm hoặc trước khi ảnh xuất hiện.

Số byte lấy từ CDP Network, gồm HTML có dữ liệu khởi tạo, font, tài nguyên ngoài origin nếu có và response tải dở. Data URI trong SVG đã nằm trong số byte của SVG; không cộng lần hai. So sánh trước lấy từ bản G0–G5 ở commit `7b684e1`, không thay số đo lịch sử. Số đo MySQL, điện thoại vật lý hay mạng người dùng thật không được suy ra từ lab JSON này.

## Thay đổi

- Build gom ESM thành các chunk có tên theo nội dung, preload các dependency cần cho app, giữ Fabric/QR/Creator/Admin và các phần chỉnh sửa tải theo nhu cầu. CSS Catalog giữ đúng thứ tự các tệp nguồn cần dùng; CSS đầy đủ nạp trước preview hoặc trang khác. Chuyển khối modal/toast dùng chung sang CSS thành phần để chúng vẫn hoạt động ngay trên Catalog.
- HTML của Catalog/detail mang đúng DTO công khai từ cùng service mà API dùng. Bootstrap nhỏ chọn bìa theo dữ liệu server và ngôn ngữ đang dùng, bắt đầu tải sớm và chia sẻ response với app. Không nhúng phiên đăng nhập, tài liệu nháp, nội dung quà, ảnh riêng hoặc quyền mua. JSON được escape ký tự `<`, nằm trong data tag không thực thi; HTML vẫn `no-store`, CSP không thêm `unsafe-inline`/`unsafe-eval`.
- Card ngoài màn hình bắt đầu tải ảnh khi còn cách viewport 100 px. Tên, mô tả, giá, vùng liên kết và kích thước ảnh luôn sẵn. Cuộn, lọc, phân trang, đổi ngôn ngữ và điều hướng bàn phím vẫn tải đúng bìa. Cover revision từ server được dùng cho bìa DB, kể cả các đường xem từ trang chủ; không lấy ảnh build cũ để thay bìa DB đã chỉnh.
- Preview lấy riêng một tài liệu VI/EN đã ghim artwork/effect theo thư viện hiện tại, không tải toàn bộ thư viện editor. Kiểm tra Catalog công khai trước khi trả tài liệu; Creator có version tiếp tục đi qua endpoint version hiện hữu. Studio vẫn lấy thư viện đầy đủ để chỉnh sửa. Cùng player tiếp tục phục vụ Studio, preview và public.
- Phục vụ nguyên bản Inter v20 và Plus Jakarta Sans v12 từ local, giữ đủ glyph/weight và fallback của các bộ ký tự. Đưa face tiếng Việt sau phần latin-ext bị chồng Unicode để tránh tải thêm bộ lớn chỉ vì chữ Việt. Không lấy mẫu lại glyph hoặc đổi font. Manifest có nguồn, SHA-256 và hai giấy phép OFL trong `web/assets/fonts/app/`.
- Build nén Brotli trước cho JS/CSS. Server thương lượng `br`/`gzip` theo quality, giữ `Vary: Accept-Encoding`, MIME và HEAD; bản giải nén bằng đúng nguồn. Chỉ dùng cho tệp công khai. Không nén cache dùng chung cho dữ liệu/ảnh riêng.

Toàn bộ tám WebP v3 và các source animation/renderer của player giữ nguyên. Không giảm độ phân giải, quality ảnh, keyframe, tốc độ hay mật độ hiệu ứng để đạt LCP. Kiểm tra SHA và kiểm thử thao tác nằm trong gói bằng chứng.

## Kiểm thử và bằng chứng

- `npm run build`, `npm run check`, `npm test`: 567 unit, không bỏ qua; `TEST_ACCOUNT_ENABLED=false`.
- `npm run test:templates`: 28 mẫu, quyền free/paid, create/save/reload, bìa và retry. Kiểm tra CSS đã chuyển từ tên tệp nguồn sang nội dung stylesheet thực sự được phục vụ, vẫn giữ kiểm CSP.
- `npm run test:canvas:browser`, Chrome: 181 element, 33 effect, quyền Creator, ảnh/crop, touch/keyboard, CAS, offline/lost ACK, QR, preview/public/reply và writer-off reader.
- Ma trận Chrome: 96 tổ hợp sáu mẫu × VI/EN × bốn chiều rộng × full/reduced motion; sáu hành trình tạo–lưu–tải lại–xuất bản fixture–public–reply.
- 56 tổ hợp route/ngôn ngữ/chiều rộng kiểm tra CSS Catalog so với CSS đầy đủ: cùng kích thước, vị trí và các thuộc tính hiển thị của toàn bộ body. Kiểm thêm tải bìa khi cuộn, preview chỉ gọi endpoint một mẫu và logical module inputs của public player không có editor.
- Edge: recipe Studio/public, hai thứ tự phong bì, candle bấm dồn, tua riêng, thư gấp, trial/restyle, ảnh 0/1/3, chú thích dài, ảnh hỏng, crop và cleanup. Bộ đo nhận diện đúng các chunk runtime sau build, không dựa vào URL source đã mất khi bundle.
- MySQL 8.4 QA tách biệt: 21 ca HTTP/provider fixture; thêm kiểm riêng tài liệu preview VI/EN từ DB, đúng định nghĩa đã ghim và từ chối template chưa công khai. Diễn tập thư viện/rollback cũng đạt. Không gọi merchant thật.

<!-- MOTION_START -->
Đo lại frame pacing ba giây/mẫu, cùng mobile/CPU/mạng lab: 59.9 / 58.6 / 58.8 FPS; p95 16.8 / 16.9 / 16.8 ms. Đỉnh 2 / 2 / 6 animation; sau đóng preview đều 0. Đây là RAF lab, không phải FPS thiết bị vật lý. Số timer/WAAPI theo runtime trong edge suite sau đóng là 0/0. Xem dữ liệu gốc trong gói bằng chứng.
<!-- MOTION_END -->

Đã thao tác ở Chrome thường: Catalog → Birthday → preview → thắp nến; tắt/bật motion vẫn giữ trạng thái nến và điều khiển đọc tiếp. Ảnh/clip giao kèm được ghi bằng Chrome headless; chức năng chụp qua tiện ích Chrome thường bị timeout. Không dùng trạng thái `visible/visible` của tab để xác nhận đã kiểm tra tab nền thật.

[Số đo, log, ảnh và clip](interactive-cards-lcp-20261122/index.html). Bản [G0–G5 trước tối ưu](INTERACTIVE_CARDS_G0_G5.md) giữ các số đo cũ để đối chiếu. Pilot năm người, Safari/iOS/thiết bị vật lý và giá production của ba mẫu mới vẫn theo trạng thái chưa hoàn tất ở bản bàn giao trước; đợt này không mở thêm các hạng mục đó.

## Chạy lại

```powershell
Set-Location P:/entrepreneuer/project/momevia
npm ci
npm run build
node scripts/dev/interactive-cards-local.mjs final
```

Launcher giữ dữ liệu fixture đã có và tạo tài khoản QA mới; thông tin nằm trong file riêng được Git bỏ qua tại `local/interactive-cards-20261122/final/session.json`. Nếu cổng 4119 đang chạy, dừng đúng process fixture trước khi khởi động lại. Không dùng `.env`/DB ứng dụng thật để thử. Sau sửa code client cần build lại để có hash/chunk mới. Nếu thiếu build, source HTML/JS vẫn dùng được nhưng không đại diện cho kết quả LCP của bản đã đóng gói.

Đo lại khi các suite khác đã dừng:

```powershell
$env:LCP_REQUIRE_TARGET='true'
$env:LCP_TARGET_MS='2600'
$env:LCP_LABEL='final'
node scripts/qa/interactive-cards-lcp.mjs
node scripts/qa/interactive-cards-motion-budget.mjs
```

Script LCP thất bại nếu bất kỳ lượt nào không đạt `<2600 ms` hoặc CLS vượt 0,1. Lượt đo cũ có một mẫu Catalog 2,572 giây vượt ngưỡng 2,5 ban đầu được giữ riêng, không bỏ khỏi lịch sử. Profile và dữ liệu fixture vẫn nằm trong `local/`; gói bằng chứng không chứa cookie/password. Nguồn API build/splitting tham khảo [esbuild](https://esbuild.github.io/api/#splitting); giấy phép font gốc [Inter](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt), [Plus Jakarta Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt).
