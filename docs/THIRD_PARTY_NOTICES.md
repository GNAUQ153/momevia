# Thành phần mã nguồn mở và tài nguyên bên ngoài

1. **Lucide Icons** — bộ icon SVG mã nguồn mở, MIT License. Website: https://lucide.dev/ . License: https://lucide.dev/license . File sử dụng các SVG path: `web/js/icons.js`, có chú thích nguồn ngay đầu file. Dự án không phân phối font icon bên ngoài.
2. **Node.js** — runtime JavaScript (MIT và nhiều giấy phép thành phần), người dùng tự tải tại https://nodejs.org/ . Không đóng gói Node trong ZIP.
3. **Google OAuth 2.0** — API đăng nhập bên ngoài, phụ thuộc điều khoản của Google; https://developers.google.com/identity/protocols/oauth2/web-server . Không phải thư viện mã nguồn mở đóng gói.
4. **Zalo Social API v4** — API đăng nhập ngoài, phụ thuộc điều khoản của Zalo; https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/user-access-token-v4 . Không phải thư viện mã nguồn mở đóng gói.
5. **qrcode-generator 2.0.4** — tạo QR cục bộ, MIT, Copyright (c) 2009 Kazuhiko Arase; https://github.com/kazuhikoarase/qrcode-generator . Build sao chép module từ package đã khóa phiên bản vào `web/js/vendor/qrcode.js`, giữ nguyên phần ghi nhận bản quyền. Không sử dụng QR Server API nữa.

UI, nền artwork, CSS animation và source code còn lại được tạo riêng cho MVP. Không sử dụng ảnh stock hoặc emoji trong giao diện.

6. **Google Fonts** — Plus Jakarta Sans, Inter và Lora, bộ chữ web nguồn mở theo giấy phép SIL Open Font License; https://fonts.google.com/ . Được nhúng qua stylesheet `fonts.googleapis.com` và lấy glyph từ `fonts.gstatic.com` khi có mạng. **Không đóng gói hay phân phối tệp font trong ZIP.**
7. **Logo đăng nhập Google** — SVG nhận diện chữ G nhiều màu do Google cung cấp, tham khảo https://developers.google.com/identity/branding-guidelines và tài nguyên dùng trong FirebaseUI tại https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg . Đây là nhãn hiệu, không phải icon MIT; dùng để thể hiện đúng nhà cung cấp đăng nhập.
8. **Logo đăng nhập Zalo** — icon Zalo do VNG cung cấp, được Wikimedia Commons ghi nguồn từ https://zalo.me/ và hiển thị tại https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg . Xem mô tả và tình trạng nhãn hiệu: https://commons.wikimedia.org/wiki/File:Icon_of_Zalo.svg . Không ám chỉ Momevia liên kết thương mại với Zalo. Yêu cầu tuân thủ quy định nhãn hiệu khi triển khai.

**Lưu ý tải tài nguyên:** Các biểu tượng logo bên ngoài cùng ba font đòi hỏi kết nối Internet để hiển thị chính xác. Ứng dụng có fallback font hệ thống đúng theo yêu cầu; nếu cần triển khai offline hoàn toàn phải có phương án phân phối font/asset được cấp phép phù hợp.

**MUI và Font Awesome:** không được đưa vào bản MVP này. Thay vào đó sử dụng Lucide SVG cục bộ để nhẹ hơn và không phụ thuộc CDN. Nếu nhóm muốn chuyển sang MUI ở giai đoạn tiếp theo, cần thực hiện migration React và bổ sung license tương ứng.

## Momevia 3D Brand Asset

Logo 3D của Momevia là hình tạo mới bằng AI theo yêu cầu người dùng, được dùng trong `web/assets`. Không sử dụng font bên thứ ba đóng gói trong ZIP.

## Dependency xử lý và kiểm thử

- **sharp 0.35.5** — Apache-2.0, https://sharp.pixelplumbing.com/ ; giải mã, giới hạn pixel và encode lại ảnh để bỏ metadata. Binary đi kèm có libvips và giấy phép thành phần riêng, được cài qua npm thay vì chép vào gói nguồn.
- **js-yaml 5.5.0** — MIT, https://github.com/nodeca/js-yaml ; chỉ dùng để kiểm tra YAML trong môi trường phát triển/CI.
- **jsQR 1.4.0** — Apache-2.0, https://github.com/cozmo/jsQR ; chỉ dùng trong kiểm thử để giải mã QR và đối chiếu link gốc.
- **ESLint 10.15.0** và **globals 17.14.0** — MIT, https://eslint.org/ và https://github.com/sindresorhus/globals ; chỉ dùng trong quality check để kiểm tra định danh/import và môi trường Node/browser.
- **Playwright 1.65.1** — Apache-2.0, https://playwright.dev/ ; chỉ dùng trong browser regression trên fixture. Browser binary được cài riêng hoặc dùng Edge có sẵn, không đóng gói trong gói nguồn.
