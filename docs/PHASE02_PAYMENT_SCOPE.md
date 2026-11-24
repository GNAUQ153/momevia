# Phase 2.4B1 — Ranh giới xác nhận thanh toán

- Scope do cấu hình server quyết định: `production` = live, `sandbox` = thử nghiệm MoMo ngoài production; payOS chỉ live. Không dùng dữ liệu scope do client/webhook tự khai. Thiếu cấu hình thì từ chối.
- `settleVerified(event, expectedIsTest)` bắt buộc scope boolean. So khớp với `orders.is_test` trong transaction khóa đơn, trước replay hoặc bất kỳ cập nhật nào. Webhook hợp lệ cùng scope vẫn hoạt động khi tắt tạo giao dịch mới.
- API status giữ lịch sử nhưng không trả link pending khác scope hoặc không rõ scope; không trả link khi đơn đã kết thúc. Đối soát dùng chung kiểm tra. Không sửa đơn/quyền đã có.
- Không đổi schema, không xóa khóa checkout, không thu tiền hoặc cấp quota mới. Cần kiểm tra cấu hình PAYMENT_ENV và giữ credential đúng môi trường trên Railway.

## Điều kiện trước khi bật giới hạn lượt xuất bản (2.4B2 trở đi)

1. Đối soát đơn thật, sandbox, demo và unknown; không suy nguồn từ payload. Bảo toàn quyền lịch sử theo chính sách công bố, không tự quy đổi số thiệp hiện có thành lượt đã tiêu hao.
2. Thiết kế khóa checkout theo phạm vi + định danh lần mua; không chỉ thêm scope vào khóa cũ vì vẫn không thể mua lần thứ hai trong cùng scope. Tạo migration additive, đối chiếu dữ liệu và giữ khóa pending chưa được provider xác nhận hủy. Cần thử nâng cấp từ schema 016 và kiểm tra rollback ứng dụng trước deploy.
3. Lượt mua mới phải gắn với entitlement/order, có sổ tiêu hao bất biến và unique publication ID; cấp/tiêu hao trong transaction, kiểm tra trước cả luồng Canvas và legacy, retry cùng idempotency key không tiêu hao lại. Thu hồi/xóa/hết hạn không tự hoàn lượt. Không đổi quyền lịch sử khi chưa có chính sách rõ.
4. Kiểm thử đồng thời hai request, retry, rollback khi ghi snapshot thất bại, hoàn tiền, quyền cũ và quá trình mua thêm. Không chạy fixture trên Railway production.

## Kiểm thử

`node --test tests/unit/phase02-payment-scope.test.mjs`

`npm test` và pipeline MySQL riêng (`npm run test:canvas:mysql`) trên schema QA trống, tuyệt đối không dùng DB production.
