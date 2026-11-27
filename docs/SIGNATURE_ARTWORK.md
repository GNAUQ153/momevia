# Signature S1 — nền tảng artwork

Sáu HTML nguồn do người dùng cung cấp: Secret Santa, Midnight Soirée, Garden Tea, The Last Chapter V2, Graduation Mixtape, Graduation Countdown.

`web/js/shared/canvas/signature/art.js` chuyển các chi tiết thiết kế thành Canvas model độc lập. Không dùng preset/sticker Classic. `createSignatureArtwork(id)` tạo ID mới, giữ vị trí, kích thước, xoay và dữ liệu vector riêng. `signatureConcept(id)` trả về tên, nền và mã tương tác dự kiến, chưa phải interaction registry.

## Nguồn và giới hạn tái tạo

| Concept | Chi tiết lấy từ nguồn | Chuyển đổi |
| --- | --- | --- |
| Secret Santa | `.box3`, `.gcard`, `.bd`, `.lid`, `.rv`, `.bow svg` | Sáu lớp; nơ chuyển tọa độ SVG, màu gradient chuyển thành các vùng màu |
| Midnight Soirée | `.env`, `.back`, `.letter`, `.pocket`, `.flap`, `.seal` | Năm lớp; giữ hình học phong thư, giản lược gradient |
| Garden Tea | `.door.l`, `.door.r`, `.door svg`, `.seal` | Năm lớp; nhánh lá chuyển ellipse/rotate thành Bézier, nền giản lược |
| Last Chapter | `.camera`, `.lens`, `.dial`, `.lens:after` | Sáu lớp; ảnh cá nhân thay bằng image placeholder |
| Graduation Mixtape | `.camera`, `.print`, `.polaroid`, ảnh máy ảnh có chân dung nhúng | Bảy lớp; vẽ lại máy ảnh retro, hai placeholder ảnh tùy chọn, không nhập JPEG chứa chân dung |
| Graduation Countdown | `.calendar`, `.days`, `.peel`, `.disco` | Năm lớp; lưới, giấy, sticker và quả cầu; ngày/tháng chưa kết nối dữ liệu sự kiện |

SVG path được giới hạn theo library-contract hiện tại. Canvas dùng shape/image như kiểu dữ liệu trung lập, không dùng artwork cũ. Với màu, chỉ các path có fill/stroke `color` liên kết thuộc tính color; các màu phụ cố định ở phase này.

Không đưa HTML gốc, script, URL font ngoài, ảnh cá nhân, dữ liệu RSVP mẫu hoặc audio demo vào thư mục public. Kiểm tra quyền sử dụng tài nguyên gốc trước khi công bố artwork thương mại. Chưa sao chép font hoặc ảnh chứa người.

## Chưa kích hoạt production

S1 chỉ thêm module và test. Chưa đăng ký element vào thư viện SQL, chưa tạo sáu mẫu trong Catalog, chưa nối animation, chưa có component mở thiệp, chưa có API RSVP, chưa thay đổi Editor UI. Các shape có thể được Fabric adapter nhận diện; đây không phải xác nhận kéo thả trên giao diện thật. Cần S2/S3 để triển khai nhóm Signature Elements và S4/S5 để đưa mẫu lên Catalog và player. Không chạy database migration trong S1.

Kiểm thử: `node --test tests/unit/signature-art.test.mjs`.
