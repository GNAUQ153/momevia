# Momevia Phase 6.2a — An toàn lưu nháp khi mở nhiều tab

## Nghiệp vụ được bổ sung

1. Sau khi máy chủ xác nhận một lần lưu, tab phát tín hiệu `revision` qua sự kiện `storage` cùng origin. Tín hiệu **không chứa** tên, lời chúc, ảnh, token, document JSON hoặc dữ liệu người nhận.
2. Tab khác đang mở **cùng owner và design** nếu thấy `revision` mới hơn thì chuyển trạng thái `conflict`, hiển thị thông báo và công cụ xem/tải bản máy chủ đã có. Không tự hợp nhất, không ghi đè, không tự retry.
3. Nếu tab khác nhận ACK trễ sau cảnh báo mà ACK vẫn cũ hơn `revision` đã biết, không được hiển thị `Đã lưu` hoặc xóa mutation pending.
4. Bản recovery mới dùng `sessionStorage` (cô lập theo tab) thay cho cùng một khóa `localStorage` của mọi tab. Vẫn cho phép đọc recovery V1 để phục hồi tương thích. Sau ACK thành công mới dọn cache V1 cũ.
5. Không đổi endpoint, database, CAS, quyền Creator/Sender, Canvas schema, thanh toán, package hay đường dẫn ảnh.

## Lưu ý an toàn và giới hạn

- Tín hiệu từ `localStorage` chỉ là cảnh báo UX, **không có thẩm quyền xác nhận phiên bản**: server revision/CAS vẫn bắt buộc. Tab khác thiết bị hoặc trình duyệt khác sẽ được bảo vệ bởi CAS, nhưng không nhận cảnh báo sớm qua event này.
- `sessionStorage` sống qua reload trong cùng phiên tab, nhưng **không bảo đảm** tồn tại sau khi đóng tab hoặc toàn bộ phiên trình duyệt. Các lưu nháp quan trọng vẫn cần ACK máy chủ; khi offline lâu nên có chức năng xuất bản sao thủ công trong phase tiếp theo.
- `sessionStorage` vẫn được truy cập bởi JavaScript cùng origin; không xem đây là mã hóa hoặc bảo mật chống XSS. Chỉ sử dụng trên HTTPS, cần kiểm tra CSP, XSS, phân quyền media và secret scan riêng.
- Nếu `sessionStorage` bị tắt/đầy, autosave lên máy chủ không bị vô hiệu, nhưng khả năng recovery qua reload có thể bị hạn chế. Test thủ công nên kiểm tra tình huống này.
- Không sử dụng auto-merge hoặc Last Write Wins. Trong trường hợp conflict phải cho người dùng chọn xem bản máy chủ và quyết định có tải lại hay không.

## Unit/CI

```bash
node --test tests/unit/canvas-tab-sync.test.mjs tests/unit/canvas-editor.test.mjs tests/unit/recovery-guards.test.mjs tests/unit/editor-guards.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

## Manual QA (một tài khoản, hai tab)

1. Mở cùng design ở A và B. A chỉnh nhưng chưa lưu. B chỉnh và lưu. A hiển thị conflict; A không được mất nội dung, không được tự ghi đè B. Kiểm tra nút xem server/tải lại.
2. A đang sạch, B lưu: A được cảnh báo, không tạo nháp giả; sau khi chọn tải lại, UI hiện nội dung B.
3. A mất mạng, sửa và reload cùng tab: đề nghị khôi phục, dữ liệu nguyên vẹn. Mở tab B không làm mất recovery A.
4. Thử mất ACK (server đã commit), bật lại mạng, retry phải giữ mutationId và nội dung đã gửi.
5. Đóng tab với thay đổi chưa lưu: cảnh báo từ Phase 6.1b vẫn xuất hiện. Kiểm tra breakpoint 320/390/768/1440.
6. Đăng nhập tài khoản khác cùng trình duyệt, không được nhận cảnh báo hoặc đọc recovery từ tài khoản trước.

## Mốc tiếp theo

- Thêm chức năng **Xuất bản nháp dự phòng** khi offline (không chứa private media chưa được cấp quyền), sau đó nhập lại có kiểm tra owner/schema.
- Kiểm thử Playwright hai context/two-tab thật trên Windows/Linux để kiểm tra event storage, reload và điều hướng.
