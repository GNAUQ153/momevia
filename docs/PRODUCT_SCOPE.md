# Phạm vi sản phẩm — Đối chiếu 4 tài liệu

## Những quyết định nhất quán cho MVP

- Vấn đề cốt lõi: tạo trải nghiệm trao gửi cảm xúc hai chiều cho những người ở xa.
- Đối tượng ưu tiên: người trẻ gửi quà sinh nhật, người nhận mở quà không cần đăng nhập.
- Sản phẩm chính: **quà tương tác qua link**, thay vì chỉ tải PNG/PDF.
- Marketplace: 12 mẫu minh họa có sẵn; Creator tạo mẫu theo cấu trúc chuẩn hóa, có duyệt.
- Luồng: Chọn mẫu → Cá nhân hóa → Mua demo nếu cần → Xuất bản → Mở quà 3 cảnh → Gửi lời đáp → Xem lại.
- Mức giá thử: 0/39.000/59.000/79.000 VND, commission giả định 20%; không có thanh toán thật.
- Không dùng gói subscription Creator Pro/người gửi trong MVP.

## Các điểm chưa chốt

- Chính sách bản quyền và giấy phép mua mẫu lại nhiều lần.
- Giá thực có bao gồm thời gian lưu link và dung lượng media như thế nào.
- Chính sách lưu kỷ niệm sau khi hết hạn (mặc định bản demo 365 ngày).
- Nhà cung cấp thanh toán, merchant of record, payout, hoàn tiền và điều kiện pháp lý.
- Công cụ thiết kế nâng cao bao gồm code sandbox, thư viện element, animation tùy chỉnh.

## Phân kỳ đề xuất

| Giai đoạn | Phạm vi |
| --- | --- |
| MVP hiện tại | Các chức năng sender/recipient/creator/admin căn bản, demo checkout, 3 cảnh và reply |
| Giai đoạn kế | Visual editor kéo thả, schema template JSON versioned, PostgreSQL riêng cho dịch vụ, thanh toán thật |
| Mở rộng | Nhiều gói creator/member, analytics sâu, media, công cụ code sandbox an toàn, orchestration thanh toán/chi trả |

Các mã 80 chức năng trong PDF gốc là backlog toàn bộ hệ thống, không phải tất cả đã được lập trình ở MVP.
