# Momevia Phase 6.3a — Recovery Center

## Phạm vi

- Nút **Bản nháp** trên Canvas Designer mở dashboard bằng native `<dialog>`: tình trạng lưu hiện tại, revision được xác nhận, thời gian xác nhận, bản phục hồi của tab (nếu có).
- Hỗ trợ **Thử lưu lại** khi dirty/offline/error, **Xem bản máy chủ** và **Tải bản máy chủ** khi conflict, thông qua action hiện có; không tạo endpoint riêng.
- Người dùng có thể tải **bản sao JSON theo yêu cầu** với `title`, `document`, `designId`, `revision`. Không chứa mutation ID, token, cookies, pending envelope hay userId. File có thể chứa nội dung riêng tư và tham chiếu ảnh, **không có bytes ảnh**, và **chưa thể import tự động**.
- **Không sửa** `session.js`, storage keys, CAS, schema, database, API, quyền Creator/Sender/Admin, publish/payment.

## Lưu ý an toàn

- `readRecovery()` có thể trả về `null` dù còn thay đổi nếu sessionStorage bị chặn/đầy. Dashboard không khẳng định dữ liệu đã an toàn nếu chưa xác nhận server.
- `lastSavedAt` chỉ phản ánh ACK từ server **trong phiên đang mở**, không phải mốc server lịch sử nếu session vừa reload.
- Không lưu/chia sẻ bản sao JSON trong các kho công khai. File có thể chứa tên, lời chúc và metadata media riêng tư.
- Bản sao JSON là bản xem lại thủ công, không phải file backup toàn vẹn; khi cần khôi phục, dùng cơ chế recovery có kiểm tra owner và CAS của phiên hiện tại.
- UI không có nút ghi đè cưỡng bức server. Nút tải lại sử dụng hộp thoại xác nhận sẵn có.

## Smoke QA

1. Tạo bản nháp, mở `Bản nháp`: clean và revision đúng. Nhập thêm nội dung: dirty, sau khi server ACK: clean.
2. Tắt kết nối, chỉnh bản nháp: cảnh báo chưa đồng bộ, thử lưu lại không tự ghi đè. Bật kết nối, thử lưu và xác nhận trạng thái.
3. Hai tab A/B cùng thiết kế: lưu ở B trong khi A dirty. A mở Recovery Center: conflict, có Xem/Tải bản máy chủ; không xuất bản khi xung đột.
4. Chặn sessionStorage, chỉnh sửa: dashboard cảnh báo không có bản tạm, không báo đã backup.
5. Tải JSON: mở file kiểm tra title/document/revision, không có mutationId, cookies, token. Ảnh gốc không được đóng gói.
6. Mobile 320/390px, desktop 768/1440px: dialog cuộn, nút không overflow, Escape đóng được, focus khôi phục.

## Lệnh kiểm thử

```bash
node --test tests/unit/recovery-center.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```
