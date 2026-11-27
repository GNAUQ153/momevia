# Video local và các biến thể mềm

## Phạm vi

Video chỉ bật khi `LOCAL_VIDEO_QA_ENABLED=true`, storage Designs/Gifts đều là JSON và không ở `NODE_ENV=production`. Endpoint upload và đọc video còn kiểm client loopback. Mặc định tính năng tắt. Không thêm cột/migration MySQL cho video và không chuyển tệp lên dịch vụ ngoài.

Canvas có mục **Video** trong thư viện khi API local báo có khả năng này. Video thuộc loại interaction `local-video`, tham chiếu `videoAssetId` vào asset `kind: video`; bytes không nằm trong Canvas JSON. Các mẫu giữ placeholder tùy chọn; preview/quà ẩn khối khi chưa có tệp.

## Dùng và lưu

1. Chèn Video, chọn WebM VP8/VP9, tối đa 128 MB, 2 phút, 1920×1080.
2. Sửa tiêu đề/chú thích/màu, kéo/đổi kích thước như khối khác. Thay tệp hoặc chọn lại video đã tải; gỡ chỉ bỏ tham chiếu khỏi cảnh.
3. Lưu, tải lại và xem trước. Video có nút phát native, không tự phát. Phát video dừng nhạc/âm thanh khác; rời cảnh hoặc đóng player tạm dừng, bỏ nguồn và giải phóng bộ phát.
4. Xuất bản chỉ trong QA local. Owner assets vẫn cần đăng nhập/đúng chủ; quà phát đúng các asset đã pin và quyền invite/receipt hiện có. Thu hồi quà khóa đường đọc. Range hỗ trợ phát/tua, vẫn private/no-store.

Tải lại cùng mutation/content dùng cùng ID; cùng mutation khác nội dung bị từ chối. Uploader khóa trước khi đọc/hash tệp để không có hai lựa chọn ghi đè nhau. Tệp không phải WebM hợp lệ hoặc vượt metadata/dung lượng bị từ chối. Bộ phân tích chỉ đọc metadata EBML giới hạn; không chạy decoder server từ nội dung người dùng. Browser giải mã thật khi phát; lỗi phát vẫn cho đọc tiếp thiệp.

Xóa/gỡ/thay trong editor không xóa tệp đã được quà cũ tham chiếu. Tệp thật, frame, clip mẫu và dữ liệu QA nằm trong `local/`, được Git bỏ qua. Không dùng đường dẫn public tĩnh cho video cá nhân.

## Bo góc và chuyển động

- Các bản đã lưu v1 giữ nguyên. Tài liệu mới chọn các appearance/preset mềm và chứa màu, bo góc, nhịp chuyển động trong model.
- Chín khối Drive có kiểu mềm/cổ điển, tham số bo góc, nhịp và màu. Có **Thử lại tương tác**; tên trên vé và ảnh không bị xóa khi thử lại.
- Hộp `lid-card-v2` và phong bì `wax-letter-v2` dùng reaction R02/R01 chọn được trong Canvas. Sửa tốc độ hoặc tắt reaction có hiệu lực; đóng/quay lại hủy chuyển động đang chạy. Mũ dùng reaction R03 cùng động tác tung mũ nội tại.
- Thư gấp/album/vé cào/RSVP có biến thể mềm riêng; mặc định cũ không bị đổi. T07/T08, E02 và các recipe giấy/ảnh là các mục đã có thật trong picker và seed effect/animation.
- Phân biệt rõ: hiệu ứng native trong picker khác với hành vi nội tại của camera/lịch/vé. Hành vi nội tại được chỉnh qua kiểu/nhịp của chính khối, không được báo là một effect độc lập.

## Kiểm tra

`tests/unit/local-video.test.mjs` kiểm profile, dữ liệu và tham chiếu. `tests/integration/local-video-off.mjs` kiểm HTTP mặc định tắt. Các runner/evidence tại `local/video-polish-20261128` kiểm video thật, owner/invite/revoke/Range, thao tác Canvas, reaction edit/off và hành trình sáu mẫu ở VI/EN/320/390/1440.

Kiểm video thật có thể chạy lại bằng `npm run test:video:local -- --runtime=<runtime-local.json> --clip=<tệp-đầu.webm> --replacement=<tệp-thay.webm> --artifacts=<thư-mục-kết-quả>`. Runtime phải ghi rõ `localVideo: true` và host loopback; bài thử không tự cho phép destination khác hoặc bật quyền trên môi trường đang phục vụ. Không commit runtime có cookie hoặc tệp video.

Đối chứng quà v1 bằng snapshot và pixel trước/sau; không dùng kết quả cũ để báo tính năng mới đạt. MySQL QA chỉ kiểm mẫu không có video được gán và việc áp thư viện theo revision; video thật không được ghi vào MySQL.

## English

Local video requires an explicit flag, JSON storage, a non-production environment and loopback requests. Files remain local and outside Git. The Canvas component supports owned WebM assets, replacement/removal, duplicate/save/reload, private range reads and snapshot/invite/revocation rules. No autoplay; leaving a scene releases playback. Upload content is bounded and metadata-checked without executing a server decoder.

Soft appearances are explicit document settings. Saved v1 cards retain their original properties. Registered effects and animations remain editable in Canvas; intrinsic camera/calendar/ticket actions are described separately. Motion honors reduced-motion and is cancelled when scenes or previews close.
