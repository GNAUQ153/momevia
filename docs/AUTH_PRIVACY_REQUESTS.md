# Auth V4C.3A — Tiếp nhận yêu cầu thu hồi

- Trang `/privacy-center` có nút mở form Support chuyên biệt, chủ đề lưu cố định `privacy-withdrawal`. Người dùng phải có session hợp lệ; email trong form là thông tin liên hệ do người dùng cung cấp, không phải bằng chứng quyền sở hữu tài khoản.
- `POST /api/support/requests` tái sử dụng lưu ticket, giới hạn gửi và phân quyền hiện có. `userId`, thời điểm, mã và trạng thái do server quyết định. Không gắn yêu cầu thu hồi với báo cáo nội dung.
- `GET /api/support/privacy-requests` chỉ trả `code`, `status`, `createdAt` của tối đa 50 ticket thu hồi gần nhất thuộc session; không trả email, nội dung yêu cầu, người phụ trách hoặc ghi chú nội bộ. MySQL lọc theo ID và topic bằng placeholder; JSON chỉ dùng cho demo một tiến trình.
- Admin nhận yêu cầu tại hàng đợi Support hiện có, có thể nhận xử lý và đánh dấu ticket đã xử lý. `resolved` không phải trạng thái thu hồi consent. Bằng chứng đăng ký, phiên đăng nhập, dữ liệu thiệp và giao dịch không bị thay đổi.
- Không tạo migration hoặc dependency mới. Frontend và backend cần cùng phiên bản; khi backend cũ, lịch sử báo lỗi, không hiển thị trạng thái giả.

## Nghiệm thu trước production

Kiểm tra gửi yêu cầu và lịch sử bằng tài khoản A/B trên MySQL thực tế, Admin nhận và xử lý, đăng xuất/chuyển tài khoản, giới hạn gửi, bản sao lưu. Không yêu cầu mật khẩu hoặc OTP trong ticket. Nhân viên cần xác minh phạm vi và chủ thể, ghi nhận thời điểm tiếp nhận, phân công, xử lý và thông báo kết quả qua kênh đã xác minh; không sử dụng email liên hệ chưa xác minh để tiết lộ dữ liệu cá nhân. Cần quy định thời hạn, phân quyền hỗ trợ, lưu giữ và xóa ticket trước production. Chưa có idempotency server cho POST ticket; kiểm tra lịch sử trước khi gửi lại sau lỗi mạng.

Đây là bước tiếp nhận và theo dõi yêu cầu, không phải hệ thống thực thi thu hồi consent hoặc lịch sử nhiều lần đồng ý. Không thay đổi chính sách dự thảo hoặc tự khẳng định tuân thủ pháp luật.
