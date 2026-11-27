# Phase 3.8 — Nghiệm thu kỹ thuật và Architecture Regression

## Cách chạy

```bash
npm run audit:technical
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

`audit:technical` chỉ đọc source, không đọc `.env`, không chạy mã nghiệp vụ hoặc kết nối MySQL, Railway hay provider. Dùng `npm run --silent audit:technical > dist/reports/technical-audit.json` sau khi tạo thư mục báo cáo. Không đưa báo cáo local vào release. Trước build, vendor chưa sinh được ghi `pending` (exit 0 nếu không có lỗi khác). `check:technical` yêu cầu cả ba vendor đã sinh và được gọi từ `npm run check`; lỗi gate trả exit 1. Tham số không hợp lệ trả exit 2. Không thay workflow CI hoặc thêm dependency.

Gate tổng hợp kiến trúc (không vòng tĩnh hoặc cạnh ngược trong phạm vi đã định), tham chiếu tương đối ngoài graph, định dạng CSS nguồn, manifest font app và checksum migration offline. Ba tham chiếu JSON phải tồn tại; ba cạnh đến vendor sinh từ build có ngoại lệ chính xác theo cả importer và target. Cạnh ngoài graph mới cần rà soát, không mở rộng allowlist tùy tiện. Kiểm tra này không chứng minh named export hợp lệ hoặc mọi URL/dynamic import đều hoạt động. Unused export, số nhánh AST, tài nguyên trùng là advisory; không tự xóa tài nguyên, không coi số nhánh là cyclomatic complexity chuẩn.

## OOP và Maintainability

Backend modular monolith với 7 module nghiệp vụ, service/repository và MySqlClient dùng chung tại composition root; các repository JSON/MySQL có hợp đồng hành vi tương ứng. Không cần thêm class vào helper thuần. Frontend ES modules, dispatcher và lifecycle đã tách một phần. Các file `web/js/pages/designer.js` (action), `web/js/app/main.js` (render), `web/js/shared/canvas/schema.js` (validateDocument) vẫn là điểm ưu tiên khi sửa tính năng liên quan. Không áp ngưỡng số dòng tùy ý hoặc refactor hàng loạt trước khi nghiệm thu UI.

## Ma trận nghiệp vụ và điều kiện release

Đối chiếu `PHASE02_BUSINESS_REGRESSION.md` (BR01–BR12); audit tĩnh không chạy các ca này. CI hiện có kiểm thử unit, HTTP, browser, MySQL fixture và gói release. Ghi SHA, run ID và kết quả trước khi nghiệm thu bản triển khai.

| Vai trò | Phạm vi đã có kiểm thử | Chưa được chứng minh bởi audit này |
| --- | --- | --- |
| Guest | Auth, catalog, quyền truy cập mẫu | OAuth thực tế, responsive VI/EN, chuyển đổi marketing |
| Sender | Draft/publish, Free/Premium, chia sẻ, gia hạn | Export trên thiết bị thật, quota/repurchase live, thanh toán/hoàn tiền thật |
| Recipient | Link riêng, RSVP, reply, snapshot | UX mobile, âm thanh/animation, link hết hạn trong production |
| Creator | Draft, submit/review, quyền truy cập | Canvas review, quy trình payout và quyền tài chính thực tế |
| Admin | Role enforcement, duyệt mẫu, finance/refund QA | Đối soát provider, xử lý khiếu nại, audit vận hành |

P0: giữ các cờ tài chính thử nghiệm tắt theo Phase 2.8 cho đến khi xác minh dữ liệu lịch sử, webhook và chính sách refund/quota. Không bật live bằng patch này. P0: kiểm tra cấu hình production, schema/integrity, persistent volume và backup/restore cô lập; không chạy fixture trên database Railway production. P1: đo CPU/RAM/network, HTTP load trên QA, Web Vitals và UX trình duyệt thật. CI xanh không đồng nghĩa dữ liệu production sạch, pentest đạt hoặc sẵn sàng thương mại hóa.

Sau khi CI nghiệm thu Phase 3.8, có thể chuyển sang Phase 4 (Design System & Typography), giữ các điều kiện release chưa đóng trong backlog. Không thay đổi UI, API, schema, font hoặc cấu hình deployment trong phase này.
