# Momevia — Kiểm soát đối soát tài chính (read-only)

## Nghiệp vụ

- Creator được xem lịch sử bán mẫu đã xác nhận, tách giao dịch thật và sandbox, **không phải số dư có thể rút**.
- Admin có báo cáo tổng và bảng **ngoại lệ đối soát**, gồm: ý định thanh toán thiếu/sai trạng thái, biên nhận thiếu/sai, quyền đã cấp thiếu/bị thu hồi, bút toán Creator không khớp và tổng phân chia tiền sai.
- Không thêm nút hoàn tiền, xác nhận thanh toán bằng tay, chi trả hoặc sửa ledger. Nguồn sự thật về thanh toán vẫn là nhà cung cấp.

## API và phân quyền

- `GET /api/checkout/payments/admin/finance/exceptions?limit=50` — bắt buộc Admin; `limit` 1–100; MySQL.
- API trả `orderId`, `provider`, `sandbox`, `amountVnd`, `createdAt`, `issues[]`. Không trả người mua, email, provider reference, khóa hoặc thông tin nhạy cảm.
- Đối soát chỉ quét đơn `status='paid'` thuộc `momo` hoặc `payos`; không xem giao dịch demo là doanh thu thật.
- Nếu DB/endpoint không khả dụng, UI hiện 'không thể tải', không hiện sai là 0 bất thường.

## Giới hạn và bước tiếp theo

1. Sai lệch attribution so với Creator hiện tại của mẫu là **tín hiệu điều tra**, không phải kết luận gian lận. Nên lưu creator snapshot trong order tại thời điểm thanh toán trước khi mở chi trả.
2. Chưa có đối soát chủ động giữa ngân hàng/PSP với sổ cái. API chỉ tìm sự cố **nội bộ**; vẫn cần webhook/cổng đối soát có xác thực.
3. Chưa xử lý refund provider, dispute, phí gateway, thuế hay payout. Ledger sale không đại diện số dư khả dụng. Chưa tự động thu hồi quyền hoặc tạo bút toán refund khi nhận phản hồi chưa xác minh.
4. Nên thiết kế migration cho yêu cầu hoàn tiền, sự kiện PSP hoàn tiền có xác thực, khóa chống hoàn trùng, bút toán đảo, đối soát thủ công, rồi mới xây workflow chi trả có phê duyệt hai bước.
5. Dữ liệu bất thường vượt `limit` sẽ không được liệt kê đầy đủ; API giới hạn tối đa 100 để tránh truy vấn nặng. Cần quy trình quét định kỳ theo kỳ và chỉ số monitoring khi triển khai thực tế.

## Kiểm tra

```bash
npm run build
npm run check
npm test
npm run test:browser
```

Để dùng dữ liệu thật cần `CHECKOUT_STORAGE=mysql` và migrations đã được áp dụng. Không tự ý bật `PAYMENT_LIVE_ENABLED` hoặc thực hiện giao dịch thật để test màn hình.
