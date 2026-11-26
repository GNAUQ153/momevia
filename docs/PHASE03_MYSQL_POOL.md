# Phase 3.5C — Quản lý kết nối và vòng đời transaction

## Phạm vi

- Backend một tiến trình (`createHttpApp`) sở hữu một `MySqlClient` lazy, truyền vào Identity, Catalog, Checkout, Payments, Designs, Gifts và Support. Module JSON không mở pool riêng; Payment vẫn dùng MySQL khi được phép như trước. Các service legacy độc lập giữ client riêng; Checkout và Payment trong cùng service dùng chung client khi Checkout chạy MySQL.
- Client được đóng tại Composition Root sau cleanup của module; lỗi startup cũng đóng các tài nguyên đã đăng ký và pool. Không gọi `app.close()` trong khi HTTP còn nhận request: bootstrap hiện dừng HTTP trước, giới hạn shutdown vẫn là 10 giây.
- `close()` chờ các thao tác `execute` / `withTransaction` đã được nhận, bao gồm cả thao tác đang chờ lấy connection, không mở pool mới và trả cùng Promise khi gọi lặp. Client đã đóng không tái sử dụng; khởi tạo client mới nếu cần restart.
- Transaction giữ một connection đến commit/rollback; rollback lỗi sẽ destroy connection thay vì release, giữ lỗi gốc. Facade `tx.execute` không được gọi sau khi callback kết thúc. Callback phải await toàn bộ truy vấn và chỉ dùng transaction facade cho truy vấn thuộc transaction; không gọi client bên ngoài hoặc provider trong callback.
- Không thay đổi retry nghiệp vụ, thứ tự khóa, schema, migration, dependency, API, giá hoặc cấu hình kết nối. Không thêm global retry khi commit thất bại vì kết quả commit có thể chưa xác định.

## Giới hạn và nghiệm thu

Với toàn bộ module MySQL và một tiến trình, số pool lazy có thể giảm từ 7 xuống 1. Giới hạn kết nối mặc định 5, queue limit 100 giữ nguyên; trước đây mỗi pool có giới hạn riêng, nay queue và connection limit dùng chung. Không giảm limit xuống 1–2 trên production khi chưa đo contention. Mỗi replica và các script vận hành vẫn có pool/kết nối riêng. Không đồng nhất giới hạn lý thuyết với số kết nối thực tế hoặc chi phí Railway.

- `npm run test:database`: test mock pool lifecycle, rollback lỗi, đóng trong khi đang đợi pool và factory injection.
- `npm run test:canvas:mysql:api`: fixture QA độc lập kiểm tra tất cả Repository dùng chung client và thực thi hồi quy HTTP/MySQL thật. Không chạy trên database production.
- `npm run build && npm run check && npm test`; `npm run package && npm run verify:package` trước release.
- Sau triển khai, theo dõi `Threads_connected`, `Threads_running`, `Max_used_connections`, lỗi queue, p95 latency, deadlock và RAM/CPU. Không tăng limit chỉ để che truy vấn chậm. Theo dõi cả thời gian chờ chung giữa Canvas và Payment; rollback release code nếu xuất hiện regression.

Không đo performance/chi phí thực tế tại phase này. Không thay đổi giới hạn pool hoặc bật merchant live.
