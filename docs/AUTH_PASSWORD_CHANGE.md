# Auth V4D.2B — Đổi mật khẩu khi đã đăng nhập

- POST `/api/auth/password/change`: session hợp lệ, `currentPassword`, `password`, `confirmPassword`, `confirmLogout: true`; không nhận userId.
- Chỉ tài khoản email có credential local. Kiểm tra mật khẩu hiện tại bằng scrypt, kiểm tra quy tắc mật khẩu mới, xác nhận khác mật khẩu cũ.
- Từ V5.1A: băm ngoài transaction, kiểm tra lại phiên trong cùng transaction mutate; khóa user rồi session, kiểm tra hash, credential version và hạn phiên trước khi ghi. Xóa challenge OTP cũ; tăng credential version để vô hiệu hóa toàn bộ JWT cũ. Không cấp JWT mới, xóa cookie hiện tại; người dùng đăng nhập lại.
- Giới hạn theo IP và global dùng AuthLimits hiện có. Không ghi log mật khẩu hoặc lưu client storage. Không thu hồi Google/Zalo; không tác động dữ liệu thiệp.
- Các request đã được cấp quyền trước khi đổi mật khẩu có thể hoàn tất. Nếu thu hồi phiên đã hoàn tất trước khi transaction kiểm tra phiên, đổi mật khẩu bị từ chối 401. Nếu đổi mật khẩu đã giữ khóa và ghi trước, thu hồi phải đợi transaction kết thúc. Rate limiting hiện tại chỉ trong tiến trình. Không tuyên bố đã kiểm thử MySQL production.
- UI ở `/privacy-center`, chỉ render với tài khoản email; xác nhận đăng xuất tất cả phiên. Khi lỗi mạng, có thể thao tác đã hoàn tất; cần kiểm tra đăng nhập trước khi thử lại.
