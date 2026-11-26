# Phase 3.6E — Đo tải Backend và đánh giá chi phí

## Phạm vi và an toàn

`npm run perf:backend` là công cụ benchmark GET opt-in, không phải công cụ tạo tải production. Chỉ kết nối HTTP tới địa chỉ IPv4 127.0.0.1 và cổng số; không nhận URL tùy ý, không follow redirect, không gửi token/cookie, không đọc .env hoặc ghi database trực tiếp. Loopback không chứng minh database đích là local: không dùng port forward, tunnel, proxy hoặc tiến trình local đang kết nối Railway. Dùng một profile demo JSON mới, độc lập; kiểm tra không có `storage.json` chuyển sang MySQL trước khi khởi động. Không chạy nếu cấu hình storage/đích chưa được xác nhận.

Mặc định 20 request/kịch bản, 2 request đồng thời, timeout toàn request 5 giây. Tối đa 100 request/kịch bản, concurrency 10, timeout 10 giây và 8 MiB body/request (ngắt khi vượt). Các giới hạn là ngân sách của công cụ, không phải hạn mức RAM hay SLA của Backend. Ngừng cấp request mới ngay khi phát hiện lỗi, chờ request đã chạy hoàn tất và không chạy kịch bản sau. Nếu không lấy được ETag hợp lệ thì đánh dấu kịch bản 304 chưa chạy. Exit code khác 0 nếu bất kỳ kịch bản nào lỗi hoặc thiếu.

## Thực hiện trên Git Bash (Windows)

1. Chọn cổng chưa dùng, ví dụ 4116. Kiểm tra profile `local/web-demo-4116` chưa tồn tại hoặc là JSON QA độc lập. Mở terminal thứ nhất:

```bash
MOMEVIA_PERF_INTERVAL_MS=60000 npm run demo:web -- --port 4116 --no-watch
```

2. Mở terminal thứ hai ở root dự án, khi demo đã sẵn sàng:

```bash
mkdir -p dist/reports
MOMEVIA_LOAD_LOCAL_QA=true MOMEVIA_LOAD_PORT=4116 MOMEVIA_LOAD_REQUESTS=20 MOMEVIA_LOAD_CONCURRENCY=2 npm run --silent perf:backend > dist/reports/backend-load.json
```

3. Xem exit code ngay sau lệnh (`echo $?`), sau đó đọc báo cáo. Nếu có 429, 503, timeout hoặc lỗi khác, ngừng tăng tải và kiểm tra log; không thay đổi Rate Limiter để ép PASS. Chỉ thử concurrency 5, rồi 10 khi mức trước ổn định. Không chạy nhiều bản benchmark cùng lúc. Dừng demo bằng Ctrl+C khi hoàn tất.

## Cách đọc báo cáo

| Kịch bản | Kỳ vọng |
| --- | --- |
| health | 200, JSON không rỗng |
| catalog-vi | 200, JSON không rỗng, header locale vi |
| catalog-en | 200, JSON không rỗng, header locale en |
| thumbnail-200 | 200, image/webp không rỗng |
| thumbnail-304 | 304, không body, ETag khớp với preflight |

Độ trễ tính từ lúc bắt đầu HTTP request đến khi nhận hết response, percentile nearest rank của mẫu đạt contract. Lỗi được báo riêng, không tính vào percentile. Throughput tính tất cả mẫu đã hoàn thành trong cửa sổ kịch bản; số request thực tế có thể ít hơn cấu hình nếu dừng sớm. `bodyBytes` tính byte body nhận được, không gồm headers, TCP/TLS hay lưu lượng nội bộ. Chỉ kiểm tra HTTP status, content-type, body không rỗng và ETag; không thay thế test nội dung JSON, WebP, quyền truy cập hoặc nghiệp vụ. Preflight ETag thêm tối đa một GET ngoài các mẫu đo, không tính vào latency hoặc bodyBytes của kịch bản. Không xuất body, ETag, URL hay dữ liệu khách hàng trong báo cáo.

Một ảnh cố định được dùng lặp lại, nên kịch bản thumbnail đo workload cache nóng/hỗn hợp, không phải kiểm thử nhiều ảnh cache lạnh. Các nhóm chạy tuần tự, không mô phỏng tất cả module đồng thời. Chạy ba lần cùng cấu hình, cùng máy, phiên bản Node, dataset, trạng thái cache và điều kiện mạng; so sánh từng kịch bản, không gộp percentile của các nhóm. Với 20 mẫu, p99 là mẫu lớn nhất; không suy diễn SLA từ ít mẫu.

## Frontend và MySQL

Dùng công cụ đã có `MOMEVIA_PERF_URL=http://127.0.0.1:4116/ npm run perf:marketing` trên demo cô lập (kiểm tra không gọi API production hoặc tải tài nguyên nhạy cảm). Cần Playwright/browser. Đo LCP, CLS và long-task trong lab; long-task không phải INP. Đo INP riêng qua tương tác thực. So sánh VI/EN trên mobile/laptop/desktop.

Benchmark JSON demo không đo shared MySQL pool. Dùng `npm run test:canvas:mysql` và `npm run test:canvas:mysql:api` trên MySQL QA riêng, sau khi xác nhận cấu hình fixture. Các ca đó là kiểm thử tính đúng đắn, không phải benchmark contention. Muốn đo contention cần workload MySQL QA đại diện và metrics Phase 3.6A; không chạy fixture ghi dữ liệu trên Railway production.

## Đánh giá chi phí Railway (không có giá hardcode)

- Trên Railway Metrics/Usage, ghi riêng Backend và MySQL: CPU, RAM, network egress, volume và khoản phí usage thực tế. Lấy các cửa sổ trước/sau cùng độ dài, cùng traffic và cấu hình; đừng trộn thời gian build/redeploy với idle runtime.
- Dùng log `momevia.performance` của Phase 3.6A (nếu đã bật) để đối chiếu CPU của tiến trình, RSS, heap, HTTP/MySQL latency. CPU process không phải CPU billing container; RSS không phải RAM billing của cả project.
- Ước tính phần usage theo đơn giá trên tài khoản: CPU vCPU-giờ × đơn giá CPU + RAM GB-giờ × đơn giá RAM + egress GB × đơn giá egress + volume theo đơn vị tính phí thực tế. Cộng phí khác nếu có, áp dụng credit/minimum/thuế đúng theo gói. Không cộng trùng phí gói đã bao gồm usage.
- Không nội suy kết quả localhost thành hóa đơn Railway hoặc hạ connection limit chỉ từ kết quả JSON. Chưa có dữ liệu thật thì chưa kết luận tiết kiệm.

## Nghiệm thu

```bash
node --test tests/unit/backend-load.test.mjs
npm run check:architecture
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Test sử dụng HTTP server loopback và fixture, không cần Railway, MySQL hay Sharp. Công cụ mới không được gọi từ runtime hoặc tự động chạy tải trong CI; CI chỉ chạy unit test. Không có migration, dependency hoặc thay đổi deployment.
