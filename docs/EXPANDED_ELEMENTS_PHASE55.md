# Momevia — Phase 5.5: Expanded Elements & Canvas Discovery

## Phạm vi

Mở rộng **124 → 172 elements** (giữ 100 gốc + 24 trang trí Phase 5.4 + 48 Momevia Originals mới). Mỗi hình mới là sticker theo schema V2, dùng `stickerArt` và renderer hiện có, hỗ trợ đổi màu, phóng to, xoay, thứ tự layer và lưu/nhân bản/xuất bản.

### Sáu bộ sưu tập mới

| Chủ đề | Số lượng | Nội dung |
| --- | ---: | --- |
| Hoa & thiên nhiên | 8 | Tulip, hướng dương, cúc họa mi, oải hương, cỏ bốn lá, cành lá, bướm, vương miện hoa |
| Tết & may mắn | 8 | Đôi đèn lồng, thỏi vàng, đồng xu, cuộn thư xuân, hoa mận, đầu lân, pháo hoa, mây cát tường |
| Sinh nhật & lễ hội | 8 | Mũ sinh nhật, cupcake, bóng bay, hộp quà, cầu vồng, đũa sao, bánh nhiều tầng, huy hiệu |
| Tình yêu & ngày cưới | 8 | Nhẫn cưới, bó hoa, đôi chim câu, bánh cưới, ổ khóa, vô cực, chuông cưới, sổ lời hẹn |
| Thành tựu & học tập | 8 | Mũ tốt nghiệp, bằng khen, cúp, huy chương, sách, bút, bóng đèn, tên lửa |
| Du lịch & ký ức | 8 | Vali, máy bay giấy, ghim bản đồ, máy ảnh, la bàn, hộ chiếu, núi, thuyền buồm |

## Thay đổi trải nghiệm

- **Khám phá:** khung tiêu đề rõ ràng, tìm bằng tiếng Việt có dấu/không dấu.
- **Bộ lọc:** Tất cả; Theo dịp (Giáng sinh, Tết, Valentine, sinh nhật, tình yêu); Mới thêm (48 hình); Vừa dùng (12 ID gần nhất).
- **Kết quả:** đếm kết quả theo nhóm/từ khóa, thông báo rỗng có hành động xóa lọc.
- **Mobile:** bottom sheet thư viện tăng chiều cao tới 88dvh, hit target 42–44px, 2 cột dưới 390px, giữ keyboard focus visible và reduced motion.
- **Hiệu năng:** thumbnail tiếp tục tải theo IntersectionObserver của Designer; không thêm request tới bên ngoài.
- **Quyền riêng tư:** history chỉ ghi các ID gốc, lưu tùy chọn qua localStorage; không ghi tên, nội dung thiệp hay asset ID của người dùng.

## Nguồn và giấy phép

48 path vector trong `decorative-art-55.js` được xây dựng riêng bằng hình học/path SVG, **không sao chép mã SVG, font, logo hay asset** từ Grida, Kitbitz, Doory, Canvix, CanvasLite hoặc Lumio. Các repository này chỉ tham khảo mô hình thư viện, tìm kiếm và trải nghiệm thiết kế. Giữ tuân thủ giấy phép MIT của Fabric.js đã có trong dự án.

## Giới hạn

- Đây là sticker đơn sắc có chi tiết stroke, không phải gói ảnh raster nhiều lớp hoặc animation.
- Không thêm upload SVG tự do, không mở rộng schema database và không tự ý thay đổi tính năng trả phí/quyền Creator.
- Chế độ Vừa dùng là trải nghiệm cục bộ, không đồng bộ tài khoản.

## Kiểm thử bắt buộc trước phát hành

1. `node --test tests/unit/decorative-extended.test.mjs tests/unit/library-discovery.test.mjs`.
2. `npm run build && npm run check && npm test && npm run test:architecture`.
3. `npm run test:canvas:browser && npm run test:templates`.
4. `npm run package && npm run verify:package`.
5. Nghiệm thu trình duyệt ở 320, 375, 390, 768, 1024, 1440px và `prefers-reduced-motion`, xem đúng 172 hình, tìm/nhóm/lọc/Chèn/Undo/Redo, quyền Creator và màn hình người nhận.
6. GitHub CI/CD Ubuntu/Windows và Canvas MySQL 8.4 PASS trước khi merge/push `main`.
