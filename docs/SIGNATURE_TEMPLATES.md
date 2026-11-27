# Signature S4 — Sáu mẫu Canvas nghiệm thu nội bộ

S4 sử dụng artwork riêng đã phát triển ở S1–S3, không lấy sticker/illustration Classic. Mỗi mẫu có bốn scene: mở, nội dung sự kiện, ảnh kỷ niệm, hồi đáp. Mỗi layer có ID ổn định trong template, có thể chỉnh qua cơ chế Canvas hiện tại; ID của các bản sao được quản lý bằng cơ chế nhân bản hiện có.

| Template ID | Ý tưởng tương tác sẽ triển khai ở S5 |
| --- | --- |
| signature-secret-santa | ribbon-pull |
| signature-midnight-soiree | wax-envelope |
| signature-garden-tea | gatefold |
| signature-last-chapter | camera-focus |
| signature-graduation-mixtape | polaroid-print |
| signature-graduation-countdown | calendar-peel |

Tất cả được định hướng thiệp mời theo nội dung sự kiện của HTML nguồn. Không nhúng ảnh cá nhân, ngày giờ cố định, HTML/script, font ngoài hoặc RSVP giả. Tên, lời mời, tên người gửi, ô ảnh, ngày và địa điểm là dữ liệu riêng. Sử dụng font token hiện có (không cam kết giống font HTML gốc). Cảnh mở dùng button điều hướng tạm thời, chưa có chuyển động đặc trưng. Nội dung ảnh để trống tùy chọn. SVG là bản xem trước tĩnh từ Canvas renderer; không chứng minh runtime, font production hoặc trải nghiệm mobile thực tế. Cả sáu bố cục còn cần bổ sung các chi tiết concept (lịch thật, scrapbook, chất liệu, hiệu ứng) và nghiệm thu thị giác.

## Nghiệm thu

`node --test tests/unit/signature-templates.test.mjs`

`node scripts/dev/signature-previews.mjs` xuất 12 JSON draft và 48 SVG VI/EN vào `dist/reports/signature-s4`. Không copy thư mục báo cáo vào public_html. Không commit ảnh/báo cáo nếu không có chủ đích.

## Release gate

Chưa thêm vào Catalog seed hoặc MySQL library seed. Không xuất hiện trong thư viện công khai, chưa cấp giá hay quyền mới. Factory `createBasicTemplate` nhận ID nội bộ để phục vụ preview/test. S5 cần triển khai opening theo từng concept và kiểm thử browser; S6 nối quy trình Sender/RSVP/media và S7 nghiệm thu rồi đăng ký Catalog/library, mapping card type, semantic slots, asset cover, event tools. Không bỏ qua quyền sở hữu hoặc kiểm tra publish.
