# Auth V4D.3B — Thu hồi từng phiên đăng nhập

Truy cập `/account-sessions`, chọn một phiên khác, nhấn Đăng xuất phiên này và xác nhận. Phiên hiện tại không có nút thu hồi. Hủy xác nhận không gửi yêu cầu. Sau thành công, giao diện đọc lại danh sách; khi mất mạng hoặc tham chiếu cũ, yêu cầu làm mới danh sách thay vì tự gửi lại.

`GET /api/auth/sessions` thêm `revokeRef` (HMAC-SHA256 hex 64 ký tự) chỉ cho phiên khác đủ điều kiện. Không phải JWT/JTI hay thông tin thiết bị; ràng buộc với tài khoản, JTI của phiên thực hiện, credential version và ID đích. Không lưu client storage. `POST /api/auth/sessions/revoke` nhận `{ ref, confirm: true }`, dùng rate limit `session` hiện có; trả `{ ok: true }`, 400 dữ liệu sai, 401 phiên yêu cầu không hợp lệ, 404 đích không còn khả dụng hoặc tham chiếu sai, 429 giới hạn tần suất. Không nhận userId đích. Không cache.

MySQL khóa user và phiên thực hiện, kiểm tra credential version, giới hạn 49 phiên khác theo cùng thứ tự danh sách, tìm HMAC tương ứng và DELETE đúng hàng thuộc tài khoản. Nếu phiên đã hết hạn/thu hồi, không báo thành công. JSON dùng xử lý đồng bộ một tiến trình. Không migration mới; yêu cầu 020 đã áp dụng trước đó. Không thay đổi logic revokeOthers, password change, OAuth, thiệp hoặc giao dịch. Phiên legacy chưa xác minh không có thao tác riêng; dùng chức năng đăng xuất các phiên khác nếu cần thu hồi chúng. Không thu hồi phiên Google/Zalo phía provider.

Giới hạn: danh sách tại thời điểm truy vấn không phải trạng thái trực tuyến. Nếu 50 phiên thay đổi thứ tự, tham chiếu ngoài cửa sổ phải làm mới. Request đã được xác thực trước khi thu hồi có thể hoàn tất. HMAC là tham chiếu hành động, không phải thông tin xác thực độc lập. Rate limit hiện chỉ trong tiến trình. Không thay đổi 020.

Nghiệm thu staging: hai hoặc ba browser profile cùng tài khoản và một tài khoản khác; hủy, thu hồi một phiên, thử API bảo vệ từ phiên bị thu hồi, kiểm tra phiên hiện tại và phiên còn lại, thử lại tham chiếu cũ, kiểm tra cả revokeOthers và password change. Chạy MySQL thật với migration 020 và kiểm tra transaction cạnh tranh trước production. Không log token hoặc tham chiếu hành động.
