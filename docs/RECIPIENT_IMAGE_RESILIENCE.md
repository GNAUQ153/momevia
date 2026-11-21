# Recipient Canvas Player — Xử lý ảnh khi mạng chậm

Ngày cập nhật: 21/11/2026.

## Phạm vi

- Module `web/js/features/gift-runtime/image-state.js` quản lý vòng đời ảnh theo từng cảnh.
- Gắn sự kiện `load` và `error` trước khi đặt `src` để không bỏ lỡ ảnh lỗi đã có trong cache.
- Phân biệt `loading`, `ready`, `error` trên vùng ảnh, hiển thị placeholder Việt/Anh khi tải thất bại.
- Ưu tiên tải ảnh nội dung đầu tiên được dựng trong cảnh (`loading=eager`, `fetchPriority=high`); những ảnh còn lại vẫn tải lazy.
- Khi chuyển cảnh hoặc dispose, `AbortSignal` chặn phản hồi ảnh muộn cập nhật giao diện đã bỏ.
- Có nền loading nhẹ, tắt animation nếu thiết bị bật `prefers-reduced-motion`.

## Giới hạn

- Không thêm prefetch các cảnh chưa mở; điều này tránh tải trước ảnh riêng tư không cần thiết và giảm băng thông mobile.
- Không thêm retry tự động hoặc URL bên ngoài; ảnh tiếp tục đi qua allowlist trong `renderer.js` và quyền trên backend hiện có.
- Không thay đổi định dạng Canvas JSON, API, cơ chế thanh toán, nội dung thiệp hoặc hành vi truy cập quà.
- `fetchPriority` chỉ là gợi ý đối với trình duyệt, không bảo đảm một mốc thời gian tải cụ thể.

## Kiểm thử

1. `npm ci` và `npm run build`.
2. `npm run check` và `node --test tests/unit/runtime-image-loading.test.mjs`.
3. `npm run test:canvas:browser` với Chromium.
4. Kiểm tra thực tế trên mobile: tải ảnh bình thường, giả lập Slow 3G, chặn một request ảnh, đổi nhanh giữa các cảnh và dùng VI/EN.
5. Kiểm tra DevTools Network không có request ngoài allowlist hoặc bị tải trước khi mở cảnh tương ứng.
