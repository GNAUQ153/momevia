# Momevia V15 — Canvas Mobile Sheet Experience

## Mục tiêu

Khi chỉnh thiệp trên điện thoại, các bảng công cụ cần tách biệt rõ khỏi Canvas, dễ đóng và sử dụng được bằng bàn phím hoặc công nghệ hỗ trợ. Trước V15, bảng mobile không có backdrop riêng, focus có thể đi khỏi vùng bảng nếu đang đứng ở container, và các phím tắt Canvas vẫn hoạt động khi bảng công cụ đang mở.

## Thay đổi

- `web/js/pages/designer.js`: thêm nút backdrop ẩn mặc định nằm cùng workspace, mở/đóng cùng sheet. Các vùng phía sau bị `inert`, riêng backdrop vẫn có thể click để đóng. `aria-modal` chỉ áp dụng khi sheet đang mở.
- `web/js/features/canvas-editor/mobile-sheet.js`: hàm thuần lọc phần tử có thể focus và xác định điểm focus khi Tab/Shift+Tab đi tới ranh giới. Loại bỏ phần tử disabled, ẩn, inert, `aria-hidden`, tabindex âm.
- `web/css/editor-experience.css`: backdrop cố định z-index 35 (sheet z-index 40) chỉ trên mobile ≤800px. Không chèn màu, animation hoặc hình 3D mới. Nút Đóng có focus outline.
- `tests/browser/canvas.mjs`: trên 320/390/768px kiểm tra sheet mở đúng, có backdrop, focus nằm trong sheet, keyboard cycling và chạm nền đóng bảng.
- `tests/unit/editor-mobile-sheet-v15.test.mjs`: kiểm tra chức năng focus thuần, lifecycle và CSS.

## Bảo toàn nghiệp vụ

Không sửa Canvas JSON, API, lưu nháp, lịch sử chỉnh sửa, render recipient, âm nhạc, thanh toán, Auth, MySQL hoặc vai trò người dùng. Không thêm dependency và không thêm khóa dịch vì dùng lại nhãn Đóng công cụ có sẵn của Momevia.

## Kiểm thử

```bash
npm ci --include=dev
npm run build
npm run check
node --test tests/unit/editor-mobile-sheet-v15.test.mjs tests/unit/editor-experience.test.mjs
npm test
npm run test:canvas:browser
npm run i18n:audit
```

## UAT

1. Đăng nhập với tài khoản Sender và mở một bản nháp Canvas có thể chỉnh sửa ở 390px.
2. Bấm lần lượt Thêm/Lớp/Thuộc tính/Cảnh. Bảng phải nổi trên overlay tối vừa phải và focus vào nút Đóng.
3. Bấm Shift+Tab ở nút Đóng: focus quay về phần tử cuối trong bảng; Tab tiếp tục quay về nút Đóng.
4. Bấm Escape: bảng đóng, overlay biến mất, focus trở lại nút mở bảng.
5. Mở lại và chạm vùng nền phía trên bảng: đóng bảng, không thay đổi nội dung thiệp.
6. Đổi độ rộng từ 390px sang 1024px khi bảng đang mở: bảng đóng và Canvas vẫn chỉnh sửa được.
7. Tạo nội dung, lưu nháp, tải lại và kiểm tra dữ liệu không đổi; kiểm thử thêm VI và EN.
8. Kiểm tra iOS Safari và Android Chrome thật để xác nhận keyboard, cuộn nội dung bảng, safe area.

## Giới hạn xác minh

Tại môi trường xây dựng bản vá, 16/16 bài test Editor/Mobile đạt, CSS/i18n audit đạt. `npm run build` và `npm run check` đầy đủ chưa chạy được vì bản sao node_modules thiếu qrcode-generator/js-yaml; `npm test` toàn source có 675 ca đạt, 6 ca không khởi động vì thiếu package. Chưa xác minh browser E2E do bản sao không có Playwright node package. Phải kiểm tra CI/CD sau khi push.
