# Phase 4.4E – Interactive Product Showcase

- Bước Open trong Journey có nút mở/đóng quà mẫu, hộp quà CSS và thiệp minh họa hiện có. Demo không tạo quà thật, không truy cập API, không cần tài khoản, không phát nhạc.
- Nút native hỗ trợ bàn phím và cảm ứng; `aria-expanded` liên kết tới đoạn thông báo song ngữ. Khi chuyển bước, demo trở về trạng thái đóng; chọn lại bước hiện tại không làm mất trạng thái.
- Scene vẫn là vùng minh họa `aria-hidden`; toàn bộ điều khiển nằm ngoài scene. CSS transition hữu hạn, không có timer hoặc listener mới ngoài controller Journey hiện có. Reduced motion tắt transition.
- Tái sử dụng icon Lucide và token thương hiệu; không bổ sung tài sản bên ngoài hoặc dependency.
- Nghiệm thu: kiểm tra mở/đóng, reset, dispose, nút bàn phím, vuốt, VI/EN, chiều rộng 320–1440px và reduced motion. Chạy Browser E2E trước khi push; không thay đổi ngưỡng khoảng cách section.
