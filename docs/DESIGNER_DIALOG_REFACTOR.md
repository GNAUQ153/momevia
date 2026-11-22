# Momevia — Canvas Designer: tách hộp thoại xem trước và quyền quà

## Mục tiêu

Tách hai modal nhiều trạng thái khỏi `web/js/pages/designer.js`, để Designer giữ vai trò điều phối nháp và phiên làm việc. Không thay đổi Canvas JSON, quyền do backend quyết định, thanh toán, nhạc nền, mẫu, API hoặc giao diện VI/EN.

## Những module mới

- `gift-access-dialog.js`: tạo biểu mẫu quyền mở/gửi/đọc quà, cập nhật mô tả đúng VI/EN theo ngôn ngữ hiện hành (các câu ngăn cách bằng dấu cách), từ chối lựa chọn không hợp lệ và trả `null` khi người dùng hủy hoặc rời route.
- `preview-dialog.js`: tạo modal xem trước dùng `mountPlayer` ở chế độ `preview`; nút làm lại/chỉnh sửa/gửi vẫn như trước. Dọn Player, DOM và registry dialog khi đóng, kể cả nhấn Escape hoặc đóng route.
- `designer-dialog-refactor.test.mjs`: xác minh 18 tổ hợp quyền, mô tả link thường/link mời, dữ liệu sai, AbortSignal đã hủy và các điểm tích hợp còn được giữ.

## Kiểm tra cần thực hiện trên máy phát triển

1. `npm ci && npm run build && npm run check && npm test`.
2. `npm run test:browser && npm run test:canvas:browser`.
3. Tại Designer, tạo hoặc mở nháp, chọn Xem trước, thử Bắt đầu lại, Đóng, Escape và nút Gửi tại Quick Mode.
4. Chọn quyền mở/gửi/đọc, xác minh mô tả link thường và link mời; thử hủy xuất bản rồi xuất bản lại.
5. Thử chuyển route trong lúc dialog mở và kiểm tra không còn Player phát nhạc/giữ listener; thử VI → EN.
6. Xác nhận CI/CD trên `main` sau khi push. Trước khi CI xanh, chưa coi bản cập nhật là hoàn tất ở production.

## Bảo mật và giới hạn

Kiểm tra lựa chọn trong UI chỉ giúp ngăn dữ liệu sai vô tình; backend vẫn là nơi thực thi quyền truy cập. Bản này không thêm endpoint hay quyền, không cấp quyền tự động và không thay đổi dữ liệu quà đã xuất bản.

## Tài nguyên

Không thêm thư viện, font hoặc tài nguyên bên thứ ba.
