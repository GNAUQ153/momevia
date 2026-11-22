# Momevia — Auth Experience V8: giao diện tập trung và Google/Zalo OAuth

Ngày: 22/11/2026. Baseline: Auth Experience V7, workflow `45036929952` PASS theo ảnh Terminal của người phát triển.

## Lý do chỉnh sửa

V7 tạo danh sách `enabledProviders` rồi `filter()` để bỏ hẳn những lựa chọn Google/Zalo khi API trả `false`. Kết quả: các nút trông như đã bị xóa. Backend thực tế vẫn hỗ trợ `/api/auth/google` và `/api/auth/zalo`, nhưng chỉ khả dụng nếu cấu hình tương ứng được khai báo trong `.env` của máy chủ.

Bố cục V7 cũng có phần hình minh họa chiếm nhiều chỗ, form đăng ký 2 cột ở desktop và CSS kế thừa một số rule cũ trong `gift.css`, khiến trọng tâm trải nghiệm không nhất quán. V8 loại bỏ ba rule `.auth-page` legacy trong `gift.css` để tránh cascade vô tình ghi đè font/màu biểu mẫu.

## Triển khai V8

1. **Google và Zalo luôn xuất hiện** trên Login/Register. Khi `/auth/providers` trả `true`, nút là liên kết thật dẫn thẳng tới `/api/auth/google` hoặc `/api/auth/zalo` (chuyển hướng OAuth do server xử lý, không dùng routing SPA). Khi `false` hoặc chưa có response, nút là button `disabled`, có nhãn trạng thái bằng VI/EN và hướng dẫn dùng email. Không tạo link OAuth giả, không bỏ qua điều kiện kiểm tra server.
2. Đưa các lựa chọn OAuth lên trên email/password; bộ chia nói rõ người dùng có thể tiếp tục bằng email. Giữ CTA “Đăng ký ngay”, “Đăng nhập ngay”, quên mật khẩu, hiện/ẩn mật khẩu, chính sách và hỗ trợ.
3. Thiết kế lại `auth-pages.css` thành một hệ thống nền sáng/neutral-lavender, form một cột ngay cả khi desktop, cỡ chữ input 16px, nút CTA 54px, OAuth 52px, breakpoint 990px/600px, hỗ trợ keyboard focus/reduced motion. Giữ hình Momevia 3D hiện có, không thêm thư viện ảnh/icon bên ngoài.
4. Bản dịch VI/EN thêm các khóa `auth.providers.title`, `auth.providers.emailInstead`, `auth.providers.unavailableHint`. Cùng một DOM/layout ở cả hai ngôn ngữ.
5. Không thay đổi schema Canvas, session, password hashing, chính sách tài khoản, endpoint Auth, database hoặc thanh toán.

## Kích hoạt đăng nhập Google/Zalo thật sự

Trong `.env` **trên máy chủ**, cấu hình chính xác các giá trị sau, không commit các secret vào Git:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4100/api/auth/google/callback

ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_CALLBACK_URL=http://localhost:4100/api/auth/zalo/callback
```

Hãy cấp Client ID/Secret hợp lệ từ Google Cloud và Zalo Developers, đăng ký các redirect URI chính xác với domain và giao thức đang sử dụng. Trong production, cần HTTPS, origin hợp lệ, cookie bảo mật, và kiểm tra luồng hoàn thành sau callback. Khi server đã nhận cấu hình mới, khởi động lại backend và kiểm tra response của `GET /api/auth/providers`. Chỉ các khóa `google`/`zalo` trả `true` mới khiến liên kết bấm được.

**Không điền giả Client ID hoặc secret chỉ để nút sáng lên.** Đây là vấn đề cấu hình OAuth, không thể giải quyết đầy đủ bằng CSS.

## Checklist kiểm thử bắt buộc

- Desktop 1440px / laptop 1024px / tablet 768px / mobile 390px, 360px và landscape. Không tràn ngang, không che nút, không xếp đôi trường Đăng ký.
- Đăng nhập email, Đăng ký email, nhập mật khẩu không hợp lệ, hiện/ẩn mật khẩu, quên mật khẩu, đường dẫn chính sách và hỗ trợ.
- Google=false, Zalo=false: hai lựa chọn có mặt nhưng bị vô hiệu hóa, không có URL; email vẫn hoạt động.
- Google=true, Zalo=false và ngược lại: chỉ phương thức sẵn sàng có URL thật.
- Google=true, Zalo=true: hai OAuth chuyển hướng đúng URL, state/callback hoạt động thực tế trên domain đã đăng ký; kiểm thử hủy consent và thử đăng nhập lại.
- Chuyển VI/EN và nhập bằng bàn phím, tab focus, screen reader, reduced motion; không bị mất thông điệp trạng thái.
- Không còn tham chiếu logo từ Google Firebase UI hoặc Wikimedia ở Auth markup, giảm phụ thuộc CDN ngoại vi.

Chạy kiểm thử tự động:

```bash
npm ci
npm run build
npm run check
node --test tests/unit/auth-experience-v8.test.mjs
npm test
npm run test:browser
npm run i18n:audit
```

**Giới hạn xác minh:** môi trường đóng gói thiếu `js-yaml`, `sharp` và hạn chế truy cập trang trong Chromium, nên chưa chạy hết CI/browser hoặc kết luận giao diện đạt yêu cầu trên máy thật. Bản V8 cần GitHub CI và kiểm tra trực tiếp bởi người vận hành.
