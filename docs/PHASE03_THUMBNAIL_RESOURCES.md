# Phase 3.6B — Giới hạn tài nguyên render thumbnail

## Phạm vi

`cover-thumbnail.mjs` dùng cache Promise tối đa 128 mục trước bản vá. Khi cache đầy, Promise chưa hoàn tất có thể bị loại, làm một yêu cầu cùng khóa khởi động lại công việc đang chạy. Cache chỉ giới hạn số mục chứ chưa giới hạn tổng dung lượng kết quả. Các lần cache miss có thể đưa nhiều tác vụ vào Sharp đồng thời.

Bản vá giữ khóa SHA-256 theo nội dung SVG và chiều rộng, chất lượng WebP 82, effort 4, các kích thước hiện có và chuyển WebP nhúng sang PNG trước khi rasterize. Không sửa ảnh gốc, URL, DB, quyền hoặc quy trình xuất bản. Không có dependency hay biến môi trường mới.

## Giới hạn theo từng tiến trình Node.js

| Tham số | Mặc định |
| --- | ---: |
| Render thumbnail đồng thời | 2 |
| Tổng tác vụ riêng biệt đang chạy + chờ | 34 |
| Tổng số byte SVG đầu vào đang chạy + chờ | 32 MiB |
| Số mục kết quả trong LRU | 128 |
| Tổng byte Buffer kết quả được cache | 16 MiB |

- Yêu cầu cùng khóa dùng chung Promise, kể cả khi hàng đợi đã đầy. Cache hit không tạo tác vụ render.
- Hàng đợi FIFO. Khi quá số tác vụ hoặc ngân sách input, trả HTTP 503 `COVER_RENDER_BUSY`. Một SVG lớn hơn ngân sách input trả HTTP 413 `COVER_RENDER_TOO_LARGE`.
- Sau render thành công hoặc lỗi, slot và ngân sách input được trả lại. Lỗi không được cache. Kết quả lớn hơn ngân sách cache vẫn trả về nhưng không lưu.
- Cache kết quả dùng LRU, tách khỏi tác vụ đang chạy nên eviction không làm mất cơ chế chống render trùng.

Đây là các giới hạn logic, không phải giới hạn RSS của tiến trình. Sharp/libvips, SVG sau khi mở rộng ảnh nhúng, Buffer chia sẻ, HTTP response và các bước dựng/đọc SVG trước khi vào hàng đợi vẫn tiêu thụ bộ nhớ ngoài ngân sách này. Không giới hạn tất cả đường xử lý ảnh Sharp, không hủy render đang chạy khi client ngắt và không thêm timeout hàng đợi. Cần đo trước khi chỉnh giới hạn; giới hạn mặc định được chọn để bảo toàn trải nghiệm tải nhiều thẻ hơn so với từ chối ngay khi đủ 2 tác vụ.

## Nghiệm thu

- `node --test tests/unit/thumbnail-cache.test.mjs` — kiểm tra FIFO, giới hạn số job và byte, chống trùng, LRU, lỗi và thử lại.
- `node --test tests/unit/cover-thumbnail.test.mjs` — kiểm tra tích hợp Sharp, WebP, ảnh nhúng và kích thước; cần cài dependency thật.
- `npm run build && npm run check && npm test` và `npm run package && npm run verify:package`.
- Chỉ kiểm thử tải trên local/QA. Kiểm tra nhiều người mở Catalog, cùng/khác mẫu, ảnh bị lỗi và mã HTTP 503; so sánh p95/p99, RSS, CPU và tỷ lệ lỗi giữa baseline và bản vá.
- Dùng `MOMEVIA_PERF_INTERVAL_MS=60000` trong đợt đo, kết hợp Metrics Railway. Không diễn giải các giới hạn logic thành mức giảm RAM/CPU hoặc chi phí thực tế.

Không chạy migration. Không yêu cầu upload lại frontend. Khi auto deploy bật, push main có thể redeploy Backend. Nếu 503 tăng bất thường hoặc độ trễ tăng, xem lại giới hạn và cân nhắc revert commit thay vì hạ giới hạn Railway tùy tiện.
