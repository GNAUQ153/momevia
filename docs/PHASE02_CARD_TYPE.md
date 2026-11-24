# Phase 2.1A — Phân loại thiệp

## Phạm vi

Tài liệu Định hướng MOMEVIA, M06 và mục 5.4: phân biệt thiệp mời và thiệp chúc mừng, không đồng nhất loại thiệp với dịp (sinh nhật, tốt nghiệp, kỷ niệm...).

- `cardType` là trường đọc thêm trên API Catalog, không thay đổi schema MySQL hoặc JSON đã lưu.
- `invitation`: mẫu Lời mời bên hiên có cảnh thời gian, địa điểm và lịch trình.
- `greeting`: 27 mẫu hệ thống còn lại trong bộ seed hiện tại, gồm các mẫu lời chúc/kỷ niệm tương tác.
- `unspecified`: mẫu Creator và mẫu mới chưa được xác định. Không suy đoán từ tiêu đề, dịp, giá hoặc ID Creator.
- API `/api/catalog/templates?cardType=invitation`; nhận `invitation`, `greeting`, `unspecified`, `all`. Giá trị lạ được xử lý như `all`.
- `/explore?cardType=invitation`: kết hợp tìm kiếm, dịp, màu, giá, ảnh, phân trang; reset và đổi bộ lọc về trang 1.
- Trang chi tiết có nhãn loại. VI/EN dùng chung component, thêm sáu khóa dịch mỗi ngôn ngữ.
- Frontend mới có fallback cho API cũ dựa trên cờ `systemOwned`; backend mới giữ tương thích frontend cũ.

## Kiểm thử và triển khai

1. `node --test tests/unit/phase02-card-type.test.mjs tests/unit/catalog-filter.test.mjs`
2. `npm run build`, `npm run check`, `npm test`.
3. Local demo: mở `/explore`, lọc từng loại, kiểm tra URL và F5, đổi VI/EN, reset, thử ở mobile; mở trang chi tiết.
4. Sau khi kiểm thử, commit và push; deploy backend Railway và cập nhật frontend đã build trên Hostinger theo quy trình hiện hành. Không thực hiện migration hoặc thay đổi biến môi trường production.

## Giới hạn

Đây là phân loại danh mục, không phải hoàn thiện M06. Chưa có trường sự kiện có cấu trúc, chọn loại cho bản thiết kế trống, RSVP, giới hạn lượt Premium hoặc kiểm tra hạn thiệp. Không sửa snapshot đã phát hành, quyền phản hồi hay thanh toán. Các bước này cần bản vá riêng, có kiểm thử lưu/tải và tính tương thích MySQL.
