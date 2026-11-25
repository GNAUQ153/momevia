# Phase 2.6B — Bằng chứng thanh toán và đối soát

- payOS: inquiry chỉ tự xác nhận đơn PAID khi đủ tiền và có đúng một giao dịch đầy đủ với reference hợp lệ. Webhook dùng reference giao dịch từ dữ liệu SDK đã xác minh, không dùng paymentLinkId thay thế. ID link được đối chiếu với intent nếu đã lưu; nếu webhook tới trước khi lưu link, lưu ID đã xác minh trong transaction.
- MoMo: không ép null, false hoặc chuỗi rỗng thành resultCode 0; loại transId bằng 0, số không an toàn và IPN thành công có requestId khác orderId (luồng create hiện dùng cùng một ID).
- Replay chỉ thành công nếu cùng reference với intent đã paid; reference khác bị từ chối HTTP 409. Không sửa biên nhận, quyền hoặc ledger đã ghi. Đơn lịch sử payOS lưu ID link thay reference cần rà soát thủ công nếu phát sinh xung đột.
- Đối soát theo mã đơn kể cả khi mất ACK tạo link, vẫn xác thực chủ đơn, scope và rate limit. CANCELLED/EXPIRED hoặc khoản chuyển nhiều lần được trả terminal_review, không giải phóng khóa hoặc tự tạo đơn mới. Không thêm trạng thái DB.
- Không migration, không thay đổi cờ QA, không sửa frontend. Không gọi provider thật trong unit test. Cần kiểm thử tích hợp MySQL cô lập và SDK/provider thật trước khi bật thanh toán Live; đối soát giao dịch nhiều khoản và retry sau khi hủy vẫn chưa triển khai.

Tài liệu tham chiếu: https://payos.vn/docs/api/ và https://payos.vn/docs/du-lieu-tra-ve/webhook/ (ID link khác mã giao dịch).
