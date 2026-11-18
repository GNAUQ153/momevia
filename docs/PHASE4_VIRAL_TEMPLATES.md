# Momevia — Phase 4: Viral Templates & Recipient Conversion

## Phạm vi đã triển khai

Bộ sưu tập tăng từ 14 lên 24 mẫu Momevia Originals. 10 mẫu mới dùng vector Canvas editable, có ba cảnh (bìa, lời chúc, hồi đáp) và ba binding: `recipientName`, `senderName`, `message`.

| ID | Dịp | Giá thử nghiệm trong seed |
|---|---|---:|
| `winter-wishes-2026` | Giáng sinh 2026 | Miễn phí |
| `new-year-spark-2027` | Năm mới 2027 | Miễn phí |
| `spring-blessing-2027` | Tết Nguyên đán 2027 | Miễn phí |
| `velvet-valentine-2027` | Valentine 2027 | Miễn phí |
| `birthday-radiance` | Sinh nhật | Miễn phí |
| `thank-you-bloom` | Cảm ơn | Miễn phí |
| `proud-of-you` | Chúc mừng | Miễn phí |
| `faraway-hug` | Nhớ người ở xa | Miễn phí |
| `gentle-apology` | Xin lỗi | Miễn phí |
| `calm-light` | Động viên | Miễn phí |

Các mẫu mới mặc định miễn phí trong đợt marketing; thay đổi sang trả phí cần được phê duyệt theo kế hoạch kinh doanh. Đây là cấu hình catalog hiện tại, không mặc định mở thanh toán live. Những gói trả phí vẫn tuân thủ entitlement và chính sách thanh toán đã có.

## Mẫu theo mùa

Các đợt ưu tiên hiển thị theo `Asia/Ho_Chi_Minh`:

- Giáng sinh: 10/11/2026–26/12/2026.
- Tết Dương lịch: 20/12/2026–07/01/2027.
- Tết Nguyên đán: 15/01/2027–22/02/2027.
- Valentine: 01/02/2027–15/02/2027.

Đây là khung truyền thông, **không phải ngày nghỉ lễ chính thức**. Tất cả các mẫu vẫn tìm được quanh năm và quà đã phát hành không bị thay đổi theo mùa. Trong `/explore`, ô đang vào mùa lên trước, bộ lọc "Lễ hội" giúp xem cả bốn mẫu.

## Viral loop & quyền riêng tư

- Với quà Legacy: thành phần CTA được ghép trong `web/js/pages/gifts.js`.
- Với quà Canvas: thành phần CTA được ghép sau player trong `web/js/app/main.js`.
- Cả hai dùng `web/js/ui/recipient-viral.js`: nút **Tạo thiệp của riêng bạn** đến `/explore?source=recipient`, nút **Khám phá thêm mẫu** và dòng **Tạo bằng Momevia**.
- Link chuyển đổi không chứa slug của quà, invite token, tên người nhận, người gửi hoặc nội dung riêng tư. Tham số `source=recipient` hiện chỉ biểu thị nguồn điều hướng; **chưa xây Analytics tracking/conversion ở backend**.
- Quà bị thu hồi hoặc hết hạn vẫn theo logic 410 hiện có; CTA không được dùng để bỏ qua quyền xem.

## Seed an toàn

`src/modules/catalog/app.mjs` chèn `addedSystemTemplates` qua `repo.get` và `insertUnique`. Khi khởi động application sau nâng cấp, 10 ID mới sẽ được thêm vào JSON/MySQL; bản ghi có sẵn không bị cập nhật giá hay trạng thái. Không chạy `DROP DATABASE`, không xoá volume MySQL.

Chạy `npm run dev` sau khi cập nhật; nếu MySQL chưa chạy, khởi động container trước bằng lệnh Compose hiện có. Có thể kiểm tra danh sách trong `momevia_dev.templates` bằng DBeaver và API `/api/catalog/templates`.

## Build & QA

```bash
npm ci
npm run build
npm run check
npm test
npm run test:architecture
npm run package
npm run verify:package
npm run db:ping
npm run db:verify
```

Chạy thêm các bài test canvas/website theo CI hiện có. Test thủ công trên 320, 390, 768 và 1440px; kiểm tra keyboard focus, `prefers-reduced-motion`, tất cả 10 mẫu, recipient page Legacy/Canvas, không tràn ngang. Kiểm tra Browser network: link CTA không phát tán query `invite` của trang quà.

## Quy chuẩn UI/UX và giấy phép

- Toàn bộ hình minh họa trong 10 mẫu là vector Shape/Line/Text do Momevia tự dựng; mỗi phần vẫn chỉnh sửa được trong Canvas Designer. Không dùng icon emoji, ảnh stock hoặc plugin UI mới.
- Icon CTA dùng bộ SVG Lucide đã tích hợp sẵn (ISC; một số nguồn Feather MIT), giữ chú thích ở `web/js/ui/icons.js`.
- CSS tách theo mục đích, mỗi thuộc tính trên một dòng. Đã bổ sung breakpoints và chế độ giảm chuyển động.

## Việc chưa triển khai

- Chưa thu thập conversion metrics (`gift_view`, `recipient_cta_click`, `gift_publish`) vì cần thiết kế consent và dữ liệu tổng hợp.
- Chưa tự tạo âm nhạc, thư viện asset bên thứ ba hoặc animation timeline nâng cao.
- Chưa kiểm thử live payment provider và không tự động mở bán gói trả phí.
