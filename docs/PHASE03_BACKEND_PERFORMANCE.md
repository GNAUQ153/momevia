# Phase 3.6A — Giám sát hiệu năng Backend

## Bật/tắt

Mặc định không bật giám sát, không tạo timer hay log định kỳ. Để đo tại local/QA,
đặt `MOMEVIA_PERF_INTERVAL_MS=60000` trong môi trường của Backend rồi khởi động
lại. Trên Railway, chỉ đặt biến này ở service Node.js khi cần đo. Giá trị `0`
(tắt) hoặc số nguyên từ 30000 đến 3600000 ms; giá trị không hợp lệ sẽ từ chối
startup. Khi kết thúc đo, bỏ biến hoặc đặt lại `0` và redeploy. Không cần migration.

Tìm log JSON có `event: "momevia.performance"`. Một dòng mỗi cửa sổ, không tạo
endpoint công khai, không xuất file, không gọi dịch vụ giám sát bên ngoài. Timer
không giữ tiến trình sống và được dừng tại Composition Root khi app đóng. Báo
cáo bắt đầu sau startup; không flush cửa sổ chưa hoàn tất khi shutdown.

## Đọc số liệu

| Trường | Ý nghĩa |
| --- | --- |
| `windowMs` | Thời gian thực tế giữa hai mẫu, không giả định timer chạy đúng hạn |
| `process.cpuCorePercent` | CPU của tiến trình theo phần trăm một core; có thể vượt 100 |
| `process.rssBytes` | RSS tiến trình, không phải RAM toàn container |
| `process.heapUsedBytes`, `externalBytes` | Heap JS và bộ nhớ external của Node |
| `process.eventLoopUtilization` | Tỷ lệ hoạt động event loop trong cửa sổ (0–1) |
| `http.inFlight`, `peakInFlight` | Số request chưa kết thúc và đỉnh đồng thời |
| `http.groups` | 6 nhóm API cố định, static và other; thống kê HTTP status và request bị ngắt |
| `mysql.activeOperations`, `peakActiveOperations` | Số thao tác MySqlClient đang chạy hoặc chờ, không phải số kết nối vật lý |
| `mysql.operations.query` | Thời gian execute ngoài transaction, gồm chờ pool |
| `mysql.operations.transaction` | Thời gian toàn transaction gồm chờ pool, SQL, commit hoặc rollback |
| `errors` | Số thao tác MySQL thất bại, kể cả lỗi nghiệp vụ từ callback transaction |
| `p50UpperMs`, `p95UpperMs`, `p99UpperMs` | Cận trên xấp xỉ của bucket, không phải percentile chính xác |

Histogram dùng 12 bucket cố định, cận trên 5/10/25/50/100/250/500/1000/2500/5000/10000 ms
và bucket tràn (dùng max làm cận trên). Cửa sổ rỗng trả null cho độ trễ; tác vụ
bắt đầu ở cửa sổ trước và hoàn thành ở cửa sổ sau được đếm tại cửa sổ sau.
HTTP đo đến `finish` phía server (không phải thời gian người dùng nhận đủ byte);
request bị ngắt chỉ tăng `aborted`. SQL bên trong transaction không được đếm
lần nữa thành query độc lập. Không dùng private API của mysql2.

## Nghiệm thu trước khi tối ưu

- Chạy `node --test tests/unit/backend-performance.test.mjs` và `npm run test:database`.
- Đo local/QA độc lập trước: idle, catalog, lưu nháp Canvas và checkout sandbox.
- So sánh cùng workload, phiên bản và tài nguyên, ghi số lượng request mỗi cửa sổ.
- Đối chiếu log Node với CPU/RAM/network của Railway cho cả Backend và MySQL.
- Không suy ra chi phí từ CPU của riêng tiến trình; không giảm pool hoặc buffer
  chỉ dựa vào số liệu một cửa sổ. Độ trễ p95/p99 ít mẫu không đại diện tải thực.
- Chưa đo thời gian chờ connection riêng, số connection vật lý, CPU MySQL,
  container RSS hoặc chi phí. Không chạy load test trên production.

Không ghi SQL, tham số, URL, token, request/response body, IP, ID người dùng,
error message hoặc credential. Log là dữ liệu vận hành nội bộ; không công khai.
