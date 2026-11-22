## Bổ sung: đo lặp và so sánh before/after (22/11/2026)

Mỗi tổ hợp ngôn ngữ (VI/EN) và viewport (390/1024/1440px) mặc định đo **3 lượt** trong context trình duyệt mới. Báo cáo phiên bản 2 gồm các mẫu gốc và bảng **median/p75** để tránh ra quyết định từ một lần chạy nhiễu. `p75` được nội suy tuyến tính trên các giá trị hợp lệ, không tự đổi dữ liệu thiếu thành 0.

Ví dụ với Git Bash, sau khi đã chạy `npm run dev` ở Terminal khác:

```bash
MOMEVIA_PERF_TAG=before MOMEVIA_PERF_RUNS=3 npm run perf:marketing
# Sửa source và kiểm tra lại bằng cùng máy/cùng browser, trong điều kiện tương đương.
MOMEVIA_PERF_TAG=after MOMEVIA_PERF_RUNS=3 npm run perf:marketing
npm run perf:marketing:compare -- dist/reports/marketing-lab-before.json dist/reports/marketing-lab-after.json
```

`MOMEVIA_PERF_RUNS` chấp nhận 1–5, mặc định 3. `MOMEVIA_PERF_TAG` chỉ chấp nhận a-z, 0-9, `_` và `-` để tránh ghi file ra ngoài thư mục `dist/reports`. Nếu không có tag, file vẫn là `dist/reports/marketing-lab.json` để tương thích với công cụ cũ.

Khi so sánh, số dương là thời gian/CLS tăng (có thể xấu đi), số âm là giảm (có thể tốt hơn). Không đưa phép so sánh lab thành CI performance gate vì số đo còn biến động theo máy, tải ảnh, cache và môi trường. Browser regression hiện tại vẫn chặn JavaScript exception và tràn ngang.

# Marketing Hero — Quản lý hiệu ứng nền và đo hiệu năng local

## Phạm vi (22/11/2026)

- Hai quầng sáng (`mkt-stage__orb`) sử dụng `mkt-ambient` chỉ tiếp tục chạy khi slideshow đang hoạt động. Khi người dùng bấm **Tạm dừng**, mở preview, cuộn hero ra khỏi viewport, ẩn tab hoặc bật giảm chuyển động, trình chiếu và animation CSS cùng dừng.
- Khi trở lại viewport / đóng preview / tiếp tục, animation được phát tiếp từ vị trí trước đó. Không thay đổi tấm thiệp được chọn, thứ tự, ảnh, nội dung hoặc trạng thái được lưu.
- Trạng thái do `hero-templates.js` quản lý qua `data-mkt-ambient-running`, không cần thêm IntersectionObserver riêng. CSS tách thành từng khai báo trên dòng riêng.
- Bổ sung công cụ phòng lab chạy bằng Playwright ở máy phát triển. Không có thu thập analytics từ người dùng, không gọi API ghi dữ liệu và không gửi số liệu sang hệ thống bên thứ ba.

## Đo local

Terminal A:

```bash
npm ci
npm run dev
```

Terminal B:

```bash
npm run perf:marketing
```

Nếu local chạy cổng khác:

```bash
MOMEVIA_PERF_URL=http://127.0.0.1:4200/ npm run perf:marketing
```

Công cụ chỉ chấp nhận `localhost`, `127.0.0.1` hoặc địa chỉ IPv6 `[::1]`. Chromium đo trang chủ ở 390×844, 1024×768, 1440×900, cho cả VI và EN, rồi tạo `dist/reports/marketing-lab.json`. Thư mục `dist` là kết quả build, không commit vào Git.

Số liệu gồm TTFB, FCP, LCP (nếu PerformanceObserver hỗ trợ), CLS, phần thời gian long task vượt 50ms (chỉ là chỉ số tham khảo) và độ tràn ngang. Phát hiện tràn ngang hoặc lỗi JavaScript làm lệnh trả exit code 1. Thiếu LCP/FCP chỉ được ghi cảnh báo, không làm hệ thống giả vờ đo được.

## Giới hạn diễn giải

- Kết quả đo *synthetic/lab* phụ thuộc máy, mạng, cache và phiên bản Chromium; **không phải Core Web Vitals thực tế** và **không đo INP**. Không dùng dữ liệu một lần chạy để tuyên bố website nhanh hơn theo phần trăm.
- Để đánh giá cải tiến, so sánh ít nhất 3 lượt trước/sau trên cùng cấu hình, chú ý LCP, CLS, console errors và layout overflow. Trên thiết bị mobile thực tế, kiểm tra thêm CPU, GPU, FPS và tương tác touch.
- Đã bổ sung browser regression kiểm tra CSS animation khi tạm dừng, cuộn khỏi viewport và quay lại. Cần xác nhận chạy đầy đủ Playwright sau khi áp dụng lên main.

## An toàn

Không thay đổi API, database, thiết kế lưu trữ Canvas, quyền truy cập, token, nội dung thiệp hoặc quy trình thanh toán. Bản vá không tự triển khai và không bật bất kỳ công cụ giám sát dữ liệu người dùng nào.
