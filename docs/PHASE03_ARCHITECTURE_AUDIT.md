# Phase 3.1 — Kiểm tra kiến trúc và khả năng bảo trì

## Phạm vi và cách chạy

Baseline: ZIP Momevia_Main_Latest_20261125 sau PR #28, áp dụng tiếp patch 2.7A, 2.7B và 2.8. Không xác nhận SHA của toàn bộ cây Git trên remote. Chỉ phân tích JavaScript trong `src/` và `web/js/`, loại trừ `web/js/vendor/`. Không tính CSS, SQL, test, script, HTML, tài nguyên JSON hoặc các service wrapper cũ.

```bash
npm ci
npm run audit:architecture
npm run check:architecture
node --test tests/unit/phase03-architecture-audit.test.mjs
```

Audit dùng AST Acorn (MIT; đã có trong lockfile, nay khai báo trực tiếp là devDependency). Không chạy mã ứng dụng, không đọc `.env`, không kết nối database/provider. Báo cáo JSON in ra stdout. Các cạnh static là import/re-export tương đối, phân biệt với dynamic import literal. Không phân tích import gián tiếp qua chuỗi runtime, package ngoài, alias hoặc module sinh khi build. Các mục `outsideScannedGraph` cần đọc trong ngữ cảnh phạm vi quét, không mặc định là import hỏng. Số dòng vật lý gồm comment; nonblank gồm cả comment. Số nhánh là chỉ số cấu trúc AST (if, vòng lặp, catch, switch case, toán tử logic và ternary), không phải cyclomatic complexity chuẩn hay điểm chất lượng. Callback cũng được tính là hàm riêng.

## Baseline đo được

| Phạm vi | File | Dòng vật lý | Dòng không trống | Class | Hàm/callback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Backend `src/` | 112 | 7.567 | 7.292 | 42 | 1.139 |
| Frontend `web/js/` | 192 | 23.018 | 22.404 | 2 | 2.815 |
| Tổng | 304 | 30.585 | 29.696 | 44 | 3.954 |

948 cạnh import/re-export tĩnh nội bộ phân biệt; 34 dynamic import literal (gồm cả package ngoài phạm vi); 0 dynamic import không xác định. Một nhóm liên thông mạnh tĩnh gồm 4 file; 3 cạnh shared -> module; không có browser -> src trong phạm vi quét.

## Kiến trúc và OOP

Backend là modular monolith, có 7 module: identity, catalog, designs, checkout, payments, gifts, support. HTTP route và service tách repository. Các class service/repository và MySqlClient thể hiện đóng gói trách nhiệm và dependency injection (ví dụ constructor nhận client); repository JSON/MySQL có hợp đồng hành vi tương ứng, là đa hình cấu trúc, không cần ép kế thừa class. Các hàm policy thuần nên giữ dạng function nếu không có trạng thái. Không suy ra mức độ đạt SOLID chỉ từ số class. Frontend dùng ES modules và các hàm; không yêu cầu chuyển sang class hay framework mới.

### Nợ kỹ thuật ưu tiên

| Mức | Phát hiện | Hướng xử lý |
| --- | --- | --- |
| P1 | `config.mjs -> renewal.mjs -> access.mjs -> security.mjs -> config.mjs` | Tách đọc cấu hình khỏi policy nghiệp vụ; giữ nguyên hợp đồng và mặc định bảo mật. |
| P1 | `src/shared/config.mjs` phụ thuộc renewal, quota-config, credentials.service | Đưa primitive cấu hình về shared hoặc composition root; kiểm thử startup. |
| P1 | `web/js/app/main.js`: 1.794 dòng, handleAction 192 nhánh, render 160 nhánh | Tách dispatch/action theo feature, giữ router, focus, VI/EN. |
| P1 | `web/js/pages/designer.js`: 2.739 dòng, action 175 nhánh | Tách điều phối editor theo nhóm nghiệp vụ, giữ autosave/revision, Canvas schema và hiệu ứng của PR #27/28. |
| P2 | `src/modules/designs/mysql.repository.mjs`: 449 dòng; `designs.service.mjs`: 427 dòng | Tách truy vấn/validation theo trách nhiệm, không phá transaction xuất bản. |
| P2 | `web/js/shared/canvas/schema.js`: validateDocument 130 nhánh | Tách validator theo loại phần tử, giữ backward compatibility và fixture. |
| P2 | `web/js/shared/canvas/natural-media.js`: 1.801 dòng | Chủ yếu registry dữ liệu; không mặc định là hàm phức tạp. |
| P2 | `MySqlClient` có pool lazy riêng theo instance, connectionLimit mặc định 5 | Đo số pool/kết nối thực tế rồi mới tối ưu; không đổi limit theo phỏng đoán. |
| P2 | Backend dùng schema Canvas từ web/js, gồm cả phụ thuộc vào frontend feature | Xác định hợp đồng dùng chung trung lập; không di chuyển hàng loạt khi chưa kiểm thử build Hostinger. |

Không có bằng chứng từ audit tĩnh rằng các điểm trên đang gây lỗi production. Cần regression, profiling và đánh giá an ninh riêng. Không có phép đo CPU/RAM, latency, coverage, duplication hay vulnerability scan mới trong audit này.

## Quality gate

`npm run check` gọi `npm run check:architecture`. `docs/architecture-baseline.json` lưu đúng cạnh vi phạm hiện hữu. Gate thất bại nếu thêm cạnh trong nhóm vòng tĩnh hoặc thêm phụ thuộc shared/infrastructure -> modules hoặc browser -> src. Gate không áp trần số dòng hay số class. Khi xóa được cạnh cũ, giảm allowlist tương ứng trong cùng commit để tránh tái đưa nợ cũ vào. Không tăng allowlist chỉ để CI xanh. Thêm test khi mở rộng quy tắc. Không đổi CI workflow, runtime, MySQL, API hay GUI.

## Điều kiện release chưa hoàn tất

Premium quota/repurchase và refund settlement vẫn QA-only; giữ các cờ thử nghiệm tắt trên Railway. Phase 3.1 không xác nhận an toàn production hoặc nghiệm thu nghiệp vụ tài chính thực tế. Phase 3.2A ưu tiên bỏ vòng config/access/security/renewal, chạy unit, architecture integration, build, browser và CI trên baseline mới; chỉ sau đó refactor module lớn.
