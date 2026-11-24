# Đưa 50 element động vào MySQL cục bộ đang dùng

Đã cập nhật **127.0.0.1:3306 / momevia_dev**, phục vụ [Momevia chính](http://localhost:4100). Profile demo 4110 và QA 4191 là môi trường riêng.

## Xem kết quả

- [Studio đủ 50 mẫu](http://localhost:4100/design/52868dbf-4046-45c8-b9b3-1363b4b2a84d) — đăng nhập bằng tài khoản kiểm tra ghi ở `local/animated-elements-live-20261124/REVIEW.txt`. Vào **Thêm → Chuyển động**.
- [Link nhận quà đủ 50 mẫu](http://localhost:4100/g/Err_0eHJha3xxwCpCrtPtGfouYMQgdJ3); [tim hai dòng](http://localhost:4100/g/1HShIBDHsHBm9fy3e11Ko-iILvKzlEkR).
- [Mở quà → lời chúc/ảnh → hồi đáp](http://localhost:4100/g/LP6-7eGYBWBtJ6viPjxtm8TzdlDfsUgO), đã thử Enter/chạm và gửi hồi đáp ẩn danh khi CTA nổi hiện.

## Sao lưu và cập nhật

Trước cập nhật có 480 hàng thư viện, 243 element, 6 mục Chuyển động; tim revision 2 khớp định nghĩa legacy đã duyệt. Writer 4100 được dừng ngắn để sao lưu và cập nhật rồi mở lại cùng cấu hình MySQL.

Backup giữ riêng tại **database\private\animated-elements-live-20261124**, đã được gitignore; không đưa SQL, media riêng tư hoặc cookie vào Git.
- SQL đầy đủ **2,360,448 byte**, SHA-256 `502d35a9a7f7102138b68d536bee438f84a5615c5247ab1a0c3999c4669719f5`.
- Khôi phục thật trên schema tạm riêng: **36 bảng**, hash từng bảng và toàn bộ SQL data dump trùng. Schema thử được xóa sau khi kiểm.
- Sao chép và kiểm checksum **14 tệp media**. Tệp cấu hình chứa mật khẩu MySQL tạm đã xóa.
- Gói đúng **50 ID mới + tim**, expectedRevision/fingerprint theo baseline thật; thêm 50 hàng sau thứ tự hiện có. Các gói QA cũ giữ nguyên phạm vi.
- Áp dụng **51**, chạy lại **0 / 51 unchanged**. Dry-run rollback sẵn sàng 51; chưa hoàn tác thư viện đang dùng.

API hiện có **530 hàng / 293 element / 56 mục Chuyển động**. Đối chiếu đủ 51 định nghĩa với nguồn dựng sẵn. 34 bảng ngoài thư viện và 14 media không thay đổi khi áp dụng. Sau kiểm tra trình duyệt, tất cả hàng đã có trước đợt kiểm tra vẫn giữ hash nguyên vẹn. Chỉ thêm tài khoản, nháp, quà/hồi đáp tổng hợp của lần kiểm này.

## Git

Không làm trên main. Nhánh `feat/animated-elements-50-20261124`; mốc nguyên khối trước khi chia giữ ở `backup/animated-elements-50-unsplit-20261124`. Ba commit đầu tách engine, bộ 50 mẫu và bằng chứng QA; so cây nguồn sau chia với f4e1e7d không khác biệt. Các commit tiếp theo tách triển khai cục bộ/kiểm chứng và CTA.

## Lệnh cập nhật có bảo vệ

Lệnh riêng: `database/scripts/animated-elements-live.mjs`. Luôn truyền `--allow-local-live --host 127.0.0.1 --port 3306 --database momevia_dev --state-dir database/private/animated-elements-live-20261124`.
- Chuẩn bị: `--prepare --mysql-bin <thư-mục-mysql> --expected-library-hash <hash-đã-đọc>`; tạo backup, baseline và kiểm khôi phục trước khi cho phép cập nhật.
- Xem trước: `--expected-state-hash <hash-của-state.json>`; áp dụng thêm `--apply`.
- Xem trước hoàn tác thêm `--rollback`; chỉ thực thi khi thêm `--apply`. CAS/fingerprint không khớp sẽ dừng và giữ sửa của Admin.

Bằng chứng: [verified-live.json](animated-elements-live-20261124/verified-live.json), [50 Studio/preview/player trên DB chính](animated-elements-live-20261124/local-live-browser.json), [CTA và nhận quà](animated-elements-live-20261124/floating-cta-browser.json). Thông tin đăng nhập tổng hợp nằm trong thư mục local/private, không nằm trong tài liệu này.
