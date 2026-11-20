# Phase 6.2b — Autosave / Offline UX

## Phạm vi

- Giữ cơ chế **server revision/CAS**, idempotent mutation và phục hồi V2 theo tab của Phase 6.2a.
- Hiển thị rõ **đã ACK bởi máy chủ** khác **đang lưu** và **chưa đồng bộ**.
- Theo dõi khả năng ghi được bản tạm `sessionStorage`; không cam kết recovery khi trình duyệt chặn storage.
- Nếu `navigator.onLine === false`, không tạo request autosave tự động. Khi request đã thất bại, tiếp tục gõ sẽ không kích hoạt một vòng request liên tục; nút **Thử lưu lại** và sự kiện `online` vẫn thử lại với mutation đã giữ nguyên.
- Không thêm dependency, endpoint, bảng CSDL hoặc telemetry nội dung riêng tư.

## Bài kiểm thử

```bash
node --test tests/unit/save-feedback.test.mjs tests/unit/canvas-editor.test.mjs tests/unit/canvas-tab-sync.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

## Nghiệm thu thủ công

1. Chỉnh thiết kế có mạng: xem *Có thay đổi chưa lưu* → *Đang lưu* → *Đã lưu trên máy chủ · rN*.
2. Tắt mạng trước khi chỉnh: có trạng thái *Chưa đồng bộ*, không phát sinh request liên tục. Đổi nội dung, bật lại mạng: autosave qua sự kiện `online`.
3. Nếu request lỗi giữa chừng, tiếp tục gõ: không spam request. Bấm *Thử lưu lại* sau khi mạng hồi phục, xác minh mutation cũ không đổi.
4. Trình duyệt chặn `sessionStorage`: UI phải cảnh báo **Tránh đóng tab**; không giả định có backup.
5. Hai tab cùng thiết kế: tab A có chỉnh sửa riêng, tab B lưu; tab A hiện conflict và giữ nội dung, không ghi đè.
6. Thử ở 320/390/768/1440px và reduced motion, kiểm tra thông báo không đè nút.

## Giới hạn

`sessionStorage` không bảo đảm giữ nháp sau khi đóng hẳn tab. Tín hiệu `navigator.onLine` chỉ là gợi ý; xác nhận lưu thành công phụ thuộc server ACK. Không ghi nội dung nháp vào analytics, query string hoặc cross-tab event. UI này chưa có tính năng export/import backup độc lập.
