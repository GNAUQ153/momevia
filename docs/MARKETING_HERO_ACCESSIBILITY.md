# Marketing Hero — Điều khiển chuyển mẫu

## Mục tiêu

Cho phép khách truy cập chủ động tạm dừng/tiếp tục phần trình diễn thiệp 3D tự động. Đây là điều khiển accessibility độc lập với nút chọn từng mẫu và preview.

## Hành vi

- Tự chạy theo chu kỳ 5 giây khi trang hiển thị, ảnh có thể giải mã và người dùng không giảm chuyển động.
- Tạm dừng giữ nguyên mẫu cùng vị trí đồng hồ; cả thiệp hé và hai note cùng dừng.
- Vẫn chọn mẫu và xem trước thủ công khi đang tạm dừng. Bấm tiếp tục khôi phục chu kỳ.
- Tự tạm dừng khi mở preview, chuyển tab hoặc cuộn phần Hero khỏi màn hình như trước.
- Chế độ `prefers-reduced-motion: reduce` không tự chạy, nút pause được ẩn và nút chọn mẫu vẫn dùng được.
- Nhãn VI/EN thay đổi ngay khi đổi ngôn ngữ. Không dịch tên thiệp hoặc dữ liệu người dùng.

## Xác minh

1. Chạy `npm run build`, `npm run check`, `npm test`, `npm run test:browser`.
2. Mở trang chủ VI và EN, bấm tạm dừng, quan sát thanh chạy và note đều dừng trong hơn 5 giây.
3. Chọn một mẫu thủ công khi đã tạm dừng, mở rồi đóng preview; mẫu vẫn không tự chuyển.
4. Tiếp tục, kiểm tra nhịp 5 giây và chuyển mẫu có hiệu ứng như trước.
5. Bật Reduced Motion trong DevTools; kiểm tra chỉ chọn mẫu thủ công, nút pause không xuất hiện.
6. Kiểm tra viewport 320, 390, 768, 1024 và 1440px không tràn ngang.
