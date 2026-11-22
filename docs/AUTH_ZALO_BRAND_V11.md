# Momevia — Zalo social login brand asset (2026-11-23)

## Vấn đề

Trước V11, nút đăng nhập bằng Zalo dùng chữ Z giả trong vòng tròn. Thiết kế này không phản ánh đúng nhận diện của ứng dụng Zalo.

## Giải pháp

- Thay biểu tượng chữ Z bằng SVG nhận diện Zalo (vòng xanh, bong bóng thoại trắng, wordmark “Zalo”).
- Lưu SVG tại `web/assets/brand/zalo.svg` để không phụ thuộc CDN khi đăng nhập.
- Chỉ bổ sung CSS cho ảnh trong `.auth-provider-logo`; không đổi OAuth endpoint, cookie, session, luồng đăng ký hoặc quyền.
- Bổ sung kiểm thử asset và rendering trạng thái đăng nhập Zalo.

## Nguồn và bản quyền

SVG dựa trên vector được cộng đồng dẫn nguồn từ VNG Corporation/Zalo: https://commons.wikimedia.org/wiki/File:Icon_of_Zalo.svg ; đối chiếu path công khai tại https://github.com/glincker/thesvg/issues/58. Đây là nhãn hiệu của VNG; việc dùng làm biểu tượng nhà cung cấp dịch vụ là nhận diện nguồn đăng nhập, không hàm ý quan hệ hợp tác hoặc chứng nhận thương hiệu.

Đây là logo ứng dụng **Zalo Social Login**, không phải logo **Zalo Official Account (OA)** dành cho doanh nghiệp. Backend Momevia dùng OAuth đăng nhập qua tài khoản Zalo, do đó không gắn nhầm dấu OA/doanh nghiệp vào nút đăng nhập.

## Lưu ý về SVG đỏ trong web/assets/basic-templates/en

`scripts/build/template-previews.mjs` tự ghi lại các file SVG mỗi khi `npm run build`. Những thay đổi này **không xuất phát từ bản vá logo**. Trước khi commit, kiểm tra `git diff -- web/assets/basic-templates/en/` và `git diff --numstat -- web/assets/basic-templates/en/`. Nếu đây là kết quả của bản dịch/template mới muốn phát hành thì có thể stage `web/`; nếu chỉ do nguồn lỗi/không mong muốn, giữ lại để kiểm tra riêng, không dùng `git restore` hàng loạt.

## Test

```bash
node --test tests/unit/auth-zalo-brand-v11.test.mjs tests/unit/auth-experience-v8.test.mjs
npm run build
npm run check
```

Kiểm tra trực quan `http://localhost:4100/login` trên desktop và mobile. Nếu Zalo OAuth chưa cấu hình, nút disabled là đúng; logo vẫn hiện nhưng nút không được bấm.
