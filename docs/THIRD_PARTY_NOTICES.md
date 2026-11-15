# Thành phần mã nguồn mở và tài nguyên bên ngoài

1. **Lucide Icons** — bộ icon SVG mã nguồn mở, MIT License. Website: https://lucide.dev/ . License: https://lucide.dev/license . File sử dụng các SVG path: `web/js/icons.js`, có chú thích nguồn ngay đầu file. Dự án không phân phối font icon bên ngoài.
2. **Node.js** — runtime JavaScript (MIT và nhiều giấy phép thành phần), người dùng tự tải tại https://nodejs.org/ . Không đóng gói Node trong ZIP.
3. **Google OAuth 2.0** — API đăng nhập bên ngoài, phụ thuộc điều khoản của Google; https://developers.google.com/identity/protocols/oauth2/web-server . Không phải thư viện mã nguồn mở đóng gói.
4. **Zalo Social API v4** — API đăng nhập ngoài, phụ thuộc điều khoản của Zalo; https://docs.zaloplatforms.com/docs/Social/social-api/tham-khao/user-access-token-v4 . Không phải thư viện mã nguồn mở đóng gói.
5. **QR Server API (goQR.me)** — dịch vụ sinh ảnh QR tùy chọn. Chỉ sử dụng sau khi người dùng xác nhận chia sẻ URL quà; https://goqr.me/api/ . Đây là external service; không có mã thư viện được sao chép vào project.

UI, nền artwork, CSS animation và source code còn lại được tạo riêng cho MVP. Không sử dụng ảnh stock hoặc emoji trong giao diện.

6. **Google Fonts** — Plus Jakarta Sans, Inter và Lora, bộ chữ web nguồn mở theo giấy phép SIL Open Font License; https://fonts.google.com/ . Được nhúng qua stylesheet `fonts.googleapis.com` và lấy glyph từ `fonts.gstatic.com` khi có mạng. **Không đóng gói hay phân phối tệp font trong ZIP.**
7. **Logo đăng nhập Google** — SVG nhận diện chữ G nhiều màu do Google cung cấp, tham khảo https://developers.google.com/identity/branding-guidelines và tài nguyên dùng trong FirebaseUI tại https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg . Đây là nhãn hiệu, không phải icon MIT; dùng để thể hiện đúng nhà cung cấp đăng nhập.
8. **Logo đăng nhập Zalo** — icon Zalo do VNG cung cấp, được Wikimedia Commons ghi nguồn từ https://zalo.me/ và hiển thị tại https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg . Xem mô tả và tình trạng nhãn hiệu: https://commons.wikimedia.org/wiki/File:Icon_of_Zalo.svg . Không ám chỉ Momevia liên kết thương mại với Zalo. Yêu cầu tuân thủ quy định nhãn hiệu khi triển khai.

**Lưu ý tải tài nguyên:** Các biểu tượng logo bên ngoài cùng ba font đòi hỏi kết nối Internet để hiển thị chính xác. Ứng dụng có fallback font hệ thống đúng theo yêu cầu; nếu cần triển khai offline hoàn toàn phải có phương án phân phối font/asset được cấp phép phù hợp.

**MUI và Font Awesome:** không được đưa vào bản MVP này. Thay vào đó sử dụng Lucide SVG cục bộ để nhẹ hơn và không phụ thuộc CDN. Nếu nhóm muốn chuyển sang MUI ở giai đoạn tiếp theo, cần thực hiện migration React và bổ sung license tương ứng.

## Momevia 3D Brand Asset

Logo 3D của Momevia là hình tạo mới bằng AI theo yêu cầu người dùng, được dùng trong `web/assets`. Không sử dụng font bên thứ ba đóng gói trong ZIP.
