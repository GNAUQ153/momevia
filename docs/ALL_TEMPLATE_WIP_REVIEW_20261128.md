# Rà thư viện và chốt WIP ngày 28/11/2026

Baseline repo gốc: `3856921d07bdbb6599e5a05bbacba7f166019408`, nhánh `feat/garden-tea-local-20261127`, 179 đường dẫn WIP (147 tracked, 32 untracked), không có staged. Backup patch, bản sao untracked và SHA-256 từng file được giữ ở local. Kiểm trên clone cô lập trước khi chép đúng sửa đã kiểm về repo gốc. Hai worktree khác sạch; nhánh cải thiện sáu mẫu ở `dcd564e` được giữ riêng.

## Phạm vi thực tế

Repo gốc có 45 mẫu, gồm 16 mẫu mới từ main. Clone sáu mẫu có 34 mẫu. Hai phiên bản có 50 ID khác nhau khi lấy hợp; không dùng số lượng hoặc source cũ của clone để thay thư viện gốc. Đợt này chốt WIP gốc, không merge hoặc rewrite nhánh review đã push, không thay giá/quyền/owner/source, migrate hay deploy.

## Phát hiện và sửa

- Fixture thư viện còn đếm 44 mẫu, mặc định mọi draft là manual và chưa điền sự kiện Garden Tea. Thêm Garden Tea vào vòng 45 mẫu, kiểm cùng tập ID, self receipt, ngày/địa điểm và public invitation projection; giữ kiểm paid/free, media ACL, source, CAS và snapshot. Log dùng số lượng đã quan sát.
- Viewer WIP vẫn cho cuộn trong thân. Trước sửa: 1.002 lượt cảnh, 450 lượt có cuộn thân; wrapper preview vượt màn hình. Đưa riêng helper fit/layout/đọc từng phần từ nhánh sáu mẫu vào component chung, giữ factory/ID của cả 45 mẫu. Sau sửa: 1.002 lượt không tràn ngang, không cuộn thân/trang; authored document giữ nguyên. Chữ dài đọc từng phần, form/widget giữ một node sống. Mặt giấy tăng theo chữ; không sửa dữ liệu đã lưu.
- Nút Studio EN tại 430 px cao 65,53 px do basis 175 px cũ cùng thang chữ mới. Cho basis theo nội dung ở 391–700 px; giữ cột ≤390 px và phép kiểm chiều cao hiện có. UI regression đạt.

## Kết quả đã quan sát

| Phần | Kết quả |
|---|---|
| Build / check | Đạt; kiểm lại CSS sau sửa Studio |
| Unit | 1.393 đạt, 0 lỗi |
| Thư viện API | 45 mẫu create/save/reload; free publish và paid-license gate; 45 SVG; bootstrap thư viện đã có; initializer CAS/lost ACK |
| Canvas browser | Bộ đầy đủ đạt, gồm reader cũ, UI cards/effects, touch/bàn phím, save/send/nhận, locale, retry và mẫu Canvas tương lai |
| Từng cảnh repo gốc | 1.002 lượt = 167 cảnh × VI/EN × 320×568, 390×844, 1440×900; không JS error/tràn ngang/cuộn thân/trang |
| Bản sáu mẫu riêng | 888 lượt cảnh trên đúng source QA của nhánh review; không JS error/tràn/cuộn |
| Bàn phím từng mẫu | 45 mẫu, 258 điều khiển thực có đổi trạng thái/đến cảnh đích; authored document giữ nguyên |
| Garden Tea MySQL | Docker QA: media, self receipt, publish replay, hai lượt nhận, RSVP/party size/note, spoofing/validation, quá hạn và snapshot đạt |
| UI regression | A1–A6 đạt; trường hợp payment/context được mô phỏng, login local thật |

Ảnh bìa, ảnh cover/content desktop/mobile, contact sheet và số đo từng cảnh nằm trong báo cáo local `local/full-wip-review-20261128/REPORT.html`. Artwork đóng gói được nạp thật; ảnh cá nhân tùy chọn để trống. Phép fit riêng bổ sung mẫu tự tạo dọc/ngang và nội dung dài qua từng phần; có kiểm giảm chuyển động và cleanup trong Canvas suite.

## Từng mẫu trong repo gốc

Cột khung bao gồm VI/EN và ba viewport. Cột cuối đếm thao tác bàn phím có phản hồi/điều hướng, không đếm đồng hồ/ảnh trống không có nút. Map/ICS được kiểm bằng test dữ liệu sự kiện; các cơ chế lưu/phân quyền được kiểm riêng qua API/MySQL.

