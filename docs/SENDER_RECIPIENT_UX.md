# Sender Studio & Recipient Journey UX

## Phạm vi

- **Sender Studio:** Thêm điều hướng nhanh tới bản nháp, quà đã tạo và đơn hàng bằng module `roleQuickLinks` dùng chung với Admin/Creator.
- **Share success:** Hướng dẫn ba bước xem trước, sao chép và chia sẻ. Nếu quà có quyền truy cập `invite`, liên kết chính vẫn là invite URL do server trả về.
- **Legacy recipient:** Thêm tiến trình mở quà ba bước, đồng bộ `aria-current`, thông báo `role=status`, focus heading khi đổi trạng thái. Chỉ chấp nhận tiến tới bước kế tiếp.
- **Responsive:** CSS mỗi thuộc tính một dòng, nhãn đủ chỗ trên mobile và tôn trọng `prefers-reduced-motion`.
- **i18n:** 15 khóa VI/EN mới. Nội dung thiệp, ảnh, tên người dùng và quyền truy cập không bị dịch hoặc thay đổi.

## Không thay đổi

API, schema MySQL, logic xác nhận thanh toán, đối soát, chia sẻ token, Canvas JSON, reply permissions hoặc player Canvas công khai. Mọi nội dung quà vẫn được escape theo logic hiện có.

## Kiểm thử

`node --test tests/unit/sender-recipient-journey.test.mjs tests/unit/role-workspace.test.mjs tests/unit/seasonal-viral.test.mjs`

`npm run build && npm run check && npm test && npm run test:browser && npm run test:canvas:browser`

Sau đó kiểm tra thủ công cả chế độ VI/EN trên `/studio`, `/success/:slug`, `/g/:slug` với quà legacy. Cần kiểm tra thêm Chrome trên mobile, bàn phím và chế độ giảm chuyển động.

**Giới hạn xác minh tại môi trường tạo bản vá:** unit test liên quan và i18n đạt; build toàn phần không thực hiện được do thiếu dependency `qrcode-generator`, 6 bộ test cũ thiếu `sharp`. CI/CD và browser regression thực tế trên máy nhận là bước xác minh cuối cùng.
