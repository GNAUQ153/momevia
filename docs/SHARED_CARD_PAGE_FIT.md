# Mỗi trang thiệp vừa màn hình

`mountPlayer` dùng cùng một phép đo trong Canvas preview, Catalog preview và quà công khai. Mọi tài liệu dùng player này, gồm mẫu cũ và Canvas tự tạo sau này, nhận cơ chế vừa cả chiều rộng lẫn chiều cao; không cần thêm cờ riêng cho từng mẫu.

Player đo chiều cao viewport đang thấy, vị trí cảnh, thanh âm thanh, điều hướng, trạng thái và khoảng an toàn dưới trang. Khung và footer nằm trong diện tích còn lại. Phần nội dung được đo sau reflow rồi co đồng bộ; CSS `zoom` làm kích thước layout thực thay đổi, thay vì chỉ giấu scrollbar hoặc cắt phần tràn. Cập nhật khi viewport/visualViewport, font, ảnh, lời hồi đáp hoặc nội dung tương tác đổi kích thước. Trên màn ngang ngắn, phần nhãn phụ được đưa về vùng screen-reader để dành chỗ cho thiệp.

Lời nhắn dạng text dài hơn 620 ký tự có các phần tiếp nối theo ranh giới từ (tối đa 320 ký tự/phần). Dùng nút phần trước/tiếp hoặc điều hướng footer; đường mở sự kiện/RSVP trực tiếp giữ nguyên. Không chèn/xóa scene trong JSON. Giữ xuống dòng, khoảng trắng và dấu tiếng Việt; không ghi phiên bản đã cắt vào binding, nháp hay snapshot. Form/widget vẫn giữ cùng node và trạng thái, không remount theo phần. Locale cập nhật lại phần đọc và dừng typewriter cũ trước khi thay chữ.

Màu và sticker rực hơn thuộc bộ khởi tạo sáu mẫu. Vùng đọc sáng, nền đậm và màu nút có vai trò riêng; kiểm tương phản trên bề mặt đọc thực. Sticker dùng các mục vector hiện có trong Canvas và motion `sway` có giới hạn. Không tự thay màu trong nháp hoặc quà đã gửi.

Kiểm hồi quy: `tests/browser/card-page-fit.mjs` được nối vào `npm run test:canvas:browser`: mọi cảnh của 34 mẫu hiện hành, thêm tài liệu blank tương lai dạng dọc/ngang với lời nhắn dài, ở 320×568, 390×844, 1440×900 và 844×390. Kiểm bounding box, chiều cao nội dung thực và document scrollHeight; nối lại toàn bộ các phần lời nhắn phải đúng từng ký tự. Sáu quà thật được kiểm riêng qua luồng người nhận/RSVP/reply/video/touch.

Phạm vi là player Canvas dùng chung. Không biến trang Studio/Catalog, hộp thư chủ thiệp, textarea đang soạn hoặc trang nội dung web thông thường thành giao diện không cuộn. Không thay giá, quyền, lịch/RSVP, asset ACL hoặc dữ liệu đã lưu. Thiết bị vật lý/Safari và screen reader cần kiểm riêng; không suy ra từ Chromium.
