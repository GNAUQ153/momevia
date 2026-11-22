# Momevia Auth Experience V7 — Login & Register

**Ngày:** 22/11/2026
**Baseline:** Auth & Support UX V6 — workflow `45035291870` đã PASS theo ảnh GitHub CLI của người dùng.

## 1. Phạm vi thay đổi

- Trang `/login` và `/register` sử dụng chung một bố cục: nội dung giới thiệu sản phẩm bên trái, biểu mẫu rõ ràng bên phải trên desktop.
- Tablet và mobile (tối đa 1020px) hiển thị một cột, có logo Momevia ở đầu form; tránh chia đôi màn hình khiến vùng nhập quá hẹp.
- Trên màn hình đủ rộng (từ 1200px), các trường đăng ký được chia hai cột cân đối để tránh form quá cao. Thiết bị nhỏ vẫn hiển thị một cột, không ép chữ hoặc cắt form.
- Label 14px, nội dung mô tả 15px, input 16px với chiều cao tối thiểu 54px, nút hiện/ẩn mật khẩu 44px, nút gửi 54px. Đảm bảo iOS không tự phóng to khi nhập input dưới 16px.
- Giữ liên kết **Đăng ký ngay** sau form đăng nhập và **Đăng nhập ngay** ở trang đăng ký; giữ điều hướng `/recover` và điều khoản sử dụng.
- Phương thức Google/Zalo chỉ xuất hiện khi backend trả trạng thái đã cấu hình. Nếu chưa cấu hình, không dựng nút giả vô hiệu; nếu chỉ có một phương thức thì nút dùng toàn bộ chiều rộng.
- Hỗ trợ focus bàn phím, vùng bấm đủ rộng, thông báo lỗi `role="alert"`, `autocomplete`, `aria-labelledby`, và `prefers-reduced-motion`.
- Dùng ảnh 3D sản phẩm hiện có kèm hiệu ứng chuyển động CSS rất nhẹ, **không thêm WebGL, Spline hoặc tài nguyên mới**.
- Sử dụng hệ thống font sẵn có: Plus Jakarta Sans, Inter, Lora, và cấu trúc dịch VI/EN chung.

## 2. Chất lượng CSS

- `web/css/auth-pages.css` là nguồn định nghĩa giao diện cho Login/Register; các override auth rải rác trước đây trong `web/css/ui-polish.css` đã được dọn khỏi file sau.
- Các quy tắc Pricing, menu laptop và phần không liên quan trong `ui-polish.css` được giữ nguyên giá trị và thứ tự ở mức CSS parser; chỉ chuẩn hóa định dạng để dễ bảo trì.
- `scripts/quality/check-css-style.mjs` giám sát thêm `auth-pages.css` và `ui-polish.css` (9 stylesheet tổng cộng), chống khai báo CSS viết dồn hoặc lặp trong cùng rule.
- Không sử dụng emoji; giữ bộ SVG icon Momevia hiện có.

## 3. Phạm vi không thay đổi

Không sửa endpoint xác thực, mật khẩu, OAuth callback, session/cookie, database, ACL, quy trình hỗ trợ, Canvas, Music Library hoặc quyền Creator/Admin. Đây là bản **UI refactor**, không phải đánh giá bảo mật penetration test.

## 4. Checklist QA bắt buộc trước commit

Chạy trên máy có npm dependencies:

```bash
npm ci
npm run build
npm run check
node --test tests/unit/auth-layout-v7.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
npm run i18n:audit
```

Thử trực tiếp trên Chrome, Edge và Safari nếu có:

1. Kiểm tra `/login` & `/register` tại viewport 320, 390, 768, 1024, 1440px, zoom 200% và chế độ chữ lớn.
2. Không tràn ngang, không cắt phần gửi biểu mẫu. Trên mobile logo Momevia vẫn nhìn thấy; hình quảng bá desktop được ẩn để tập trung vào form.
3. Đăng nhập email/mật khẩu thành công và sai mật khẩu, mở/ẩn mật khẩu; đăng ký thành công, mật khẩu không đủ điều kiện, không khớp xác nhận; khôi phục mật khẩu.
4. Đi bằng Tab, Shift+Tab, Enter, kiểm tra focus và trình đọc màn hình; các trường có nhãn và tên lỗi được thông báo.
5. Chuyển VI ↔ EN ngay trên trang đăng nhập/đăng ký; kiểm tra tiêu đề dài và tất cả placeholder; header vẫn dùng một bộ đổi ngôn ngữ.
6. Kiểm tra trạng thái provider: 0, 1 hoặc 2 provider được cấu hình. Không xuất hiện nút đăng nhập không dùng được; social callback thực tế hoạt động khi đã cấu hình.
7. Kiểm tra `prefers-reduced-motion` tắt animation; không tác động form hỗ trợ và các modal khác.
8. So sánh bằng ảnh giao diện thật và đo Core Web Vitals trước khi kết luận đạt chuẩn UI/UX hoặc WCAG 2.2 AA.

## 5. Giới hạn của môi trường chuẩn bị gói

Bộ test Node chạy được phần lớn nhưng 6 file cần native dependency `sharp` chưa khởi động trong môi trường này. Chromium bị giới hạn truy cập URL nên **chưa thể xác minh trực quan bằng ảnh browser thật**. Không diễn giải test HTML/CSS như kiểm thử nhìn thấy UI hoàn chỉnh. GitHub CI/CD trên máy người dùng và QA giao diện thật là bước xác nhận cuối.
