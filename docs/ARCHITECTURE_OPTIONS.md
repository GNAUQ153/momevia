# Đánh giá mô hình triển khai và lưu trữ

Bản phân tích trước chuyển đổi ngày 16/11/2026. **Cập nhật:** runtime mặc định đã chuyển thành Modular Monolith ở v0.6.0; các đoạn mô tả topology 6 process dưới đây chỉ còn tính lịch sử. **PostgreSQL vẫn chưa migrate.** Xem [ARCHITECTURE.md](ARCHITECTURE.md) để biết kiến trúc hiện tại.

## Kết luận

Momevia hiện không bắt buộc dùng microservices. Với phạm vi MVP và cách các phần đang được triển khai cùng nhau, đề xuất phù hợp hơn cho giai đoạn tiếp theo là **modular monolith**: một backend triển khai như một ứng dụng, chia rõ module Identity, Catalog, Checkout, Gifts, Support; frontend giữ riêng. Có thể bổ sung worker xử lý ảnh/tác vụ nền khi có số đo cần thiết.

Đây là đánh giá theo mã nguồn và phạm vi sản phẩm, không phải kết luận từ benchmark tải. Đợt sắp xếp thư mục vẫn giữ sáu process để tránh thay đồng thời cả cấu trúc mã, topology, xác thực và dữ liệu.

## Vì sao microservices chưa tạo lợi ích rõ ở hiện tại?

- Năm nhóm nghiệp vụ còn nhỏ; chưa có bằng chứng về đội phát triển độc lập hoặc nhu cầu phát hành/scale riêng từng service.
- Launcher hiện khởi động cả sáu process trên một máy, một repo, cùng Node/shared library và JWT secret. Tách process chưa đem lại tính độc lập vận hành đầy đủ.
- Gifts gọi Catalog/Checkout đồng bộ, còn các API xác thực phụ thuộc Identity. Có thêm proxy, timeout, lỗi mạng và đồng bộ trạng thái cần quản lý.
- File JSON không có transaction nhiều file. Việc tách process không giải quyết tính nhất quán reply/counter hay license theo credit.
- Chưa có HA, service discovery và quan sát vận hành phân tán để khai thác lợi ích của mô hình này.

Việc ưu tiên ranh giới module trước, tách thành service độc lập khi có lý do rõ ràng phù hợp với phân tích chi phí của [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html). Microservices hướng tới các service triển khai độc lập; không chỉ là có nhiều thư mục hoặc cổng HTTP. [Lewis/Fowler](https://martinfowler.com/articles/microservices.html)

## So sánh cho Momevia

| Phương án | Lợi ích | Chi phí/giới hạn | Đánh giá |
|---|---|---|---|
| Sáu process như hiện tại | Giữ cách chạy hiện có, lỗi process có ranh giới riêng | Nhiều cổng, IPC/HTTP và phụ thuộc Identity; JSON không an toàn nhiều writer | Duy trì trong đợt refactor này |
| Modular monolith | Một backend để phát hành/giám sát, gọi module trong process, thuận tiện tổ chức transaction khi có DB | Cần ranh giới module rõ; lỗi process ảnh hưởng cả backend | Đề xuất cho bước kiến trúc tiếp theo |
| Microservices vận hành đầy đủ | Có thể scale/phát hành từng phần độc lập | Tốn công HA, network, dữ liệu phân tán, tracing, deploy và xử lý lỗi | Chỉ nên chọn khi có yêu cầu đo được |

Chưa có cơ sở để hứa một tỷ lệ tăng tốc, giảm RAM hoặc chi phí cụ thể. Modular monolith vẫn có thể chạy nhiều instance sau khi lớp DB/phiên/media hỗ trợ đúng; số người dùng lớn không tự động buộc phải dùng microservices.

## DB hiện tại thực sự là gì?

**Hiện là JSON file storage, chưa dùng hệ quản trị DB SQL/NoSQL.**

Bằng chứng: `src/shared/storage.mjs` dùng `readFileSync` → `JSON.parse`, cập nhật toàn mảng rồi ghi file tạm/rename. Mỗi module tạo `JsonRepository` trong `repositories.mjs`. Dependency runtime chỉ có sharp và qrcode-generator, không có driver MySQL/PostgreSQL/SQLite/MongoDB/Redis. Không tìm thấy cấu hình kết nối DB trong luồng khởi tạo đang dùng.

| Module | Vị trí lưu hiện tại |
|---|---|
| Identity | `services/identity/data/users.json`; phiên mới dùng thêm `sessions.json` |
| Catalog | `services/catalog/data/templates.json`, `favorites.json` |
| Checkout | `services/checkout/data/orders.json` |
| Gifts | `services/gifts/data/gifts.json`, `replies.json`, thư mục `images/` |
| Support | `services/support/data/requests.json` |

Tại lần kiểm tra trước refactor có bảy file JSON local hiện hữu; `sessions.json` là file cấu hình cho runtime cập nhật, được tạo khi service tương ứng khởi chạy. Không suy ra đã có dữ liệu phiên chỉ từ khai báo repository. Không đưa nội dung tài khoản, liên hệ hoặc quà vào báo cáo.

JSON hiện có ưu điểm đơn giản, không cần cài DB server. Nhưng nó đọc/ghi cả file, không có index/constraint và transaction nhiều file. Rename một file không biến hai lần ghi gifts/replies thành transaction, không bảo vệ nhiều writer và không thay thế kế hoạch backup/restore.

## Phương án DB tiếp theo

| Lựa chọn | Khi phù hợp | Điểm cần lưu ý |
|---|---|---|
| Giữ JSON | Demo nhỏ trên một máy, một writer cho mỗi file | Không dùng làm nền cho thanh toán/credit hoặc nhiều instance |
| SQLite | Prototype/pilot một máy cần constraint và transaction, muốn ít vận hành | Giới hạn ghi đồng thời; không dùng file DB chia sẻ qua mạng như một DB server |
| PostgreSQL | Chuẩn bị vận hành thương mại, transaction cho đơn/quyền dùng/credit và nhiều client ghi | Cần migration, backup, quản lý kết nối và vận hành DB |

Đề xuất ưu tiên PostgreSQL nếu mục tiêu gần là sản phẩm thương mại; SQLite là lựa chọn nhẹ hơn cho pilot một máy. Đây là đề xuất, chưa cài hay tạo schema. Xem [hướng dẫn lựa chọn SQLite](https://www.sqlite.org/whentouse.html) và [transaction PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html).

## Lộ trình nếu chọn modular monolith

1. Giữ các module và service vừa tách; lắp chúng vào một HTTP app, bảo toàn URL `/api/...`.
2. Thay client HTTP giữa module bằng interface gọi trong process. Việc xác minh phiên phải giữ được thu hồi phiên và role hiện tại, không quay lại chỉ tin JWT cũ.
3. Chọn DB độc lập với quyết định topology. Chuyển JSON bằng migration có backup và thử khôi phục; giữ ID, slug, password hash, role, đơn/license và thời hạn cũ.
4. Dùng transaction cho thao tác cần toàn vẹn, unique constraint email và idempotency thích hợp. Bỏ phụ thuộc vào tính đồng bộ của file I/O để đảm bảo tính đúng.
5. Chạy lại unit, API, browser, kiểm thử cạnh tranh/crash và đo tải; chỉ bỏ các entrypoint/cổng cũ khi không còn consumer cần chúng.

Chưa thực hiện các bước chuyển topology/DB trên trong đợt sắp xếp mã này. Không tạo repo/worktree hoặc deploy. Commit local được thực hiện riêng theo yêu cầu người dùng sau refactor; chưa push.