| ID | Cảnh | Khung | Điều khiển |
|---|---:|---|---:|
| garden-tea | 9 | Đạt | 20 |
| loi-moi-ben-hien | 5 | Đạt | 7 |
| cuon-phim-ngay-ay | 4 | Đạt | 6 |
| ban-do-ngay-ra-truong | 5 | Đạt | 6 |
| midnight-bloom | 3 | Đạt | 4 |
| sunny-wishes | 3 | Đạt | 4 |
| love-letter | 3 | Đạt | 4 |
| starlight | 3 | Đạt | 4 |
| peachy-day | 3 | Đạt | 4 |
| greenhouse | 3 | Đạt | 4 |
| confetti | 3 | Đạt | 4 |
| cloud-nine | 3 | Đạt | 4 |
| lavender | 3 | Đạt | 4 |
| polaroid | 3 | Đạt | 4 |
| afterglow | 3 | Đạt | 4 |
| tiny-celebration | 3 | Đạt | 4 |
| mot-ky-niem | 3 | Đạt | 4 |
| hai-phong-bi | 6 | Đạt | 12 |
| to-doan-cau-se-chon | 1 | Đạt | 1 |
| winter-wishes-2026 | 3 | Đạt | 4 |
| new-year-spark-2027 | 3 | Đạt | 4 |
| spring-blessing-2027 | 3 | Đạt | 4 |
| velvet-valentine-2027 | 3 | Đạt | 4 |
| birthday-radiance | 5 | Đạt | 8 |
| thank-you-bloom | 3 | Đạt | 4 |
| proud-of-you | 5 | Đạt | 7 |
| faraway-hug | 3 | Đạt | 4 |
| gentle-apology | 3 | Đạt | 4 |
| calm-light | 3 | Đạt | 4 |
| snowglobe-countdown | 4 | Đạt | 7 |
| gift-box-carol | 4 | Đạt | 7 |
| north-star-dinner | 4 | Đạt | 6 |
| winter-postbox | 4 | Đạt | 7 |
| tassel-lift | 4 | Đạt | 6 |
| yearbook-tribute | 4 | Đạt | 7 |
| coffee-catchup | 4 | Đạt | 7 |
| night-market-reunion | 4 | Đạt | 6 |
| candle-wish-box | 4 | Đạt | 7 |
| balloon-quest | 4 | Đạt | 7 |
| surprise-cake | 4 | Đạt | 7 |
| starlight-memory | 4 | Đạt | 7 |
| sealed-garden | 4 | Đạt | 6 |
| polaroid-love | 4 | Đạt | 7 |
| moonlit-promise | 4 | Đạt | 7 |
| golden-blossom | 4 | Đạt | 6 |

## Chia commit và bảo toàn

Bốn nhóm: UI token/bo góc/vùng nút; Garden Tea + Canvas/RSVP/fit cùng kiểm thử; SVG bìa VI/EN sinh từ source; hướng dẫn và báo cáo. Các phần schema/registry/renderer/runtime/locale có phụ thuộc đan xen được giữ cùng nhóm chức năng. Mọi commit sản phẩm có changelog. Chỉ append lịch sử, không reset/clean/stash hoặc dùng git add toàn repo. Trước từng commit đối chiếu hash toàn bộ file đã duyệt, kiểm staged và chặn video/data/local/secret.

Video, JSON QA, báo cáo ảnh và backup chỉ local. Có thể hoàn nguyên commit mới theo thứ tự ngược; nếu đã có tài liệu dùng capability mới thì giữ reader/schema và chỉ tắt factory/thư viện theo revision. Không xóa quà/nháp để hoàn nguyên ngoại hình.

## Giới hạn

Đã xem bìa/contact sheet và cảnh trên Chromium; đây là rà soát chức năng/bố cục, không phải chứng nhận toàn bộ WCAG hay thiết kế lại mỹ thuật 45 mẫu. Mẫu Classic giữ hướng màu dịu, mẫu lễ hội giữ minh họa riêng. Chưa xác minh Safari, thiết bị vật lý, screen reader, FPS thực, mọi nhánh tương tác phụ và live payment/storage production. Luồng người gửi/nhận/chủ riêng của sáu mẫu giữ ở báo cáo QA trước; lần này rà lại toàn thư viện renderer và sửa WIP chung.
