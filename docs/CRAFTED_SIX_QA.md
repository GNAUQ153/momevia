# Rà soát vật thể, chuyển động và điện thoại — 28/11/2026

## Kết quả thiết kế

| Mẫu | Vật thể / nhận xét | Thay đổi có thể chỉnh trong Canvas |
|---|---|---|
| Secret Santa (`secret-santa-invitation`) | Hai bản hộp ghép khối/ảnh thử không đạt chất liệu. | `lid-source-v6`: dùng trọn bộ **Gift Box Opening** của Goodeisgn, gồm thân/nắp/nơ và timeline. Giữ vector, không ghép nơ ảnh vào thân vẽ. Đổi màu thân, ruy băng, giấy; chữ thiệp riêng; nhịp mở và độ nổi khối `objectDepth` 0–16. Nổi khối là bóng mép 2.5D nhẹ, không phải mô hình WebGL. |
| Graduation Mixtape (`graduation-mixtape`) | Camera chéo và khe ngang rời nhau; max-height làm các nút dịch khi in. | Kiểu `object-crafted-v4`: máy ảnh tức thì vector native có khe ngay trong thân. Ảnh cá nhân đi qua khe bằng transform/clip trong vùng cố định. Chỉnh màu chi tiết, ảnh/caption, tốc độ; giữ reply thật và đĩa chỉ quay khi nhạc chạy. |
| The Last Chapter V2 (`the-last-chapter-v2`) | Bằng biến mất đột ngột; tape/stamp chưa gắn vật liệu. | Bằng cuộn dùng artwork vải/giấy có sẵn, rời lên trong nhịp mở; giấy đọc có mép viền. Mũ bay theo cung rồi hạ xuống. Băng keo có mép xé, chữ vẫn thật. Dấu chấm in xuống giấy. Vé giữ cuống, tên có dấu và SVG dùng dữ liệu thiệp. |
| Graduation Countdown (`graduation-countdown`) | Lịch phẳng nhưng hợp chất liệu giấy. | Gáy và mép giấy lịch; sticker xoay quanh góc bóc. Không thay nguồn ngày/múi giờ; giữ thư gấp/album/zoom và nút mở thay thế. |
| Midnight Soirée (`midnight-soiree`) | Phong bì giấy/dấu sáp v3 đã cùng vật liệu. | Giữ preset tự nhiên v3, chữ dấu và lời mời riêng; kiểm mở/đọc/RSVP trên nền tối và thu gọn media. |
| Garden Tea (`garden-tea`) | Cửa đôi, hoa và trà đã có chủ ý, không cần biến thành hộp 3D. | Giữ các nhóm sửa được và 9 cảnh; kiểm cửa/thư/cào/album/RSVP, ảnh trống, nội dung dài và bề mặt đọc. |

## Các mục tái sử dụng

Trong Canvas tìm `drive-santa-gift-box`, `drive-camera-print`, `drive-calendar-peel`, `drive-ribbon-diploma`, `drive-cap-toss`, `drive-grade-stamp`, `drive-peel-letter`, `drive-tear-ticket`, `drive-four-choice-quiz`, `drive-focus-photo`, `drive-soiree-envelope`. Giữ nguyên ID thư viện. Các primitive cổ điển và reader v1–v4 không đổi mặc định; kiểu mới chỉ nằm trong tài liệu mới hoặc sau thao tác đổi kiểu rõ ràng.

`drive-pine-gift-tag` là nhóm 7 lớp native: thẻ có lỗ, bóng giấy, dây, thông/nón thông và quả đỏ, chữ riêng. Dùng đường nét CC0 của OlKu từ Openclipart 173819, tối ưu viền ở độ phân giải tọa độ Canvas để cả cụm vẫn nhân bản được trong giới hạn 256 KiB. Không tăng budget hoặc flatten thành ảnh. Lá và quả nằm ngoài vùng chữ; chỉ nhánh thông đung đưa, giấy/chữ giữ ổn định. Giữ group khi chèn và nhân bản, màu/chữ của bản sao độc lập. Đã gate Canvas trống rồi mới thay trên bìa Santa; các quà thử cũ giữ snapshot cụm cũ.

Kiểu vật thể crafted có bộ chọn trong Inspector cùng màu, tốc độ và góc bo của bề mặt. Hộp nguồn có riêng bộ chọn kiểu, chữ thiệp và độ nổi khối; 0 tắt độ nổi. Độ nổi khối và chuyển động nội tại là thuộc tính của component, không được báo là effect thư viện độc lập. Reaction R01/R02, transition và nút tắt chuyển động hiện hành vẫn dùng luồng chuẩn. Không thêm đường upload JSON animation tùy ý.

Nguồn hộp không có ảnh hay biểu thức; JSON gốc được giữ nguyên. Bìa tĩnh xuất từ cùng nguồn tại frame 0, bản giảm chuyển động ở frame 49, và cùng hàm ánh xạ màu. Lottie SVG light 5.13.0 đóng gói local, chỉ tải khi tương tác; không cần CDN lúc người nhận mở thiệp. Có fallback tĩnh nếu player không tải được. Player dừng/hủy khi rời cảnh/đóng preview và tránh mở hai lần khi chạm nhanh.

