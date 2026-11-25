# Frontend Momevia

## Nơi chỉnh sửa

| Phần | Mã nguồn |
| --- | --- |
| Điều hướng, phiên và vòng đời trang | `web/js/app/`, `web/js/pages/` |
| Đăng nhập, đăng ký và khôi phục | `web/js/pages/auth.js`, `web/css/auth-pages.css` |
| Studio, bảng lớp, cảnh và thuộc tính | `web/js/features/canvas-editor/` |
| Xem trước và phát quà | `web/js/features/gift-runtime/` |
| Schema, thư viện, tài nguyên và chuyển động | `web/js/shared/canvas/` |
| Thành phần, biểu tượng và bản dịch | `web/js/ui/`, `web/assets/locales/` |

## Hợp đồng cần giữ

- Tài liệu Canvas là nguồn dữ liệu chung của Studio, server, preview và player; Fabric chỉ hỗ trợ thao tác bố cục. Không lưu Fabric JSON thay tài liệu Canvas.
- Giữ ID của mẫu, element và tài nguyên đã phát hành. Quà giữ snapshot riêng; sửa thư viện không thay bản đã chèn. Không ghi đè media đã có hash bằng nội dung mới.
- Chỉnh layout, thứ tự lớp, trạng thái và thuộc tính qua store/patch hiện có, để Undo/Redo và autosave dùng cùng một thay đổi. Giữ kiểm revision/CAS và mutation ID khi thử lại.
- Giữ các khóa và giới hạn cá nhân hóa do server xác lập. Ẩn nút trên UI không thay kiểm quyền ở API.
- Chuyển động nằm trong vùng chọn bên ngoài, giữ điểm gắn cha/con và được hủy khi rời cảnh. Tôn trọng tùy chọn giảm chuyển động.
- Dialog và bảng mobile giữ focus, đóng bằng Escape và dùng được bằng bàn phím. Thứ tự đọc khác thứ tự vẽ; nội dung dài phải đọc và cuộn được.
- Chữ của ứng dụng dùng khóa VI/EN chung; không đổi nội dung do người dùng nhập để chuẩn hóa giao diện.

## Build và tài nguyên

`web/index.html` khai báo thứ tự CSS và các điểm vào. Build tạo QR, thư viện phụ trợ, ảnh bìa và các chunk có tên theo nội dung. `web/assets/app` là đầu ra có thể dựng lại; build giữ tệp của bản hiện tại và bản liền trước khi dọn đầu ra cũ.

Ảnh bìa có đường dẫn riêng theo mẫu, ngôn ngữ và biến thể. Hai tệp giống nội dung vẫn có thể phục vụ hai URL đang được dùng; chỉ hợp nhất sau khi cập nhật bộ sinh và cơ chế phân giải tương ứng. Tài nguyên QA không đặt dưới `web/assets`; bằng chứng phát sinh lưu trong `local/` và không vào Git/gói nguồn.

## Kiểm tra thay đổi

- `npm run check`, `npm test`, `npm run build`.
- `npm run test:templates` cho thay đổi thư viện/mẫu và ảnh bìa.
- `npm run test:canvas:browser` cho thao tác Studio và vòng lưu/xem quà.
- `npm run test:motion:browser` và tùy chọn `-- --webkit` cho quan hệ hình học của icon.

Xem [hướng dẫn Canvas](CANVAS_SENDER_GUIDE.md), [hợp đồng API](ENDPOINTS.md), [icon chuyển động](MOTION_REPAIR_56.md) và [vận hành](OPERATIONS.md). Chi tiết các đợt UI cũ được giữ trong lịch sử Git thay vì các bản hướng dẫn trùng nhau.
