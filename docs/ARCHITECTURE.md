# Kiến trúc Momevia

`npm start` nối các module trong một backend Node.js. Static server phục vụ HTML/CSS/ES modules và API qua cùng origin. Topology nhiều service cũ được giữ để kiểm tra tương thích.

| Phần | Nơi tra mã |
| --- | --- |
| Điều phối HTTP, Origin, phiên và route | `src/server/app.mjs`, `src/gateway/static.mjs` |
| Tài khoản, session, cấp vai trò | `src/modules/identity/` |
| Catalog, nháp Creator, duyệt phiên bản, quyền ảnh demo | `src/modules/catalog/` |
| Nháp Sender, save/CAS, asset, xuất bản và context checkout | `src/modules/designs/` |
| Đơn, quyền mẫu, provider và biên nhận | `src/modules/checkout/`, `src/modules/payments/` |
| Link, quyền quà, hồi đáp, thu hồi và Support | `src/modules/gifts/`, `src/modules/support/` |
| Điều hướng, editor, player và schema | `web/js/app/`, `web/js/pages/`, `web/js/features/`, `web/js/shared/canvas/` |

## Dữ liệu và quyền

- Creator và Sender dùng schema canvas chung, với quyền chỉnh sửa khác nhau. Phiên bản Creator gửi duyệt chốt revision, vùng được cá nhân hóa và ảnh demo. Catalog trỏ phiên bản đã duyệt. Gift giữ snapshot và tham chiếu ảnh đã pin khi xuất bản.
- Identity kiểm tra phiên và role hiện tại ở request cần đăng nhập, gồm sau khi Admin đổi role. API tài nguyên kiểm chủ sở hữu hoặc quyền link quà ở từng endpoint.
- Mười hai mẫu tích hợp giữ ID và giá. Fingerprint nguồn của preset legacy khác phiên bản Creator đã duyệt. Editor dùng revision, ACK và phục hồi cục bộ cho nháp.
- JSON dùng một tiến trình, ghi vào `services/*/data/`. Canvas commit aggregate bằng atomic rename. MySQL dùng transaction và khóa cho xuất bản cùng quyền mẫu. Ảnh nằm ngoài DB.
- Public API chặn `/internal`. Server bỏ header chuyển tiếp do client tự khai khi nhận trực tiếp. Static assets, logo và CSS dùng chung nằm trong `web/`. Build tạo QR cục bộ và thumbnail từ lockfile và preset.

[Frontend và Studio](FRONTEND.md) · [Hợp đồng API](ENDPOINTS.md) · [Lưu trữ, khôi phục và CI/CD](OPERATIONS.md) · [Giấy phép](THIRD_PARTY_NOTICES.md)
