# Phase 4.4C — Scroll Reveal

- Tận dụng observer của `scene-motion.js`; mỗi section được đánh dấu khi giao viewport và bỏ theo dõi. Callback đến muộn sau khi dispose bị bỏ qua.
- Không ẩn hoặc dịch chuyển toàn section; tiêu đề Featured và Journey chỉ fade nhẹ (420ms, 92–100%). Số thứ tự và minh họa How-to chuyển 8px trong 480ms, stagger tối đa 160ms trên desktop có con trỏ chính xác.
- Mobile không chạy stagger/translate mới; reduced motion, Save-Data được hỗ trợ và tab ẩn chuyển về trạng thái tĩnh. Khi đã chuyển tĩnh, không phát lại reveal của lần mount đó.
- Không can thiệp CTA, carousel, Hero mesh, Canvas, API hoặc database. Không dùng thư viện mới, không thêm timer/scroll listener.
- Kiểm thử: `node --test tests/unit/marketing-depth.test.mjs` và `npm run test:browser` trong môi trường fixture độc lập. Nghiệm thu VI/EN, không thay đổi khoảng cách Hero–Featured và không có section ẩn khi dùng bàn phím.
- Chưa triển khai parallax liên tục; ưu tiên ổn định và hiệu năng.
