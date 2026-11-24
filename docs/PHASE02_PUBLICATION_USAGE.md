# Phase 2.4A — Đối soát lượt xuất bản

## Phạm vi

- `GET /api/checkout/licenses/:templateId/publications`: yêu cầu session, dùng ID chủ thiệp từ session, không trả tên, nội dung, slug hay mã nhận. MySQL đọc `gifts` theo chủ thiệp và mẫu; JSON trả 503 vì không có một nguồn đếm tập trung.
- `basis=existing_gifts`, `sources.legacy`, `sources.template`, `total`, `quotaEnforced=false`. Không có `remaining` vì chưa có ledger tiêu hao. Mẫu không có bản ghi trả 0; thiệp Canvas trống không thuộc mẫu.
- Thiệp hết hạn/thu hồi vẫn được đếm nếu bản ghi còn tồn tại. Một thiệp nhiều khách hoặc nhiều lượt mở vẫn là một bản ghi; retry cùng idempotency key không tăng số lượng.
- Không thể suy ra giá khi mua hay số lượt đã trả tiền từ giá hiện tại. Không dùng kết quả để tự động khóa quyền cũ, thu tiền hoặc quyết định hoàn tiền.
- Checkout MySQL chỉ trả lại intent từ khóa cũ nếu `orders.is_test` khớp với yêu cầu hiện tại. Khác môi trường hoặc thiếu mode trả 409, không trả QR/URL, không xóa khóa. Chưa hỗ trợ tạo khóa mới song song sandbox/live; cần đối soát và thiết kế migration riêng.

## Kiểm thử và triển khai

- `node --test tests/unit/phase02-publication-usage.test.mjs`
- `npm run check`, `npm test`, `npm run test:architecture`, `npm run test:canvas:browser`.
- CI kiểm tra MySQL bằng `npm run test:canvas:mysql` trên schema QA trống; không dùng database production.
- Không cần migration, đổi biến môi trường hay upload frontend cho riêng bản này. Không thêm service. Kiểm tra CI và deployment Railway trước khi chuyển phase.

## Bước kế tiếp

Thiết kế khóa thanh toán tách theo môi trường, hợp đồng cấp/tiêu hao lượt theo giao dịch và ràng buộc xuất bản cùng transaction. Chốt cách giữ quyền đã bán, phân biệt một sự kiện và một lượt chúc mừng, cùng chính sách hoàn tiền trước khi bật hạn mức.
