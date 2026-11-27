# Sáu mẫu Drive — local QA

Phạm vi được triển khai trong bản làm việc độc lập. Garden Tea giữ ID cũ; năm ID còn lại độc lập với Cozy Christmas, Club 22 và các mẫu tốt nghiệp cũ. Giá 0 của năm mẫu mới là fixture QA, chưa phải quyết định giá phát hành.

| Mẫu | ID | Cảnh | Hồi đáp |
|---|---|---:|---|
| Garden Tea | `garden-tea` | 9 | RSVP theo lượt nhận |
| Secret Santa | `secret-santa-invitation` | 9 | RSVP theo lượt nhận |
| Midnight Soirée | `midnight-soiree` | 9 | RSVP theo lượt nhận |
| Graduation Countdown | `graduation-countdown` | 8 | RSVP theo lượt nhận |
| Graduation Mixtape | `graduation-mixtape` | 9 | Lưu bút thật; gấp sau xác nhận |
| The Last Chapter V2 | `the-last-chapter-v2` | 10 | RSVP theo lượt nhận |

## Đối chiếu nhóm thiệp mời

Áp dụng đủ cho Garden Tea, Secret Santa và Midnight Soirée:

| Mục HTML Drive | Cảnh Canvas | Gộp/điều kiện |
|---|---|---|
| Mở cửa/hộp/phong bì | `scene-cover` | Cửa đôi / nắp hộp / dấu sáp riêng |
| Hero | `scene-invitation` | Tên, lời mời và ảnh sửa được |
| Message | `scene-message` | Binding lời nhắn thật |
| Details | `scene-details` | Ngày giờ, địa điểm, bản đồ, tải lịch |
| Countdown | `scene-details` | Cùng nguồn `invitation`, gộp với chi tiết |
| Timeline | `scene-programme` | Bốn mốc là các layer chữ sửa độc lập |
| Dress | `scene-dress` | Chữ và bảng màu chỉnh được |
| Secret | `scene-secret` | Vé cào; có nút hiện ngay |
| Media | `scene-message` | Nút âm thanh tùy chọn dùng tệp thật; không có tệp thì thu gọn |
| RSVP | `scene-reply` | Một form trong Canvas; lưu đúng receipt |
| Outro / replay | `scene-outro` | Lời kết và mở lại |

Video WebM đã có trong bản local JSON với flag chủ động, asset sở hữu và quyền đọc theo quà; không đưa tệp lên Git, MySQL hoặc production. Thiếu tệp thì khối thu gọn. Xem [Video local và biến thể mềm](LOCAL_VIDEO_QA.md) để biết giới hạn và kiểm thử; trạng thái video chưa hoàn thành trong báo cáo v1 là trạng thái lịch sử trước đợt này.

## Dùng trong Canvas

Tìm nhóm Thiệp Drive bằng tên VI/EN hoặc ID `drive-*`. Có 13 mục mới. Khối Lời hồi đáp có bộ chọn kiểu thường/gấp sau gửi; khối Garden RSVP có bộ chọn vườn trà/giấy thư. Các kiểu mặc định cũ giữ nguyên khi không chọn biến thể.

Lịch và vé chèn riêng có trường ngày/múi giờ. Trong thiệp, chúng cùng countdown và ICS đọc metadata `invitation`. RSVP cần nguồn thiệp mời và hai slot sự kiện hợp lệ; không mở quyền thêm metadata sự kiện cho nguồn blank không được hỗ trợ.

Ảnh máy ảnh/ống kính thay ngay ở Inspector. Album dùng các slot ảnh sẵn có, bỏ ô trống và mở lớn bằng lựa chọn zoom. Đóng ảnh lớn bằng Escape trả focus về nút mở. Bóc/cào/kéo/vuốt đều có đường chạm hoặc bàn phím.

## Cập nhật thư viện đã có dữ liệu

`src/modules/designs/drive-library-rollout.mjs` chỉ cho phép 19 khóa: 13 element mới và sáu template thuộc phạm vi. `buildDriveLibraryRollout(reviewedExport, builtinItems)` tạo bundle từ bản xuất đã được rà soát; không tự coi dòng Admin hiện tại là baseline mới.

`planDriveLibraryRollout` kiểm fingerprint/revision và toàn bộ thư viện bằng validator chung. `applyDriveLibraryRollout` ghi qua `CanvasLibraryService.put`, đọc lại trước từng ghi, dùng CAS và lưu history. Chạy lại không thêm bản sao. Xung đột phải đọc/rà soát lại; không tự ghi đè Admin. Bootstrap thư viện đã có dữ liệu không tự thay các mẫu này.

Hoàn nguyên dữ liệu: trước hết ẩn năm ID mới khỏi Catalog bằng quy trình quản lý hiện hành; sau đó dùng cùng bundle với `{ rollback: true }`. Garden được phục hồi definition trước, các mục mới chuyển disabled bằng revision mới. Không xóa draft, gift snapshot hoặc asset đã được sở hữu. Kiểm lại Catalog, thư viện, nháp và link đã gửi; ngoài 19 khóa giữ nguyên.

## Kiểm thử và bằng chứng

- `npm run build`, `npm run check`, `npm test`, `npm run test:templates`, `npm run test:canvas:browser`.
- MySQL cô lập: `node tests/integration/drive-six-mysql.mjs --reviewed=<bản-xuất-thư-viện-đã-rà-soát.json>`. Bài thử tạo container/schema riêng, kiểm fresh/existing/Admin/CAS/rollback, đóng RSVP theo thời điểm, nháp và snapshot; tự dọn container khi xong.
- Bằng chứng local, đường mở, bảng khoanh vùng và các runner nằm ở `local/drive-six-20261127/`. Báo cáo nghiệm thu ghi riêng source, thư viện thử, hành trình thực và phần chưa xác minh.
- Đối chứng Cozy Christmas, Club 22, Proud of You, Bản đồ ngày ra trường và Một kỷ niệm dùng cùng document/ảnh trước-sau. Snapshot QA xuất từ tài liệu baseline không được gọi là quà production thật.

Native browser zoom, thiết bị vật lý và Safari không được suy ra từ thử Chromium. Ghi đúng phương pháp zoom: page scale/text 200% và viewport CSS 720×450 với DPR 2 tương đương ảnh 1440×900.

## English

The six cards are editable Canvas documents, not embedded Drive HTML. Five independent IDs are added and Garden Tea keeps its existing ID. The invitation module mapping above also applies to the English documents. Empty optional audio collapses; personal images remain editable. WebM video is now supported in explicitly enabled local JSON QA with owned assets and gift permissions; files remain outside Git, MySQL and production. See LOCAL_VIDEO_QA.md.

Canvas offers 13 reusable additions, an optional paper RSVP surface and a folded-reply style. A reply folds only after the real server confirms; failures retain its text. Preview responses are simulated. All event views use one invitation date/time/zone. Explicit Canvas response blocks prevent duplicate Gifts-level forms; legacy reply defaults remain unchanged.

The scoped library bundle updates only the reviewed 19 keys through fingerprint/revision checks and the existing transactional API. Hide the five new Catalog choices before rollback. Restore Garden and disable new rows without deleting saved drafts, published snapshots or their media. No push, merge, deployment or serving database write is included in this work.
