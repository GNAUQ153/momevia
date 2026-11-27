# Phase 4.4F – CTA sau trải nghiệm quà mẫu

- CTA tạo thiệp xuất hiện trong vùng kết quả sau khi mở quà; khi đóng hoặc đổi bước, vùng kết quả ẩn trở lại.
- Nút replay đổi từ primary sang secondary khi quà mở; giữ nút native, focus và aria-expanded. CTA dùng chung hộp thoại chọn thiệp với Hero, không tạo quy trình mới.
- Hộp thoại giữ các đường dẫn thiệp mời, thiệp chúc mừng và trang trống. Đóng bằng Escape hoặc nút đóng trả focus về đúng opener. Dispose tháo listener của cả hai CTA.
- Trên mobile, hai nút có chiều rộng linh hoạt theo vùng chứa và cho phép nhãn xuống dòng; dùng token màu và reduced motion hiện có.
- Không gọi API từ demo, không tạo giao dịch, không thay đổi dữ liệu hoặc quyền xuất bản. Không thêm analytics: tỷ lệ chuyển đổi phải được đo riêng trước khi kết luận hiệu quả.

## Nghiệm thu

Chạy `node --test tests/unit/brand-*.test.mjs tests/unit/marketing-*.test.mjs`, `npm run check`, và `npm run test:browser` trong môi trường kiểm thử độc lập. Kiểm tra CTA ẩn khi đóng, mở hộp thoại bằng Enter, focus sau Escape, reset khi đổi bước và giao diện VI/EN trên 320–1440px. Không hạ ngưỡng bố cục Hero–Featured.
