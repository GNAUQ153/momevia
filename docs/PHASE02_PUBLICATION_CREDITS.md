# Phase 2.4B3 – Credit xuất bản thử nghiệm trên MySQL

Migration 018 chỉ thêm bảng `publication_credits`, không backfill, không thay đổi quyền cũ. Khóa chính `entitlement_id` bảo đảm một credit trên mỗi entitlement (mỗi đơn có một entitlement). `gift_id` duy nhất, giữ tham chiếu thiệp và thời điểm tiêu hao. Không tự hoàn lượt khi thu hồi/hết hạn.

## Phạm vi

- Mặc định `PUBLICATION_QUOTA_QA_ENABLED=false`. Production, Railway, JSON và checkout Live không được bật chế độ này.
- Chỉ dùng một database QA hoàn toàn tách biệt (`MYSQL_HOST=127.0.0.1`, `MYSQL_DATABASE=momevia_canvas_qa_<tên>`, `CANVAS_QA_MYSQL_ISOLATED=true`, `NODE_ENV=test` hoặc `development`, `PAYMENT_ENV=sandbox`, `PAYMENT_LIVE_ENABLED=false`, năm storage identity/catalog/checkout/gifts/designs đều MySQL). Không dùng tunnel, bản sao chứa thông tin khách hàng hoặc `.env` production. Guard cấu hình không thể tự chứng minh đích của tunnel.
- Chạy migration 017, 018 trên QA trước khi bật. App xác minh migration 018 và bảng trước khi phục vụ. Giữ nguyên cờ trong toàn bộ vòng đời schema QA; không trộn tiến trình cũ/tắt cờ với tiến trình đã bật. Dùng fixture `npm run test:canvas:mysql` trên schema QA rỗng để kiểm thử thay vì thao tác trên database thật.
- Chỉ quyền mới cấp từ Sandbox đã xác nhận hoặc mua demo MySQL khi bật cờ mới được cấp credit. Quyền active cũ không có dòng credit vẫn theo chính sách cũ; nếu một chủ/mẫu có quyền lịch sử hợp lệ, không tiêu hao credit mới. Không suy diễn quyền từ lượt xuất bản cũ.
- Chỉ mẫu giá dương tiêu hao. Cả Canvas và Legacy khóa chủ tài khoản, mẫu và quyền trước khi ghi, sau đó cập nhật credit cùng transaction ghi gift. Canvas replay được xử lý trước kiểm tra quyền; Legacy dùng cơ chế replay theo ID/hash của GiftService hiện có. Nếu lỗi ghi, rollback cả gift và credit. Thu hồi entitlement làm credit không còn được tính là active.
- API publications giữ thống kê thiệp cũ và bổ sung `quota` chỉ khi bật QA. `remaining`/`consumed` tính trên quyền active, không phải báo cáo tài chính toàn thời gian; `legacyUnlimited` báo quyền lịch sử. Trường cũ `quotaEnforced` vẫn false vì thống kê existing_gifts không phải ledger quota.

## Chưa triển khai

Chưa hỗ trợ mua thêm lượt trong cùng scope, release khóa đơn cũ, chính sách hoàn tiền và đối soát quyền lịch sử, hoặc GUI hạn mức. Hết lượt trong QA có thể bị chặn mua lại bởi khóa checkout hiện có. Không bật trên production trước khi hoàn thiện các phần này, không áp dụng migration production ở bước thử nghiệm. Không bổ sung dịch vụ Railway. Không sử dụng API nhà cung cấp thật để test; fixture gọi repository bằng sự kiện tổng hợp.
