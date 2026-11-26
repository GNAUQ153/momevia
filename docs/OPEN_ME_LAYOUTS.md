# Bộ bố cục Open Me

Ba định nghĩa canvas đã sẵn sàng để đăng ký thư viện. Chúng **chưa được thêm vào Catalog/seed** và không tự tạo sản phẩm miễn phí hoặc mở quyền gửi.

| ID ổn định | Loại | Cảnh | Nội dung |
|---|---|---:|---|
| `club-22-invitation` | Thiệp mời | 4 | Phong bì vàng/cobalt, tuổi, lịch hẹn, thắp nến, vé cào và hồi đáp |
| `cozy-christmas-invitation` | Thiệp mời | 4 | Giấy kem/nơ đỏ, cuộc hẹn, Secret Santa, chọn điều ước và hồi đáp |
| `tet-phong-thu` | Lời chúc | 3 | Phong thư đỏ, hoa ở mép, lá thư, ký tên và mở lại |

`web/js/shared/canvas/open-me-templates.js` xuất metadata và `createOpenMeTemplate(id, localize)`. `createDocument` dùng cùng factory; schema/registry 2, binding `recipientName`, `senderName`, `message`, không ảnh bắt buộc. `npm run build` sinh bìa VI/EN và các biến thể Catalog/theo mùa từ tài liệu đã kiểm.

Trước khi giới thiệu một mẫu, cần đăng ký đúng ID trong Catalog và thư viện canvas với loại, phiên bản, giá/quyền và điều kiện mùa đã được quyết định. Với MySQL đã có thư viện, cập nhật qua API/CLI theo revision hiện hành; thay factory hoặc seed không cập nhật đè dữ liệu đang phục vụ. Xem [hướng dẫn thư viện](CANVAS_SENDER_GUIDE.md).

Club dùng thao tác **thắp nến**, không thổi tắt. Cozy tách chọn điều ước trong phiên khỏi RSVP đã lưu, không có wishlist chung hoặc số khách đi kèm. Nhạc tùy chọn chỉ phát sau nút nhạc. Hai thiệp mời dùng ngày/địa điểm có cấu trúc và quyền hồi đáp hiện hữu; RSVP do Gifts quản lý.

Định nghĩa được nhúng vào nháp/quà ở thời điểm tạo. Không sửa source/version hay snapshot đã gửi để cập nhật bố cục mới. Các ID hệ thống cũ, gồm `winter-wishes-2026`, giữ nguyên ý nghĩa.
