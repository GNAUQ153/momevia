# Phase 2.1B — Thông tin sự kiện của thiệp mời

## Phạm vi và quyết định tương thích

- Thí điểm với mẫu hệ thống `loi-moi-ben-hien` (Lời mời bên hiên), gồm nháp có vùng ngày và địa điểm tương ứng. Mẫu Greeting, mẫu Creator, thiệp legacy không bị ép chuyển đổi.
- Người gửi chủ động bật «Dùng thông tin sự kiện có cấu trúc» trong Editor. Không tự phân tích/ngầm đổi ngày hoặc nội dung văn bản đã lưu; cần nhập lại thời điểm. Tắt tùy chọn giữ lại văn bản trên Canvas, chỉ bỏ dữ liệu có cấu trúc.
- `document.invitation` gồm `dateElementId`, `venueElementId`, `eventAt` (ISO UTC tới phút, hoặc null ở nháp), `timeZone` (IANA). Địa điểm là văn bản của vùng Canvas liên kết, không tạo bản sao dễ lệch. Khi nhập ngày, vùng văn bản ngày được đồng bộ thành `YYYY-MM-DD HH:mm (IANA zone)`; đổi múi giờ giữ nguyên instant. Giờ DST không tồn tại bị từ chối; giờ lặp dùng lần xuất hiện đầu tiên như cơ chế đồng hồ Canvas sẵn có.
- Vùng ngày/địa điểm phải là text riêng biệt. Khi xuất bản chế độ có cấu trúc, yêu cầu cả hai vùng hiển thị, thời gian và địa điểm hợp lệ (tối đa 300 ký tự), ngày hiển thị khớp thời điểm, sự kiện tương lai và trước lúc link hết hạn theo TTL hiện có. Không áp quy tắc thời gian hiện tại lên snapshot đã xuất bản. Không cho phép tự gắn metadata vào mẫu Greeting/Creator ở API lưu nháp.
- Vẫn dùng CAS, hash, transaction và idempotency của Design/Publication. Bản sao nháp remap ID. Tặng lại xóa dữ liệu sự kiện; nếu bố cục tặng lại đã đổi ID mà không còn semantic slot map, bộ nhập có cấu trúc không hiển thị ở bản này. Không tự sửa dữ liệu thiệp đã phát hành.
- Snapshot lưu đủ metadata. API GET thiệp sau kiểm tra quyền trả `invitation: {eventAt,timeZone,venue}` khi có; `documentSnapshot` public bỏ trường metadata mới để renderer cũ đọc được văn bản. Không cung cấp thông tin sự kiện qua API danh mục hoặc trước quyền mở thiệp.
- Không đổi schema SQL, giá, thanh toán, quyền Free/Premium hoặc dependency. Dữ liệu nằm trong document/payload JSON sẵn có.

## Chạy và nghiệm thu

```bash
node --test tests/unit/phase02-invitation.test.mjs
npm run build
npm run check
npm test
npm run test:canvas:browser
```

Chạy profile demo độc lập (không dùng MySQL production). Chọn mẫu Lời mời bên hiên, bật tùy chọn, nhập ngày giờ tương lai trong TTL, múi giờ, địa điểm. Lưu, F5, preview, đổi VI/EN, đổi múi giờ, nhân bản, tắt/bật lại. Kiểm tra ngày/địa điểm trên Canvas và API đọc thiệp. Thử ngày quá hạn và ngày đã qua; xác minh preflight chặn. Kiểm tra thiệp đã phát hành trước patch vẫn mở được.

## Triển khai

Backend và frontend cần cùng phiên bản để chỉnh sửa nháp có metadata. Triển khai backend mới trước, xác minh CI/CD, sau đó build/gói và cập nhật frontend Hostinger trước khi cho phép người dùng tạo nháp có metadata mới. Viewer cũ có thể đọc public projection; **không khẳng định Editor/backend phiên bản cũ có thể mở/lưu nháp mới**. Nếu rollback sau khi đã có dữ liệu mới, không tự xóa metadata; giữ phiên bản đọc hỗ trợ trường mới hoặc lập kế hoạch phục hồi tương thích với backup. Không chạy migration.

## Chưa hoàn thiện

RSVP, loại thiệp ở cấp nháp trống và Creator, bắt buộc metadata cho mọi lượt thiệp mời, lịch trình nhiều mục, sự kiện online có URL riêng, kiểm soát số lượt mua, chi tiết vòng đời, xuất lịch ICS. Đây là bước opt-in có chủ đích, không phải hoàn thành toàn bộ M06/M11. MySQL live, trình duyệt và full regression phải được xác minh trên môi trường đầy đủ dependency trước khi deploy.
