# Phạm vi sản phẩm — Đối chiếu 4 tài liệu

## Những quyết định nhất quán cho MVP

- Vấn đề cốt lõi: tạo trải nghiệm trao gửi cảm xúc hai chiều cho những người ở xa.
- Đối tượng ưu tiên: người trẻ gửi quà sinh nhật, người nhận mở quà không cần đăng nhập.
- Sản phẩm chính: **quà tương tác qua link**, thay vì chỉ tải PNG/PDF.
- Marketplace: 12 mẫu minh họa có sẵn; Creator tạo mẫu theo cấu trúc chuẩn hóa, có duyệt.
- Luồng Sender: Blank/mẫu → draft → lưu/mở lại/chỉnh → preview → server preflight/quyền mẫu/checkout nếu cần → publish snapshot → link/QR → recipient miễn phí không đăng nhập.
- Giữ giá quyền mẫu v1.1; chưa thu phí theo cảnh/element/lần phát hành. Payment foundation payOS/MoMo mặc định tắt; provider inject QA không chứng minh merchant live.
- Không dùng gói subscription Creator Pro/người gửi trong MVP.
- Mỗi tài khoản có một role; chỉ quản trị viên được thay đổi role. Không có luồng tự nâng Sender thành Creator. Quản lý role hiện qua API Admin, chưa có màn hình quản lý tài khoản.

## Các điểm chưa chốt

- Chính sách bản quyền và giấy phép mua mẫu lại nhiều lần.
- Giá thực có bao gồm thời gian lưu link và dung lượng media như thế nào.
- Chính sách lưu kỷ niệm sau khi hết hạn (mặc định bản demo 365 ngày).
- Nhà cung cấp thanh toán, merchant of record, payout, hoàn tiền và điều kiện pháp lý.
- Công cụ thiết kế nâng cao bao gồm code sandbox, thư viện element, animation tùy chỉnh.
- Loại mẫu cá nhân riêng tư cho Customer, TTL theo từng mẫu và giấy phép theo lượt phát hành là định hướng cần đặc tả; chưa được triển khai. Không đồng nhất mẫu giá 0đ với mẫu riêng tư và không tự thay đổi quyền/thời hạn của dữ liệu cũ.

## Phân kỳ đề xuất

| Giai đoạn | Phạm vi |
| --- | --- |
| Sender canvas hiện tại | DOM editor, schema/registry version 1, draft CAS, ảnh private, preview, immutable publish, link/QR, reply; JSON một process và MySQL 8.4 cô lập đã kiểm thử |
| Giai đoạn kế | W12–W15: media/animation nâng cao, Creator version/review, thư viện mẫu cá nhân có version/community, sandbox; có đặc tả riêng trước khi mở |
| Mở rộng | Nhiều gói creator/member, analytics sâu, media, công cụ code sandbox an toàn, orchestration thanh toán/chi trả |

Các mã 80 chức năng trong PDF gốc là backlog toàn bộ hệ thống, không phải tất cả đã được lập trình ở MVP.

Ba cảnh là preset legacy; schema có budget kỹ thuật 32 cảnh/400 node/256 KiB, không là phân hạng giá. Stack vẫn ES modules/HTML/CSS và modular monolith async; MySQL 8.4 là adapter SQL hiện hành, JSON mặc định. Xem [hướng dẫn canvas](CANVAS_SENDER_GUIDE.md) và [gate matrix](CANVAS_QA_REPORT.md) để phân biệt source, cấu hình và bằng chứng đã chạy.
