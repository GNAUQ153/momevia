# Phase 2.7B — Mô phỏng nhất quán hoàn tiền (QA)

## Phạm vi

Đây là module nội bộ `RefundSettlementQa`, không đăng ký vào router hoặc app production. Không gọi payOS/MoMo, không tạo bằng chứng hoàn tiền thật, không tự mở khóa checkout. Chỉ mô phỏng hoàn toàn phần cho đơn Sandbox trong MySQL QA cô lập, có credit chưa tiêu hao và hồ sơ đang chờ provider. Quyền lịch sử, credit đã dùng, ledger thiếu/sai/điều chỉnh hoặc đơn Live bị từ chối. Với đơn có phần Creator dương nhưng không có sale (kể cả mẫu hệ thống), mô phỏng từ chối thay vì suy đoán người nhận tiền.

## An toàn và transaction

- Cờ `REFUND_SETTLEMENT_QA_ENABLED=true` chỉ được truyền trong fixture QA; mặc định tắt. Bắt buộc NODE_ENV=test, PAYMENT_ENV=sandbox, không Railway, không Live, host 127.0.0.1, tên schema `momevia_canvas_qa_*`, xác nhận cô lập và kiểm tra DATABASE() tại transaction.
- Khóa chủ tài khoản trước khi khóa hồ sơ, order, intent, receipt, entitlement và credit. Đối chiếu giao dịch paid gốc và ledger; không dùng Creator hiện tại của mẫu làm căn cứ đảo doanh thu.
- Cập nhật order/payload, thu hồi entitlement, thêm transaction hoàn tiền mô phỏng có mã `qa-refund:<UUID>`, đảo sale và ghi audit trong cùng transaction. Không xóa receipt, intent paid, credit, thiệp hoặc khóa checkout. Retry đúng mã và dữ liệu hoàn trả chỉ đọc; mã khác bị từ chối.
- Hồ sơ vẫn `awaiting_provider` vì chưa có xác nhận thật. Intent vẫn paid để lưu sự kiện gốc; API trạng thái và biên nhận production chưa được thiết kế cho order refunded. Không bật hoặc nối module này vào API production.

## Kiểm thử

`node --test tests/unit/phase02-refund-settlement.test.mjs` kiểm tra chính sách và transaction mock.

`npm run test:canvas:mysql` chỉ chạy với fixture MySQL 8.4 trên schema QA rỗng, cô lập, theo hướng dẫn của dự án. Ca mới kiểm tra rollback lỗi ledger, cạnh tranh hai connection, replay, quyền, receipt gốc, webhook paid đến sau và credit đã dùng.

## Trước khi triển khai thật

Cần adapter xác minh bằng chứng hoàn tiền từ provider theo hợp đồng chính thức; mô hình hồ sơ hoàn tất, lịch sử biên nhận và API trạng thái sau hoàn; xử lý khóa checkout/mua lại; chính sách credit đã dùng, hoàn một phần và điều chỉnh Creator đã thanh toán. Phải nghiệm thu MySQL, kiểm thử đồng thời, đối soát dữ liệu lịch sử và điều khoản kinh doanh. Không chạy fixture trên Railway, kể cả qua tunnel loopback.
