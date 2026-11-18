# Momevia — Identity Recovery & Admin Payment Operations (2026-11-18)

## Phạm vi

Bản cập nhật dựa trên `Momevia_Main_Phase2B_Latest.zip`; giữ kiến trúc Modular Monolith, API và migration MySQL hiện tại (`001`–`009`). Không tạo migration mới, không thay đổi cơ chế xác minh webhook, không mở thanh toán live.

### 1. Khôi phục mật khẩu khi chưa xác minh email

- Với tài khoản `provider='email'`, `/api/auth/recover/request` phát mã 8 chữ số gửi đến địa chỉ email đã đăng ký kể cả khi `emailVerifiedAt` đang rỗng. API vẫn phản hồi chung `202` để không tiết lộ địa chỉ email có tài khoản hay không.
- `/api/auth/recover/confirm`: kiểm tra mã đúng mục đích, còn hạn, chưa dùng, thuộc tài khoản, sau đó băm mật khẩu mới bằng `scrypt`; tăng `credentialVersion`, xóa mã reset và đặt `emailVerifiedAt` nếu trước đó chưa xác minh. Việc nhập mã email hợp lệ được xem là chứng minh quyền sở hữu chính địa chỉ đó.
- Hạn mã 15 phút; giới hạn gửi lại 60 giây; khi nhập sai 5 lần thì vô hiệu hóa mã. Đăng nhập OAuth không được chuyển thành đăng nhập mật khẩu bằng cơ chế này.
- Các session cũ không còn hợp lệ do `credentialVersion` tăng. Các món quà và mẫu đã sở hữu vẫn nằm trong tài khoản cũ.
- **Điều kiện vận hành:** cấu hình `RECOVERY_MAIL_URL` và `RECOVERY_MAIL_TOKEN` cho HTTPS mail relay. Không có relay thì reset trả lỗi `503`, không có email nào được gửi. Kiểm tra delivery thực tế trước production.

### 2. Admin Payment Operations

- Mở từ menu Admin hoặc URL `/admin/payments` sau khi đăng nhập bằng tài khoản Admin.
- Dùng API `GET /api/checkout/payments/admin/review?limit=100`: danh sách **tối đa 100 đơn chờ quá 30 phút**, không phải toàn bộ giao dịch, không phải doanh thu toàn sàn. Tìm mã đơn và lọc client-side theo provider hoặc trạng thái đối soát.
- Nút "Xem lịch sử đối soát" chỉ đọc API `GET /api/checkout/payments/admin/orders/{orderId}/audit?limit=50`; UI không cho thay đổi trạng thái đơn.
- Không hiển thị secret, checkout URL, QR payload hay thông tin thanh toán nhạy cảm. Phân quyền Admin vẫn phải được xác thực ở Backend. Không cho phép Admin tự đánh dấu paid/cancel/refund, mở khóa retry hoặc tạo biên nhận thủ công.
- Một database không có giao dịch chờ trên 30 phút sẽ hiển thị danh sách rỗng. Điều này **không** chứng minh toàn bộ thanh toán đã hoàn tất.

## Kiểm thử trước khi commit/push

```bash
node --test tests/unit/identity-recovery-unverified.test.mjs tests/unit/admin-payment-ui.test.mjs
npm ci
npm run build && npm run check && npm test
npm run test:architecture && npm run test:canvas && npm run test:canvas:mysql && npm run test:canvas:mysql:api
npm run package && npm run verify:package
npm run db:ping && npm run db:verify
```

Tiếp tục QA thủ công:

1. Với email chưa xác minh: đăng ký → tạo quà/nháp → yêu cầu mã reset → nhập mã đúng → kiểm tra `emailVerified=true`, đăng nhập mật khẩu mới, session cũ không còn hiệu lực và nội dung vẫn thuộc chủ tài khoản.
2. Kiểm tra mã hết hạn, mã đã dùng, nhập sai liên tiếp, rate limiting và email không tồn tại (phản hồi thống nhất).
3. Với tài khoản Admin: truy cập `/admin/payments`, lọc provider/đơn, xem audit, thử bấm refresh; kiểm tra trên desktop và mobile.
4. Với Sender/Creator/Guest: mở `/admin/payments` phải bị từ chối, không lộ danh sách qua API khi không có quyền.
5. Kiểm thử trên **MySQL thật và mail relay test**. Test với dữ liệu không chứa thông tin cá nhân thật.
6. Sau push lên `main`, kiểm tra các job GitHub Actions và README Auto Sync. Không bật thanh toán live chỉ vì CI xanh.

## Giới hạn còn lại

Chưa hoàn thiện cancellation/retry an toàn, payout Creator, refund, đối soát báo cáo tổng doanh thu hoặc dashboard toàn bộ giao dịch. Không giả định `payment_reconciliation_attempts` là sổ cái kế toán.
