# Xuất dữ liệu đối soát Momevia (Beta)

## Phạm vi

- **Creator**: mở `/creator`, chọn **Xuất CSV** trong mục doanh thu. Tải tối đa 100 giao dịch đã xác nhận gần nhất thuộc chính tài khoản đăng nhập.
- **Admin**: mở `/admin/payments`, chọn **Xuất CSV** trong mục ngoại lệ. Tải tối đa 100 đơn bất thường gần nhất mà API nội bộ phát hiện.
- Hệ thống lấy bản ghi mới từ API bảo vệ bằng phiên tại thời điểm người dùng bấm xuất, không lấy kết quả cũ được giữ trong giao diện.
- Không có tính năng xuất từ JSON storage khi chưa có báo cáo MySQL; đây không phải danh sách toàn bộ lịch sử.

## Bảo mật và vận hành

1. CSV chỉ chứa mã đơn, giá trị tài chính, dấu mốc thời gian và cờ dữ liệu; không chứa thông tin người mua, token, chữ ký hay reference thanh toán.
2. Đầu ra có UTF-8 BOM và chặn trường bắt đầu bằng ký tự có thể kích hoạt công thức Excel, kể cả khi có khoảng trắng đầu chuỗi.
3. Dữ liệu thuộc **sandbox** không được cộng chung với **live** để quyết định chi trả.
4. CSV không phải biên lai, xác nhận số dư, quyết định hoàn tiền, chứng từ kế toán hay bảng chi trả đã duyệt. Các ngoại lệ cần đối chiếu nhà cung cấp và bản ghi quyền mua trước khi xử lý.
5. Nút xuất nằm trong giao diện đã phân quyền; **API vẫn phải xác thực vai trò ở backend**. Không dùng bảo vệ bằng nút ẩn thay cho phân quyền server.
6. Không gửi tệp CSV chứa mã đơn ra các kênh công khai. Khi chia sẻ cho bộ phận hỗ trợ, phải xác định đúng người nhận và thời gian lưu trữ.

## Kiểm thử

```bash
npm run build
npm run check
node --test tests/unit/finance-csv-export.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
```

Đường dẫn xuất sử dụng bản build hiện có, không thêm dependency hoặc migration MySQL.
