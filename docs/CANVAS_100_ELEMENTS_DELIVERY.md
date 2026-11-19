# Bàn giao Canvas 100 thẻ và 24 hiệu ứng

Đợt triển khai ngày 19/11/2026 dùng mục 2 và 3 của [kế hoạch Canvas](CANVAS_100_ELEMENTS_PLAN.md) làm danh mục nghiệm thu. Git bắt đầu từ `main` với WIP Canvas. Các ID, hành vi, fixture V1 và giao diện đang chạy được đối chiếu trước khi mở rộng. Graphify định vị các đường Canvas/Catalog. Bản trích AST hiện tại và số liệu baseline nằm trong [thư mục QA](../local/canvas-100-qa).

| Nhóm | Số thẻ |
|---|---:|
| Chữ | 15 |
| Ảnh | 14 |
| Hình và nét | 15 |
| Sticker | 21 |
| Cụm trang trí | 12 |
| Kể chuyện và kỷ niệm | 8 |
| Tương tác | 15 |
| **Tổng** | **100 ID duy nhất** |

| Đợt | Kết quả |
|---|---|
| 0–1 | 28 ID ban đầu, fixture V1 tĩnh, tìm nhóm và thumbnail lazy qua DOM. Reader và đường publish chấp nhận phiên bản 1 và 2. |
| 2 | 60 thẻ. Đã chạy kiểm số lượng, tính duy nhất và round-trip cho cả danh mục tại mốc. |
| 3 | 79 thẻ. Browser hồi quy cộng dồn vòng Canvas, Sender và Creator. Kiểm source phát hiện một hằng màu chưa dùng ở mốc này và đã chạy lại sau khi hoàn thiện phần ảnh dùng hằng đó. |
| 4 | 90 thẻ. JSON API chạy qua lưu, publish, quyền ảnh và đường đọc cũ. |
| 5 | 100 thẻ. Đã kiểm từng factory và kiểm thao tác trong trình duyệt. |
| 6 | 24 hiệu ứng, gồm 4 bề mặt tĩnh và 20 chuyển động thuộc các họ S, E, A, T, B và R. Kiểm chọn, lưu, xem thử và tắt từng mã. |
| 7 | Kiểm ảnh vòm và album qua thay ảnh, crop, alt, chú thích, nhân bản, undo và tải lại. Ba thiệp tổng hợp chạy trên preview và trang người nhận. |

Nháp V1 giữ phiên bản khi lưu các tính năng V1. Editor nâng tài liệu sang V2 khi lần đầu sử dụng dữ liệu mở rộng. Bộ đọc dùng chung cho preview, quà công khai, Creator/Admin và cover SVG. Cờ vận hành `CANVAS_EDIT_ENABLED` và `CANVAS_PUBLISH_ENABLED` có thể dừng ghi trong khi reader tiếp tục đọc snapshot. Bao phục hồi nháp vẫn dùng phiên bản riêng. ID ô ảnh tương tác được định phạm vi theo ID phần tử, còn tham chiếu asset dùng chung với ảnh lớp.

## Bằng chứng bàn giao

- [Gói ba thiệp QA và ảnh](../local/canvas-100-qa/Momevia-Canvas-QA.zip)
- [Bảng ảnh thu nhỏ 100 thẻ](../local/canvas-100-qa/final/qa-gifts/library-contact-sheet.png) · [Cảnh mở và tương tác trên mobile](../local/canvas-100-qa/final/mobile-contact.png)
- Sinh nhật [JSON](../local/canvas-100-qa/final/qa-gifts/birthday.json) · [desktop](../local/canvas-100-qa/final/qa-gifts/birthday-cover-1440.png) · [mobile](../local/canvas-100-qa/final/qa-gifts/birthday-interaction-390.png)
- Kỷ niệm [JSON](../local/canvas-100-qa/final/qa-gifts/anniversary.json) · [desktop](../local/canvas-100-qa/final/qa-gifts/anniversary-cover-1440.png) · [mobile](../local/canvas-100-qa/final/qa-gifts/anniversary-interaction-390.png)
- Cảm ơn [JSON](../local/canvas-100-qa/final/qa-gifts/thanks.json) · [desktop](../local/canvas-100-qa/final/qa-gifts/thanks-cover-1440.png) · [mobile](../local/canvas-100-qa/final/qa-gifts/thanks-interaction-390.png)
- [Manifest sao lưu và khôi phục MySQL](../local/canvas-100-qa/mysql-final/restore-IjuRVQ/backup/manifest.json)

