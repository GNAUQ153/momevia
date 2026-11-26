# Phase 4.4B — Nền mesh của Hero

- Lớp `::before` thuộc `.mkt-stage__atmosphere`, nằm trong vùng trang trí `aria-hidden`, có `overflow: hidden` từ component cũ.
- Ba gradient dùng token thương hiệu, không đổi nền chữ, mặt thiệp hay kích thước layout.
- Animation chỉ dùng transform và opacity, một lượt 4,4 giây; trạng thái đầu/cuối giống nền tĩnh. Không tạo RAF, timer, dependency hoặc request mới.
- Chỉ bật trên viewport từ 900px với hover và con trỏ chính xác, khi người dùng không yêu cầu giảm chuyển động. Dùng `data-mkt-ambient-running` từ vòng đời Hero hiện có để tạm dừng khi cover ngoài viewport, tab ẩn, tiết kiệm dữ liệu hoặc mở preview. Thiết bị không hỗ trợ Network Information API vẫn có nền tĩnh theo reduced motion/mobile.
- Chuyển động của carousel, orb và tilt cũ giữ nguyên; chưa chứng nhận WCAG cho toàn bộ Hero. Cần đánh giá nút tạm dừng carousel ở phase accessibility tiếp theo.
- Kiểm thử Browser Home kiểm tra nền tĩnh VI/EN, Browser Hero Motion kiểm tra animation hữu hạn, pause khi preview và reduced motion. Kiểm tra Core Web Vitals trên production là bước riêng.
