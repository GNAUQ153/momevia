# Role Workspace UI — Admin / Creator (21/11/2026)

## Phạm vi

- Admin `/admin`: mở trực tiếp mục kiểm duyệt, yêu cầu hỗ trợ, giám sát thanh toán; hiển thị số lượng **bản ghi đã tải**, không suy ra tổng số toàn hệ thống.
- Creator `/creator`: điều hướng tới tạo mẫu, danh sách mẫu, báo cáo doanh thu; chỉ xuất hiện đối với Creator/Admin (UI không thay thế kiểm tra phân quyền API).
- Chỉ thêm module giao diện thuần `web/js/ui/role-workspace.js` và CSS `web/css/role-workspace.css` dùng token hiện có.
- Đồng nhất VI/EN trên cùng HTML, không tách hai giao diện; nhãn được đánh dấu cho cơ chế cập nhật i18n trực tiếp.

## Kiểm thử trên máy phát triển

1. `npm ci && npm run build && npm run check && npm test`.
2. `npm run test:browser && npm run test:canvas:browser`.
3. Đăng nhập Admin, mở `/admin`, thử nút đi tới kiểm duyệt, hỗ trợ và `/admin/payments`.
4. Đăng nhập Creator, mở `/creator`; thử 3 anchor và xuất báo cáo (nếu có dữ liệu). Đăng nhập Sender để xác nhận không xuất hiện các shortcut Creator.
5. Chuyển VI → EN → VI và kiểm tra nhãn ngay trên trang, không tải lại; thử kích thước 360/390/768/1280px, Tab/Shift+Tab và reduced motion.
6. Kiểm tra danh sách lỗi tải: không hiển thị số 0 như một số liệu toàn hệ thống.

## Giới hạn

- Không thêm logic thanh toán, số dư hoặc báo cáo thống kê toàn hệ thống.
- CI/CD chỉ kiểm chứng các bước đã cấu hình; việc kiểm thử keyboard/mobile trên trình duyệt thực vẫn cần thực hiện.
- Khi bản đang chạy có thay đổi riêng từ nhóm, `merge-main.mjs --check` có thể dừng do xung đột. Không áp dụng thủ công hoặc ép ghi đè.
