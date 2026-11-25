# Phase 3.2B — Tách trách nhiệm DesignsService

## Phạm vi

Refactor bảo toàn hành vi: giữ `DesignsService` làm lớp điều phối, constructor, method và export cũ. Không đổi API HTTP, schema Canvas, chính sách Premium, quyền truy cập, cấu hình, database hoặc frontend. Các module mới không mở kết nối MySQL hoặc tạo service mới.

| Module | Trách nhiệm |
| --- | --- |
| `designs.service.mjs` | Điều phối tạo, lưu, nhân bản, preflight, xuất bản và checkout context |
| `document-hash.mjs` | Canonical SHA-256 dùng cho revision và idempotency |
| `design-views.mjs` | Projection thiết kế/thiệp và ánh xạ vùng sự kiện |
| `edit-policy.mjs` | Bảo vệ cấu trúc đã khóa, vùng cá nhân hóa và nguồn Invitation |
| `publication-check.mjs` | Kiểm tra trước xuất bản: cấu trúc, quyền mẫu, tài sản, bindings và thời hạn |

Các consumer production chỉ cần projection/hash chuyển sang import trực tiếp. Export từ service được giữ để tương thích. Policy không có trạng thái tiếp tục dùng function thay vì ép thành class.

## Ràng buộc phải giữ

- Không thay đổi thuật toán canonical hash và payload idempotency.
- `save` vẫn truyền callback kiểm tra chính sách trên bản ghi hiện hành dưới khóa CAS của repository.
- `publish` vẫn gọi `check` bên trong callback Unit of Work, truyền `getAsset`, `getTemplate`, `hasLicense` từ transaction khi có; không dùng kết quả preflight cũ để cấp quyền.
- Giữ thứ tự blocker, mã lỗi và thông báo hiện hành; lỗi nguồn quyền vẫn fail-closed.
- Projection không tiết lộ token hoặc metadata kho lưu trữ; không sửa dữ liệu nguồn.
- Không sửa MySQL Repository hoặc các câu SQL ở phase này.

## Kiểm thử

`node --test tests/unit/phase03-design-responsibility.test.mjs` kiểm tra sáu trường hợp: tương thích export/hash, projection, callback khóa lưu, quyền thay đổi lúc xuất bản, lỗi quyền fail-closed và tài sản khác chủ. Callback transaction trong unit test là fixture, không phải MySQL thật.

Chạy `npm run check:architecture`, `npm run check`, `npm test`, `npm run test:architecture`, `npm run test:browser`, `npm run test:canvas:browser` và CI MySQL cô lập trước nghiệm thu. Không chạy test integration với DB production.

## Giới hạn

Tách trách nhiệm không làm giảm tự động độ phức tạp tổng thể; `checkPublication` vẫn có các nhánh nghiệp vụ cũ. Designs Repository và các module frontend lớn sẽ xử lý ở phase sau. Các chức năng QA-only về quota và hoàn tiền không được kích hoạt.
