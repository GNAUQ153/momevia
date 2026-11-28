# Auth V4D.1 — Thu hồi các phiên đăng nhập khác

## Nghiệp vụ

Trong `/privacy-center`, người dùng chọn “Đăng xuất các phiên khác”, đọc cảnh báo và xác nhận. Chỉ thu hồi session của tài khoản đang xác thực, ngoại trừ session gửi yêu cầu. Không thay đổi mật khẩu, tài khoản, consent, thiệp hoặc giao dịch. Không thu hồi phiên của Google/Zalo trên hệ thống của nhà cung cấp.

`POST /api/auth/sessions/revoke-others` nhận JSON `{ "confirm": true }`, trả `200 { "ok": true }` khi hoàn thành. Xác nhận sai trả 400, token không còn hợp lệ trả 401, vượt giới hạn tần suất trả 429. Không nhận ID phiên hoặc ID tài khoản đích; không trả JWT, JTI hoặc metadata thiết bị. Gateway tiếp tục kiểm tra Origin với POST. Phản hồi không được cache.

## Lưu trữ

- JSON: kiểm tra token, credential version và bản ghi phiên trước khi lọc. Phù hợp với một tiến trình demo; không bảo đảm khóa nhiều tiến trình.
- MySQL: transaction khóa hàng tài khoản rồi kiểm tra credential version và khóa bản ghi phiên hiện tại trước khi xóa các bản ghi của cùng tài khoản, ngoại trừ JTI hiện tại. Hai thao tác thu hồi cạnh tranh được tuần tự hóa bằng khóa tài khoản. Nếu phiên đã bị thu hồi, thao tác sau không được thực hiện. Không cần migration.
- Các lần xác minh session tiếp theo ở service khác phải kiểm tra lại Identity; request đang xử lý trước khi thu hồi có thể hoàn tất. Một lần đăng nhập mới sau thao tác có thể tạo session mới.

## Nghiệm thu

1. Mở cùng tài khoản trên hai profile trình duyệt độc lập A, B; tài khoản khác C trên profile thứ ba.
2. Tại A, mở Privacy Center. Hủy xác nhận: B vẫn truy cập được.
3. Xác nhận: A vẫn truy cập được; refresh B và gọi API có bảo vệ phải bị từ chối hoặc yêu cầu đăng nhập. C không bị ảnh hưởng.
4. Kiểm tra yêu cầu lặp, mất mạng, hết phiên, VI/EN và responsive. Không coi thông báo lỗi mạng là bằng chứng thao tác chưa thực hiện; có thể thử lại an toàn.
5. Kiểm thử trên MySQL staging và OAuth thật trước production. Dùng tài khoản kiểm thử, không dùng session/token thật trong log.

Giới hạn: chưa có danh sách từng thiết bị, thu hồi từng phiên từ xa hoặc xác thực lại trước thao tác. Nếu nghi ngờ lộ mật khẩu cần đổi/đặt lại mật khẩu; nếu nghi ngờ lộ tài khoản OAuth cần bảo vệ tài khoản ở nhà cung cấp. Thao tác này không thay thế các biện pháp đó.
