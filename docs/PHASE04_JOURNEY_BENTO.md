# Phase 4.4D — Interactive Bento

- Tái sử dụng năm bước Create–Share–Open–Reply–Keep và controller `mountJourney` hiện có. Không tạo route, API, thư viện, timer hoặc dữ liệu mới.
- Desktop từ 901px: Bento hai cột, Create chiếm hai cột; các bước còn lại giữ thứ tự DOM. Màu nền từ Design Tokens, trạng thái chọn có viền kép, không chỉ phân biệt bằng màu.
- Tablet 501–900px: giữ bố cục năm bước ngang; mobile tối đa 500px: giữ rail cuộn ngang và thao tác vuốt trên thiệp minh họa.
- Hover dịch nhẹ 2px chỉ trên desktop có con trỏ chính xác và không bật reduced motion. Không dịch toàn section; giữ ngưỡng khoảng cách đã nghiệm thu.
- ARIA: mỗi nút trỏ tới panel thật qua `aria-controls`; nhóm có hướng dẫn phím trái/phải, Home/End bằng i18n. Giữ `aria-pressed`, focus, live region và thứ tự bàn phím. Icon dùng module SVG Lucide hiện có, không thêm tài nguyên ngoài.
- Demo chỉ giới thiệu hành trình, không gửi thiệp, xuất bản, thanh toán hoặc tạo bản ghi. Nội dung phản hồi và thời hạn truy cập tiếp tục tuân theo điều kiện hiện có.

## Nghiệm thu

Chạy `node --test tests/unit/brand-*.test.mjs tests/unit/marketing-*.test.mjs` và `npm run check`, `npm run test:browser` trong môi trường test độc lập. Browser test giữ các assertion cũ, bổ sung kích thước và thứ tự Bento cùng điều hướng bàn phím ở desktop. Kiểm tra cả VI/EN, thiết bị cảm ứng, giảm chuyển động và font lớn.
