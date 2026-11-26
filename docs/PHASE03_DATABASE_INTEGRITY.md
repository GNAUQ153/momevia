# Phase 3.5D — Database Integrity

## Sử dụng

- `npm run db:audit`: kiểm tra migration offline, không kết nối MySQL.
- `npm run db:audit -- --live --integrity`: yêu cầu schema mới nhất và kiểm tra 11 invariant liên bảng. Chỉ chạy khi đã xác minh database đích; ưu tiên QA hoặc bản sao chỉ đọc. Có thể quét nhiều dòng, không chạy định kỳ trên production khi chưa đo tải.
- Có thể kết hợp `--indexes`. Exit code 1 nếu schema không hợp lệ, audit bị bỏ qua, có bất thường hoặc truy vấn lỗi.

Kết quả chỉ gồm tên kiểm tra và COUNT dưới dạng chuỗi số thập phân chính xác. Một SELECT UNION ALL giữ cùng snapshot đọc của statement đối với InnoDB, không khóa ghi chủ động. Không chạy song song migration. Không xuất ID, thông tin thanh toán, email hoặc document. Không sửa dữ liệu.

## Phạm vi

Kiểm tra quyền/template của entitlement và order; owner của asset refs, publication và checkout context; khóa thanh toán cũ và theo scope; trạng thái credit và thiệp; repurchase cùng chủ/mẫu và sandbox; bằng chứng receipt theo policy hiện có; chủ yêu cầu hoàn tiền. LEFT JOIN giúp nhận ra tham chiếu thiếu trong các quan hệ được kiểm tra.

Không coi entitlement lịch sử không có credit là lỗi; không coi receipt của đơn đã hoàn tiền là lỗi chỉ vì trạng thái order. Không kết luận mọi quyền active đều hợp lệ, không kiểm toàn bộ FK, ledger, hash JSON, storage hoặc trạng thái provider. Không xác minh restore, không đo hiệu năng, không tự sửa bất thường.

## Nghiệm thu

- `npm run test:database` và `npm run db:audit`.
- `npm run test:canvas:mysql` chỉ trên fixture MySQL QA trống, loopback và được cô lập theo guard hiện có. Ca bổ sung tạo sai owner và sai amount trong transaction rồi rollback, so sánh count trước/sau. Ca cạnh tranh Canvas/Legacy dùng chung MySqlClient để kiểm tra một lượt Premium không bị tiêu hao hai lần.
- Trước production: kiểm thử backup/restore trên schema tách biệt, đánh giá EXPLAIN và tải, kiểm tra tranh chấp shared pool. Không đưa dump production vào Git hoặc release.
