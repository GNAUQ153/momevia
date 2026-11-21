# Nguồn gọi, localhost và kiểm thử tổng — 21/11/2026

Hoàn tất WIP trên `plan/event-card-redesign`, từ mốc `5b7e58a`. Theo yêu cầu cập nhật, `localhost`, `127.0.0.1` và `[::1]` được xem là các địa chỉ loopback tương đương **ở mọi môi trường, kể cả production**, khi cùng giao thức và cổng và URL đã cấu hình là loopback. Origin công khai/tunnel phải khớp chính xác URL chính hoặc `ALLOWED_ORIGINS`; không suy ra quyền từ `Host` hay header proxy.

## Nguyên nhân và thay đổi

Ca Canvas từng mong 403 cho `localhost` trong khi WIP chủ động cho phép địa chỉ này thay `127.0.0.1`. Kiểm thử được đồng bộ với quy tắc đã duyệt: các alias được tạo quà thành công, còn origin lạ, sai cổng, sai giao thức, tên miền giả dạng localhost, tunnel chưa khai báo và `Origin: null` đều nhận 403 JSON, không phát cookie và không tạo thêm quà. Cùng ca đó khởi động lại fixture bằng cấu hình production để kiểm tra thật việc chấp nhận alias và từ chối nguồn lạ.

Hàm kiểm dùng chung cho server một tiến trình và gateway. Chuỗi origin được kiểm trước khi URL chuẩn hóa, nên các đường dẫn như `/a/..`, dấu backslash, query, fragment, wildcard hoặc thông tin đăng nhập không được lách thành origin hợp lệ. Yêu cầu không có Origin vẫn dùng được cho CLI/callback server-to-server như trước.

Web demo hỗ trợ nhiều `--allowed-origin`; cấu hình được chuyển vào bản demo cô lập. Tài liệu và `.env.example` đã cập nhật. Địa chỉ chia sẻ quà vẫn lấy từ `PUBLIC_BASE_URL`.

Kiểm thử MySQL API còn chứa giả định tất cả 24 mẫu đều có 3 cảnh. Đã sửa để đối chiếu từng document với số cảnh khai báo trong Catalog; các kiểm thử riêng vẫn bảo vệ số 5/6/5 của ba mẫu sự kiện. Không sửa preset để ép về 3 cảnh.

## Kết quả kiểm thử

Mã chức năng kiểm tại `0f465e5` (gồm hai commit trước đó), Windows, Node 24.14.0, Playwright 1.65.1 / Edge, MySQL 8.4.13. Toàn bộ lượt kiểm cuối dưới đây đạt trên thư mục làm việc thật, không cần bỏ qua phần nguồn gọi hoặc dùng bản backend cũ:

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` | PASS, 1.538 khóa VI/EN, 24 bìa mỗi ngôn ngữ |
| `npm run check` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS, 0 lỗ hổng |
| `npm test` | PASS, 384/384 |
| `npm run test:templates` | PASS, tạo/lưu/đăng/quyền/locale và thư viện cũ/mới |
| `npm run test:canvas` | PASS, gồm alias trong production và các nguồn bị cấm |
| `npm run test:canvas:browser` | PASS, toàn bộ Canvas, 33 hiệu ứng, Creator, hồi phục, gửi/nhận và mobile |
| `npm run test:browser` | PASS, gồm HTTP architecture, đăng nhập/đăng xuất qua alias/tunnel và nguồn lạ |
| `npm run test:architecture:legacy` | PASS, gateway cùng 5 service, thu hồi phiên, quyền, nguồn gọi và header giả |
| `test:canvas:mysql` | PASS, 13 ca adapter trên schema thử rỗng |
| `test:canvas:mysql:api` với browser | PASS, 20 ca HTTP/MySQL/provider giả, gồm Creator/Sender/người nhận và phục hồi |
| Phục hồi MySQL và ảnh | PASS, 9 migration, đối chiếu bảng và bytes/hash, mở lại V1/V2 và album lồng bằng cùng link/cổng |
| Web demo khởi tạo mới | PASS, đăng nhập qua localhost/127, hai origin khai báo bằng CLI, origin lạ bị chặn |
| `npm run package` + `npm run verify:package` | PASS, manifest/checksum và loại trừ tệp dữ liệu/cấu hình riêng |
| Bản sao gói đóng | PASS: check, 384 unit, architecture, templates, canvas |

`test:browser` bao gồm luồng HTTP architecture; `test:canvas:browser` bao gồm luồng API Canvas. Nhóm unit MySQL cũng nằm trong `npm test`. Không cần chạy lặp lại các alias lệnh để tạo thêm số ca.

MySQL chạy trong container mới, nhãn QA theo quy tắc bảo vệ của bộ backup/restore, bind cổng ngẫu nhiên trên 127.0.0.1. Schema và credentials chỉ là dữ liệu tổng hợp; container được dừng/xóa sau lượt kiểm. Lần chạy đầu dừng đúng ở kiểm số cảnh cũ; lần thiết lập restore đầu bị guard từ chối vì tên/nhãn container chưa đúng. Đã chỉnh môi trường thử đúng guard và chạy lại đầy đủ, không nới guard. Lượt cuối: external provider requests = 0. Thanh toán merchant thật không chạy.

Gói đóng được kiểm trên bản sao có dependency riêng, không sửa gói đã xác minh. Không ghi dữ liệu production, không sửa `.env` thật hoặc khởi động lại dịch vụ thật. Nhật ký chi tiết và thông số fixture nằm ở `local/origin-final-qa/`, không đưa credentials hay SQL dump vào commit. Các ca trên chạy cục bộ Windows/Node 24; ma trận CI Ubuntu/Node 22 không được khởi chạy từ lượt không-push này.

## Chia commit

1. `dde2429` — quy tắc origin dùng chung, alias loopback, unit và kiểm HTTP/production/gateway.
2. `f5a238a` — cấu hình origin trong web demo, `.env.example` và tài liệu vận hành.
3. `0f465e5` — sửa kiểm số cảnh của MySQL API theo metadata từng mẫu.
4. Báo cáo kiểm thử tổng này và đóng ghi nhận lỗi cũ.

Tối đa 4 commit mới trong lượt này, không push, không PR hoặc triển khai máy chủ.
