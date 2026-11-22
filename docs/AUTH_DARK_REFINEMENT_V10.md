# Momevia — Auth Experience V10

## Mục tiêu tinh chỉnh

V10 là bản tinh chỉnh trực tiếp từ Auth Experience V9 dựa trên góp ý mới của người dùng:

1. Phần mô tả ở trang **Đăng nhập** cần gọn hơn để trên desktop dễ giữ trong một dòng.
2. Khu **Google/Zalo** ở Login cần đẹp và gọn hơn.
3. Phải dùng **logo Google/Zalo đúng hơn** thay vì ký hiệu chữ G/Z tạm thời.
4. Trang **Đăng ký** nên tập trung vào biểu mẫu email, **không hiển thị social login**.
5. Mật khẩu tối thiểu giảm từ **10** xuống **8 ký tự**.

## Thay đổi kỹ thuật

- `web/js/pages/auth.js`
  - Chỉ render social login ở `/login`.
  - Dùng inline SVG nội bộ cho Google và Zalo; không tải asset từ nguồn ngoài.
  - Tạo divider social riêng `auth-divider--social` để nhóm đăng nhập nhanh hiển thị gọn, hợp logic hơn.
  - Đổi `minlength` của password trong register từ 10 xuống 8; recovery reset password cũng đổi tương ứng.

- `web/css/auth-pages.css`
  - Điều chỉnh spacing/social section để khu OAuth bớt nặng.
  - Thêm style cho `auth-provider-logo` và tinh chỉnh lead text của login để dễ giữ một dòng ở desktop.
  - Giữ nguyên responsive, reduced motion, glass-card, layout hai cột.

- `web/assets/locales/{vi,en}.json`
  - Rút gọn login lead.
  - Cập nhật text tối thiểu 8 ký tự.
  - Thêm khóa `auth.providers.orSocialLogin`.

- `src/modules/identity/credentials.service.mjs`
  - Đồng bộ validate mật khẩu tối thiểu 8 ký tự ở backend.

- `tests/unit/*auth*.test.mjs`
  - Cập nhật kỳ vọng mới: OAuth chỉ còn ở Login, password min 8, cache version `v10`, logo inline SVG.

## Kết quả kiểm tra

Đã chạy thành công:

- `node --test tests/unit/auth-*.test.mjs tests/unit/credentials.test.mjs`

Kết quả: **38/38 test pass**.

`npm run check` chưa chạy trọn vẹn trong môi trường phân tích vì thiếu package dev `js-yaml`/node_modules, không phải do logic của bản vá Auth V10.

## Các file thay đổi chính

- `web/index.html`
- `web/js/pages/auth.js`
- `web/css/auth-pages.css`
- `web/assets/locales/vi.json`
- `web/assets/locales/en.json`
- `src/modules/identity/credentials.service.mjs`
- `tests/unit/auth-design-v9.test.mjs`
- `tests/unit/auth-experience-v8.test.mjs`
- `tests/unit/auth-layout-v7.test.mjs`
- `tests/unit/auth-support-ui-regression.test.mjs`
- `CHANGELOG.md`

## Không thay đổi

- Không sửa endpoint OAuth `/api/auth/google` và `/api/auth/zalo`.
- Không đổi session, cookie, database schema, phân quyền, payment hoặc support backend.
- Không thêm thư viện hoặc asset ngoài.
