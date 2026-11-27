# Signature S5A — Catalog nghiệm thu local

S4 mới có Canvas document; sáu mẫu chưa đăng ký trong seed thông thường. S5A cho phép nghiệm thu trên website demo thật trước khi hoàn thành animation. Không bật Catalog production, không chạy migration, không thêm seed MySQL.

## Khởi động

Từ thư mục gốc đã cài dependency (`npm ci` nếu chưa cài):

```bash
npm run demo:web -- --signature --port 4116 --no-watch
```

Mở `http://127.0.0.1:4116`, vào Mẫu thiệp và tìm `Signature`. Có thể mở trực tiếp `/template/signature-secret-santa?preview=1`. Chọn sử dụng mẫu, đăng nhập bằng Sender trong `local/signature-demo-4116/tai-khoan-demo.json` rồi tạo nháp. Mỗi mẫu có bốn cảnh, ô ảnh, lời mời và artwork riêng; chỉnh sửa theo công cụ Canvas hiện tại. Tài khoản demo là dữ liệu cục bộ, không commit hoặc chia sẻ file tài khoản.

Profile mới sử dụng JSON riêng, không dùng tài khoản và bản nháp ở MySQL đang vận hành. Dừng bằng Ctrl+C; chạy lại cùng lệnh để giữ dữ liệu QA. Nếu cần profile mới, chọn cổng khác. Không sử dụng HTTPS/tunnel, origin ngoài hoặc profile tự chọn. Không dùng `.env` production hoặc sửa cờ storage của dự án thật. Chế độ `npm run dev` thông thường tiếp tục không quảng bá Signature.

Catalog demo đánh dấu sáu mẫu là QA trong subtitle VI/EN; giá 0 chỉ để thử nghiệm. Cover lấy qua route hiện có, kiểm tra quyền đọc Catalog trước khi render. Không thêm ảnh nhúng cá nhân, tài nguyên ngoài, font hoặc dependency. Không kích hoạt palette filter cho Signature nếu chưa có metadata bảng màu chuẩn. Chưa dựng đủ animation gốc (S5B+), chưa nghiệm thu giao diện browser/thiết bị thực hoặc nghiệp vụ RSVP tích hợp. Không dùng demo cho dữ liệu cá nhân thật.

Kiểm thử module: `node --test tests/unit/signature*.test.mjs tests/unit/phase02-card-type.test.mjs tests/unit/web-demo-config.test.mjs tests/unit/template-order.test.mjs`.
