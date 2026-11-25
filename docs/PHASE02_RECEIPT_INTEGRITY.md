# Phase 2.6A — Đối soát và biên nhận thanh toán

## Phạm vi

- API biên nhận chỉ đọc đơn `paid` của tài khoản đăng nhập. Cần có intent `paid`, số tiền VND khớp đơn, provider khớp và mã tham chiếu không rỗng, khớp chính xác giữa intent và biên nhận. Dùng chung điều kiện với báo cáo ngoại lệ Admin (kể cả dữ liệu NULL).
- Nếu biên nhận thiếu hoặc sai lệch, API trả 404 hiện có; không sửa dữ liệu, không tự cấp lại quyền, không kích hoạt thanh toán mới. Admin cần đối soát bằng nguồn xác thực.
- API trả thêm `paidAt` từ `payment_intents.paid_at` (ghi UTC), không thay đổi trường `issuedAt` cũ. Ngày không hợp lệ không được suy diễn. UI hiển thị mã đơn, thời điểm xác nhận UTC, cảnh báo giao dịch thử nghiệm ngay trên trạng thái đơn và biên nhận, đồng thời giữ lưu ý không phải hóa đơn điện tử VAT. Nút in giữ cơ chế trình duyệt hiện có; chưa có PDF riêng.
- Giữ nguyên các tính năng PR #27, bảng dữ liệu, giá, quyền lịch sử và các feature flag. Không chạy migration hoặc gọi provider thật.

## Nghiệm thu

```sh
node --test tests/unit/phase02-receipt.test.mjs
npm run build
npm run check
npm test
npm run test:canvas:browser
```

MySQL QA/CI: `npm run test:canvas:mysql` kiểm tra biên nhận hợp lệ, quyền sở hữu và sai mã giao dịch trong fixture; `npm run test:canvas:mysql:api` kiểm tra hiển thị ngày và nhãn sandbox trên trình duyệt. Không chạy với MySQL production.

## Ngoài phạm vi

Đây là kiểm tra nhất quán nội bộ, không xác nhận lại giao dịch tại ngân hàng. Chưa xử lý vòng đời giao dịch thất bại/hết hạn, chuẩn hóa mã tham chiếu payOS từ webhook và inquiry, hoàn tiền, tự động khắc phục ngoại lệ, hóa đơn VAT, hoặc xuất PDF riêng. Cần xác minh CI và deployment trước khi phát hành.
