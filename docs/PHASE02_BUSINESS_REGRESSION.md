# Phase 2.8 — Nghiệm thu hồi quy nghiệp vụ

## Baseline và phạm vi

Bản ZIP sau PR #28 kết hợp patch 2.7A và 2.7B, tương ứng với các chức năng đã tích hợp trước ảnh CI run 45596057703. Commit `95b735a` trên máy phát triển gồm cập nhật README sau CI; bản vá không sửa README. Không coi source tái dựng là bản sao đã xác minh byte-for-byte của commit GitHub.

Bản vá chỉ bổ sung kiểm thử và tài liệu; không bật tính năng hoặc thay đổi chính sách Free/Premium, giá, thời hạn, tài chính hay database. Không kết nối Hostinger, Railway, payOS/MoMo. Các ca JSON dùng thư mục tạm; HTTP dùng fixture test có sẵn. MySQL chỉ chạy trên schema QA cô lập. Không chạy fixture với credential hoặc tunnel production.

## Ma trận nghiệm thu

| ID | Vai trò/luồng | Kiểm thử và kỳ vọng |
| --- | --- | --- |
| BR01 | Guest, Creator, Admin | `phase02-business-journey.test.mjs`: mẫu Legacy chờ duyệt không xuất hiện công khai, không mua/tạo thiết kế; Creator không tự duyệt, Admin duyệt, chưa cấp quyền Premium |
| BR02 | Sender, Recipient | Cùng file: Free không tạo order; publish/retry một snapshot; tài khoản khác không xuất bản thiết kế; link riêng yêu cầu invite, không được đọc phản hồi |
| BR03 | Sender, Checkout | Cùng file: Premium chưa mua bị 402; mua demo không cấp quyền tài khoản khác; quyền đổi sau preflight thì publish bị chặn; replay không tạo thiệp/đơn trùng; production từ chối mua demo |
| BR04 | Sender, Recipient | Cùng file: thiệp mời có hai khách trùng tên; RSVP độc lập; gia hạn đồng thời chỉ một lần; giờ sự kiện vẫn đóng RSVP; thu hồi/lưu trữ/khôi phục danh sách không mở link hoặc mất RSVP |
| BR05 | Creator, Admin | Cùng file: nháp Creator không xuất bản như thiệp Sender; hạ quyền làm mất quyền đọc nháp qua service và quyền xem dữ liệu Admin |
| BR06 | Guest, Sender, Creator, Admin | `tests/integration/architecture.mjs`: ma trận HTTP 7 endpoint x 4 vai trò; JSON finance trả 503 cho người có quyền, 403 khi sai quyền; session Creator bị hạ role không đọc được báo cáo |
| BR07 | Guest, đăng nhập/đăng ký | `architecture.mjs`, `auth-*.test.mjs`, `roles.test.mjs`, `sessions.test.mjs`: đăng ký trùng, origin, xác thực, session và rate limit |
| BR08 | Sender, Recipient, media | `canvas.mjs`, `rsvp.mjs`, `reply-intents.mjs`, `canvas-mysql-api.mjs`: quyền riêng tư, reply, snapshot, lưu trữ và thu hồi; browser/mobile cần chạy riêng |
| BR09 | Creator, Admin | `creator-*.test.mjs`, `creator-journey.mjs`, `canvas-mysql.mjs`: version mẫu, gửi duyệt, feedback, finance; BR01 chỉ kiểm tra luồng Legacy, không thay ca Creator Canvas |
| BR10 | Payment | `phase02-payment-scope.test.mjs`, `phase02-payment-lifecycle.test.mjs`, `phase02-receipt.test.mjs`, `canvas-mysql.mjs`: bằng chứng, scope, replay, biên nhận và đối soát |
| BR11 | Quota, mua thêm | `phase02-checkout-keys.test.mjs`, `phase02-publication-credit.test.mjs`, `phase02-repurchase.test.mjs`, `canvas-mysql.mjs`: migration 017–019, transaction, credit, mua thêm Sandbox QA |
| BR12 | Refund | `phase02-refund-assessment.test.mjs`, `phase02-refund-settlement.test.mjs`, `canvas-mysql.mjs`: hồ sơ, đối soát, hoàn mô phỏng, rollback, ledger |

BR01–BR05 là test liên kết nhiều service với JSON repository thực, không phải HTTP E2E. BR03 thay đổi trạng thái đơn thử nghiệm trực tiếp trong fixture để mô phỏng quyền mất hiệu lực, không thực hiện refund. BR04 rút ngắn hạn trong fixture để kiểm tra cửa sổ gia hạn; không chờ thời gian thực. BR05 lấy role hiện tại từ repository; BR06 kiểm tra session HTTP thật. BR07–BR12 là nhóm kiểm thử hiện hữu, không phải test case mới của patch.

## Lệnh nghiệm thu

```bash
node --test tests/unit/phase02-business-journey.test.mjs
npm run build
npm run check
npm test
npm run test:architecture
npm run test:browser
npm run test:canvas:browser
```

Các ca BR01–BR05 tự chạy trong `npm test`, BR06 tự chạy trong HTTP architecture regression, không thêm job CI hoặc service. MySQL 8.4 và release package dùng workflow hiện tại. Khi kiểm thử MySQL thủ công, dùng đúng quy trình fixture QA của dự án; không trỏ database production. Chỉ khi build/check, unit, HTTP, browser, MySQL và release package đều xanh mới ghi nhận nghiệm thu CI của commit. Ghi lại SHA, run ID, kết quả test và các lỗi chưa xử lý. CI xanh không chứng minh thanh toán thật, tính chính xác dữ liệu lịch sử hoặc UX production.

## Điểm chưa nghiệm thu để release

| Mức | Hạng mục | Điều kiện đóng |
| --- | --- | --- |
| P0 | Quota Premium và mua thêm Live | Chốt điều khoản, đối soát quyền lịch sử/demo/sandbox, bảo toàn khách hàng cũ, kiểm thử mua thêm và webhook thật; migration 017–019 phải được sao lưu và nghiệm thu riêng |
| P0 | Hoàn tiền thật | Xác minh bằng chứng provider; chính sách hoàn một phần/credit đã dùng, bút toán đã payout, API và biên nhận sau hoàn; QA mô phỏng không đủ |
| P0 | Pending/expired payment | Xác minh trạng thái kết thúc từ provider trước khi mở khóa hoặc tạo intent mới; không dựa vào timeout đơn thuần |
| P1 | Gia hạn thiệp | Chốt thời hạn Free/Premium và chính sách gia hạn, chưa bật mặc định |
| P1 | Creator/Recipient | Kiểm tra quy trình Canvas Creator, tài nguyên động, kênh báo cáo vi phạm và khả năng truy cập thực tế trên mobile |
| P1 | Production deployment | Xác minh commit backend, bản build frontend, migration, backup/restore, kiểm tra link/ảnh/VI-EN trên staging; không dựa vào mỗi trạng thái GitHub Actions |

Giữ `PAYMENT_SCOPED_CHECKOUT_ENABLED=false`, `PUBLICATION_QUOTA_QA_ENABLED=false`, `GIFT_RENEWAL_DAYS=0` theo cấu hình đang đề xuất. Không bật `REFUND_SETTLEMENT_QA_ENABLED` trên Railway. Đây là danh sách chặn release các tính năng mới, không phải kết luận tất cả chức năng production hiện tại bị lỗi.

Sau khi CI nghiệm thu bản vá, chuyển sang Phase 3 (Architecture, OOP & Maintainability); các mục P0 chưa đóng phải tiếp tục là điều kiện chặn bật tính năng tài chính tương ứng.