## Điểm dùng chung và hồi quy

- `natural-objects`, `drive-elements`, `drive-polish`: chọn default mới chỉ cho khối/mẫu đang tạo; không sửa nháp/snapshot cũ.
- Registry/schema/Inspector: thêm allowlist kiểu và `objectDepth`; ảnh sẵn có tiếp tục theo materialize/ownership/CAS. Camera native không có ảnh trang trí giả để người gửi thay nhầm; ảnh cá nhân vẫn là slot thật.
- Renderer/cover: cùng hình và bảng màu; giữ đường đọc hộp v4. CSS chỉ theo lớp source/crafted mới.
- Nhóm có neo và mặt giấy đọc dùng metadata opt-in có phiên bản. Khi phần trước nới chiều cao, cả nhóm đi cùng nhau; giấy và bóng nới theo chữ dài. Nhóm cũ không đánh dấu giữ nguyên quy tắc trước đây. Thẻ Santa đặt ở vùng trống phía trên/phải, tránh vùng mở hộp.
- Audit: đăng ký đúng một cạnh tới bản vendor đã kiểm, kiểm SHA-256 cả JSON gốc và module player. Không miễn trừ thêm cả thư mục.

Cozy Christmas, Club 22, Proud of You, Bản đồ ngày ra trường và các mẫu còn lại đi qua kiểm fit toàn bộ cảnh. Những quà cũ giữ snapshot; không ghi lại nội dung để đổi ngoại hình. Đầu lượt, repo gốc ở `33f53e3` với 157 WIP. Khi chốt, phát hiện thay đổi đồng thời tại repo gốc (`3856921`, merge PR #32 và WIP mới). Đợt này chỉ ghi vào bản làm việc cô lập dựa trên `062548e`, không nhập các thay đổi đồng thời đó; không tuyên bố repo gốc vẫn giống hash đầu lượt. Khả năng tích hợp với HEAD mới của repo gốc cần review riêng trước merge.

## Nguồn / quyền

- [Goodeisgn · Gift Box Opening](https://embed.lottiefiles.com/animation/107704): [Lottie Simple License](https://lottiefiles.com/page/license), cho phép dùng/sửa/phân phối cùng điều kiện. Notice và hash tại `web/assets/animations/`. Chỉ tích hợp một thành phần vào thiệp; không thu thập thành thư viện tải animation cạnh tranh. Các bản khung và theme phái sinh giữ cùng license.
- [Airbnb lottie-web](https://github.com/airbnb/lottie-web), phiên bản 5.13.0 SVG light, MIT: bản chính thức từ npm; notice đi cùng `web/js/vendor/LOTTIE_LICENSE.txt`.
- Phong bì, sáp, mũ/bằng là Momevia Originals có sẵn. Camera mới là vector native của Momevia, không còn ghép ảnh camera nghiêng với khe in rời.
- [OlKu · fir branch with cones](https://openclipart.org/detail/173819/fir-branch-with-cones), [CC0](https://openclipart.org/share): đường viền được chuẩn hóa về 100 đơn vị, tối ưu contour, gom theo màu và giữ màu thông chính sửa được. Metadata nguồn/hash và phép biến đổi tại `web/assets/animations/olku-fir-source.json`.
- Đã xem trực tiếp mẫu của Mahadi Hasan và Kosti Marko nhưng loại vì chỉ là icon trắng; không lấy asset hoặc chạy mã các demo đó. Bản v5 ghép ảnh đã bỏ, không đăng ký vào thư viện mới.

## Nghiệm thu / giới hạn

Gate Canvas trống chạy trước tạo mẫu: tìm/chèn, đổi chữ/màu/nhịp, nhân bản, lưu, tải lại, preview, quà thử. Các khối còn lại cũng được rà trực quan. Test `source-gift.mjs` kiểm timeline thật, hình học không nhảy, chạm đôi, copy riêng, tắt độ nổi, reduced motion và hủy player; test `gift-volume.mjs` giữ trường hợp v4 cũ.

Chạy build/check/unit/templates/Canvas browser và MySQL QA cô lập. VI/EN ở 320×568, 390×844, 1440×900, màn ngang 844×390, zoom chữ 200%, bàn phím/touch, thiếu media, quá hạn, quay lại và gửi lỗi/thử lại. Bằng chứng và kết quả thực chạy nằm trong `local/source-objects-20261128/REPORT.html`; không dùng kết quả lượt cũ để báo pass mã mới. Chưa xác minh Safari, thiết bị vật lý hoặc screen reader; không suy ra FPS trên điện thoại thật từ Chromium QA.

## Hoàn nguyên

Các QA trước vẫn chạy với source/data riêng. Có thể quay về QA 65059 mà không xóa dữ liệu. Nếu đã phát hành tài liệu kiểu mới ở môi trường khác, hoàn nguyên writer/thư viện theo revision/CAS nhưng giữ reader `lid-source-v6`/crafted và tài nguyên đã pin cho tới khi không còn snapshot cần phục vụ. Không xóa quà, nháp hay media để rollback ngoại hình. Chỉ push source review; video/QA local, không merge/deploy.
