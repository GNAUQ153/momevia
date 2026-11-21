# Recipient Canvas Player — Scene Navigation & Mobile UX

## Mục tiêu

Cải thiện điều hướng khi thiệp có nhiều cảnh mà không thay đổi dữ liệu thiết kế, logic tương tác hoặc phân quyền. Bản nâng cấp chỉ tác động lớp hiển thị của `mountPlayer`.

## Thay đổi

- `web/js/features/gift-runtime/scene-navigation.js` quản lý các nút cảnh ổn định. Chỉ dựng lại nút khi danh sách ID cảnh thật sự thay đổi.
- Một listener `click` và một listener `keydown` được gắn theo vòng đời player, hủy qua `AbortController`. ArrowLeft/ArrowRight/Home/End chỉ di chuyển focus; Enter/Space tiếp tục hành vi kích hoạt nút mặc định.
- Thanh `progress` dùng số cảnh đang xem và tổng số cảnh, có `aria-label` lấy từ từ điển VI/EN; ẩn nếu chỉ có một cảnh.
- Mobile dùng điều hướng cuộn ngang, giảm chiều cao UI, hỗ trợ scroll snap và auto-scroll trong chính thanh điều hướng. Không cuộn ép toàn bộ trang khi chuyển cảnh.
- Trạng thái `aria-current=step` và text nút tiếp tục đồng bộ khi mở cảnh mới. Tên cảnh do người tạo thiệp đặt không bị dịch tự động.
- CSS mới viết thành từng thuộc tính một dòng, có `prefers-reduced-motion: reduce`; không thêm emoji hoặc thư viện ngoài.

## Bất biến nghiệp vụ

Không thay đổi API, thanh toán, JSON Canvas, nội dung thiệp, hành vi mở quà, Reply, các hiệu ứng và quyền truy cập. Menu cảnh tiếp tục có quyền truy cập tương đương bản cũ; không tạo lối đi tắt mới qua các luồng bí mật.

## Kiểm thử

```bash
node --test tests/unit/recipient-canvas-navigation.test.mjs tests/unit/sender-recipient-journey.test.mjs
npm ci
npm run build
npm run check
npm test
npm run test:browser
npm run test:canvas:browser
```

Kiểm tra thủ công desktop/mobile với thiệp một cảnh và nhiều cảnh, chuyển VI → EN, dùng Tab và mũi tên/Home/End, thử chế độ giảm chuyển động, và thao tác mở thư qua các nút trong Canvas.

## Giới hạn xác minh

Unit test liên quan và kiểm tra khóa dịch/cú pháp đã chạy. Bộ unit test tổng tại môi trường bàn giao thiếu `sharp`, dẫn tới 6 bộ test không khởi động. Build, Playwright và MySQL E2E phải xác minh thêm trên máy phát triển/GitHub CI.
