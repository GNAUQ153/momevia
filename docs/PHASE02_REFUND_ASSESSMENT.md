# Phase 2.7A — Rà soát yêu cầu hoàn tiền

## Phạm vi

- Giữ quy trình hồ sơ `submitted → in_review → awaiting_provider` và `closed_declined` hiện tại. Đây là rà soát nội bộ, không phải xác nhận hoàn tiền.
- Tạo hồ sơ mới chỉ cho chủ đơn `paid` có biên nhận và intent nhất quán theo `verifiedReceiptSql`. Nếu không khớp, liên hệ hỗ trợ để đối soát; không tự sửa đơn. Hồ sơ đã tạo vẫn đọc được.
- API danh sách/hàng đợi Admin bổ sung `assessment` gồm `receipt`, `entitlement`, `credit`, `creatorSaleEntries`, `creatorRefundEntries`. Dữ liệu chỉ đọc, không phải kết luận đủ điều kiện hoàn tiền; không gửi cho Buyer. Không đưa reference, gift ID hoặc webhook vào response.
- Khi chưa có migration 018, `credit=unavailable` (không phải 0 lượt). Khi có migration, `not_recorded` không đồng nghĩa chưa sử dụng mẫu; quyền lịch sử có thể không có dòng credit. `unused` chỉ mô tả dòng credit, không bảo đảm quyền đang hiệu lực. Số bút toán Creator không chứng minh provider đã hoàn tiền.
- Không thay đổi giá, dữ liệu lịch sử, Creator ledger, entitlement, credit, chính sách Live hoặc quota. Không migration, không dependency mới, không gọi API hoàn tiền provider.

## Kiểm thử

`node --test tests/unit/refund-review.test.mjs tests/unit/refund-queue.test.mjs tests/unit/phase02-refund-assessment.test.mjs`

`npm run build`, `npm run check`, `npm test`, `npm run test:browser`, `npm run test:canvas:browser`.

`npm run test:canvas:mysql` chỉ trên DB QA độc lập: xác minh receipt sai lệch bị từ chối, hồ sơ trước migration 018 vẫn đọc được, credit đổi từ unused sang consumed, Buyer không nhận assessment. Không chạy fixture trên DB production.

## Triển khai

Giữ các feature flag QA hiện tại. Backend trước, frontend sau để hiển thị phần đối soát Admin; frontend cũ bỏ qua trường bổ sung, frontend mới bỏ qua nếu backend chưa trả assessment. Không chạy migration chỉ vì patch này. Kiểm tra CI và nghiệm thu môi trường QA trước khi triển khai. Chưa có thao tác hoàn tiền thật, giải phóng khóa checkout hoặc bút toán đảo; cần quy trình xác nhận provider, chống lặp và điều khoản hoàn tiền riêng.