## Hiệu năng bảng Thêm

Microsoft Edge 157.0.4341.60 trên Windows, Chromium CDP giả lập CPU chậm 4×. Mỗi viewport đo một lần mở đầu tiên riêng, 20 lần mở lại và 20 lần gõ tìm kiếm. Đo từ thao tác DOM tới khung hình kế tiếp và một lượt xử lý hàng đợi. Hai lần chạy dùng cùng tài khoản và nháp giả lập, cùng mã nguồn giao diện tương ứng với từng mốc. Kết quả dưới đây là thời gian trên máy QA, đơn vị ms. [Baseline 28](../local/canvas-100-qa/baseline-performance.json) · [Bản 100](../local/canvas-100-qa/expanded-performance.json)

| Viewport | Mở lần đầu, 28 → 100 | Mở lại p95, 28 → 100 | Lọc p95, 28 → 100 |
|---|---:|---:|---:|
| 390 px | 327,8 → 130,7 | 27,9 → 49,2 | 26,5 → 37,6 |
| 1440 px | 277,5 → 77,5 | 17,5 → 26,9 | 24,8 → 33,1 |

Ở 390 px, mở lại và lọc vẫn trong ngân sách p95 300 ms và 100 ms. Mở lần đầu nhanh hơn, p95 mở lại và lọc tăng cùng quy mô danh mục.

## Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `npm run check` | PASS cú pháp, phạm vi JavaScript, workflow YAML và QR |
| `npm run build` | PASS build web và 24 cover của thư viện mẫu |
| `npm test` | PASS 220/220 |
| `npm run test:canvas` | PASS API JSON, gồm lưu/đọc 100 ID, 3 snapshot V2, quyền ảnh và thu hồi |
| `npm run test:canvas:browser` | PASS Edge. 100 lượt chèn và undo, 24 hiệu ứng, 10 tương tác, 4 viewport, hồi quy V1/Creator. [Log](../local/canvas-100-qa/browser-final.log) |
| `npm run test:templates` | PASS 24 mẫu, 24 SVG cover, seed cũ và CAS khi nạp bộ mẫu |
| `npm run test:canvas:mysql` | PASS 13 ca trên MySQL 8.4.13 cô lập |
| `npm run test:canvas:mysql:api` | PASS 20 ca HTTP/Edge trên MySQL cô lập, gồm khôi phục sang schema mới và đọc quà V1/V2 sau restore |

Kiểm touch trên Edge với viewport và sự kiện chạm giả lập. Kiểm giảm chuyển động, bàn phím, CSS/DOM thumbnail và cover SVG trong QA. Thiết bị cầm tay vật lý, trình duyệt khác và dữ liệu production chưa chạy trong đợt này. Các phép thử thanh toán hồi quy dùng nhà cung cấp giả lập. Thay đổi đang ở working tree.

## Mã nguồn chính

- [Danh mục và tìm kiếm](../web/js/features/canvas-editor/library.js) · [Factory bổ sung](../web/js/features/canvas-editor/library-presets.js) · [Designer](../web/js/pages/designer.js)
- [Registry](../web/js/shared/canvas/registry.js) · [Validator và snapshot](../web/js/shared/canvas/schema.js) · [Cover SVG](../web/js/shared/canvas/cover-svg.js)
- [Player dùng chung](../web/js/features/gift-runtime/index.js) · [Tương tác](../web/js/features/gift-runtime/interactions.js) · [Hiệu ứng](../web/js/features/gift-runtime/effects.js)
- [Lưu và publish](../src/modules/designs/designs.service.mjs) · [Bìa Creator](../src/modules/catalog/creator-routes.mjs) · [Sao lưu JSON](../scripts/dev/canvas-backup.mjs)
- [Kiểm danh mục](../tests/unit/canvas-elements.test.mjs) · [Kiểm trình duyệt](../tests/browser/canvas-expanded.mjs) · [Tạo thiệp QA](../tests/integration/canvas-expanded.mjs)
