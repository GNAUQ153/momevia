# Momevia — Auth & Support UX V6

Ngày: 22/11/2026. Baseline: Music Occasion V4 + Visual CSS Quality V5.

## Nguyên nhân

- Trang đăng nhập **có** liên kết `/register`, nhưng `web/css/auth-pages.css` từng có quy tắc gộp `.auth-switch a, .is-auth .site-tools { display: none; }`, vô tình ẩn cả nút Đăng ký và nút Đăng nhập quay lại trên trang register.
- Mọi modal chung trong `web/js/app/main.js` đều được thêm `localeControl()`, gây trùng bộ chọn ngôn ngữ ở form hỗ trợ và màn thông báo gửi thành công.

## Thay đổi

1. Sửa CSS chỉ ẩn `.is-auth .site-tools`, không ẩn liên kết xác thực. Đặt CTA **Bạn chưa có tài khoản? Đăng ký ngay** ngay dưới form login (sau quên mật khẩu, trước social providers). Giữ link Đăng nhập trên register, trường xác nhận mật khẩu và handler `data-link` hiện có.
2. Thêm `auth-recovery-link` và `auth-switch--signup` rõ ràng, đọc được, có focus cho bàn phím. Giữ font Inter/Plus Jakarta Sans/Lora từ design system và không tạo selector CSS lặp hay style một dòng.
3. `openModal(content, { showLocaleControl = true })` mặc định giữ hành vi cũ. Chỉ form hỗ trợ và màn thông báo gửi thành công truyền `showLocaleControl: false`. Cả hai vẫn hiển thị ngôn ngữ đã chọn trong shell vì dùng cùng `text()`/`attr()` i18n.
4. Không thay đổi API đăng ký/đăng nhập, hệ thống hỗ trợ, schema DB, quyền truy cập, âm thanh, Canvas hay nội dung dữ liệu người dùng.

## Kiểm thử

```bash
npm ci
npm run build
npm run check
node --test tests/unit/auth-support-ui-regression.test.mjs
npm test
npm run test:browser
npm run test:canvas:browser
npm run i18n:audit
```

Các bài test mới kiểm tra CTA login, link register→login, quy tắc CSS, hai điểm tạo modal hỗ trợ không có locale riêng và dictionary VI/EN.

Checklist thủ công trước release:

- Trên desktop/laptop/điện thoại: mở `/login` rồi xác minh **Đăng ký ngay** hiện ngay dưới form và điều hướng `/register`.
- Trên `/register`: **Đăng nhập ngay** dẫn về `/login`; ẩn/hiện mật khẩu và quên mật khẩu vẫn hoạt động.
- Đặt ngôn ngữ ở header thành **English**, mở form hỗ trợ: không có ngôn ngữ thứ hai, toàn bộ nội dung dùng English; đóng, chuyển lại Tiếng Việt và thử lần nữa.
- Gửi yêu cầu hỗ trợ hợp lệ: màn thành công không có bộ chọn ngôn ngữ riêng. Modal thanh toán/đối soát khác vẫn hoạt động như trước.
- Kiểm tra focus bằng Tab, chiều rộng 390/768/1366px và không tràn ngang.

## Giới hạn xác nhận

Bản vá đã kiểm thử tại Node với rendering markup và stylesheet, kiểm tra CSS/i18n và Chromium `set_content` cho CTA trên viewport 390/768/1366px. Kiểm thử toàn ứng dụng cần CI/CD trên máy có dependency (nhất là `sharp`, `qrcode-generator` và `js-yaml`). Không được coi kết quả trong container là chứng nhận production.
