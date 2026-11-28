# Auth V4D.2A — Bảo mật đặt lại mật khẩu

- Giữ nguyên API recovery, verify-email, thời hạn OTP 15 phút, cooldown 60 giây, tối đa 5 lần nhập sai và quy tắc mật khẩu hiện hành.
- Kiểm tra OTP và ghi nhận lần thử sai trong mutate. Chỉ băm mật khẩu khi mã hợp lệ. Không giữ transaction MySQL trong lúc chạy scrypt.
- Kiểm tra lại challenge, thời hạn, lượt thử, email và credential version trước khi cập nhật. Một challenge chỉ được sử dụng thành công một lần. Khi hash lỗi, mã vẫn dùng được nếu còn hiệu lực.
- Tăng credential version khi đổi thành công để các JWT cũ không còn hợp lệ; không thay đổi phiên Google/Zalo hoặc chính sách consent.
- Từ chối hash/challenge hỏng thay vì gọi crypto với buffer không hợp lệ. Không trả hoặc ghi log OTP/hash.

## Nghiệm thu

Chạy `node --test tests/unit/recovery-security.test.mjs tests/unit/identity-recovery-unverified.test.mjs tests/unit/credentials.test.mjs tests/unit/sessions.test.mjs`. Kiểm tra thêm MySQL thật, email relay staging và toàn bộ UI recovery trước triển khai. JSON chỉ hỗ trợ local một tiến trình; kiểm thử đồng thời không thay thế kiểm thử DB đa tiến trình.

## Ngoài phạm vi

Chưa bổ sung đổi mật khẩu khi đang đăng nhập, MFA, danh sách thiết bị hoặc rate limiter phân tán. Không thay đổi schema, môi trường hoặc dependency.
