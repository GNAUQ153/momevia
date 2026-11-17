# Momevia — Đề xuất chính sách Freemium và Bảng giá (v1.2)

> **Trạng thái: đề xuất, chưa phê duyệt hoặc mở bán.** Trang `/pricing` hiện là bản giới thiệu, không đăng ký hoặc trừ tiền thuê bao.

## 1. Quyết định sản phẩm đề xuất

Không dùng **trial 7 ngày rồi bắt buộc trả phí** cho mọi người dùng. Hành vi gửi quà mang tính dịp đặc biệt, không thường xuyên; ép thuê bao sau trial dễ làm tăng rào cản và tỷ lệ hủy. Nên phân biệt:

- **Freemium:** một số mẫu giá 0đ dùng được không giới hạn theo thời hạn gói, tuân thủ quy định và giới hạn chống lạm dụng.
- **Pay-per-template:** người gửi chọn mẫu tính phí, thanh toán đúng giá hiển thị; không phải mua thuê bao. Đã có phần nền tảng trong v1.1, nhưng muốn thu tiền thật cần thử nghiệm gateway và xác minh webhook.
- **Creator Pro:** gói tùy chọn **dự kiến** cho nhà sáng tạo có nhu cầu công cụ nâng cao. Chỉ triển khai sau khi đo đủ nhu cầu và chi phí.

Đừng gộp quyền mua mẫu vào gói thuê bao khi chưa xác định mô hình bản quyền/chiết khấu Creator; cần tách `template_entitlements` khỏi `subscription_entitlements`.

## 2. Gợi ý cấu trúc trang Bảng giá

| Phương án | Đối tượng | Giá hiển thị | CTA | Trạng thái |
|---|---|---|---|---|
| Mẫu miễn phí | Người gửi | 0đ cho mẫu miễn phí | Khám phá mẫu miễn phí | Có catalog mẫu miễn phí |
| Mua theo mẫu | Người gửi cần thiết kế trả phí | Giá của từng mẫu | Xem thư viện mẫu | Chờ gateway được bật / thử nghiệm |
| Creator Pro | Nhà sáng tạo chuyên nghiệp | Chưa công bố | Tìm hiểu Creator Studio | Chưa mở bán |

*Không đặt giá gói Pro/Premium hoặc hứa hẹn dùng thử 7/14 ngày khi chưa có tính toán chi phí, điều khoản và logic backend.*

## 3. Điều kiện nếu thí điểm Creator Pro trial

- Thử nghiệm **14 ngày** là **giả thuyết để A/B test**, không phải cam kết chính thức.
- Cần ghi rõ ngày bắt đầu/kết thúc, tính năng có/không, giá sau trial, thời điểm thu tiền, gia hạn/hủy và hoàn tiền.
- Không tự động thu tiền khi hết trial nếu chưa có sự đồng ý rõ ràng và ủy quyền phương thức thanh toán theo yêu cầu cổng thanh toán.
- Hết hạn: hạ tính năng Pro về mức Free; không xóa tác phẩm của Creator. Xác định chính sách cho tài sản vượt quota trước khi triển khai.
- Không lưu thẻ ngân hàng trong database Momevia; sử dụng token hóa/mandate do PSP cung cấp khi được hỗ trợ hợp lệ.

## 4. Công việc kỹ thuật v1.2 sau khi chốt mô hình

1. Quy định quyền lợi và giá cụ thể, ký duyệt các điều khoản thanh toán.
2. Xây migration `plans`, `subscriptions`, `subscription_events`, `subscription_entitlements` (không sửa dữ liệu demo hiện có); bổ sung RBAC/limit gates.
3. Tạo API đọc giá và chính sách từ server thay vì hardcode frontend.
4. Thử sandbox cho subscribe, renewal, cancel, grace period, refunds, webhook duplicate, expired, promotion code; ghi audit log và idempotency.
5. Trang My Plan/Quản lý gói với lịch sử hóa đơn, hủy, ngày gia hạn; phân biệt **biên nhận thanh toán** với hóa đơn điện tử hợp lệ về thuế.
6. Đánh giá doanh thu: conversion free→paid, ARPPU, take rate Creator, churn, refund rate, chargeback, CAC và chi phí gateway.

## 5. Checklist UX trước khi phát hành

- Thông tin giá, chu kỳ, quyền lợi, phí bổ sung và thay đổi gói dễ tìm; không có dark pattern.
- Hiển thị đầy đủ trạng thái “chưa mở bán”, không để nút bấm giả vờ thực hiện subscription.
- 320/360/390/430/768/1280px; typography và thành phần tương tác đạt chiều cao mục tiêu hợp lý; hỗ trợ `prefers-reduced-motion`.
- Kiểm tra khả năng dùng bàn phím, focus state, độ tương phản và screen reader.
