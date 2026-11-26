# Frontend Momevia

## Nơi chỉnh sửa

| Phần | Mã nguồn |
| --- | --- |
| Điều hướng, phiên và vòng đời trang | `web/js/app/`, `web/js/pages/` |
| Đăng nhập, đăng ký và khôi phục | `web/js/pages/auth.js`, `web/css/auth-pages.css` |
| Studio, bảng lớp, cảnh và thuộc tính | `web/js/features/canvas-editor/` |
| Xem trước và phát quà | `web/js/features/gift-runtime/` |
| Schema, thư viện, tài nguyên và chuyển động | `web/js/shared/canvas/` |
| Thành phần, biểu tượng và bản dịch | `web/js/ui/`, `web/assets/locales/` |

## Hợp đồng cần giữ

- Tài liệu Canvas là nguồn dữ liệu chung của Studio, server, preview và player; Fabric chỉ hỗ trợ thao tác bố cục. Không lưu Fabric JSON thay tài liệu Canvas.
- Giữ ID của mẫu, element và tài nguyên đã phát hành. Quà giữ snapshot riêng; sửa thư viện không thay bản đã chèn. Không ghi đè media đã có hash bằng nội dung mới.
- Chỉnh layout, thứ tự lớp, trạng thái và thuộc tính qua store/patch hiện có, để Undo/Redo và autosave dùng cùng một thay đổi. Giữ kiểm revision/CAS và mutation ID khi thử lại.
- Giữ các khóa và giới hạn cá nhân hóa do server xác lập. Ẩn nút trên UI không thay kiểm quyền ở API.
- Chuyển động nằm trong vùng chọn bên ngoài, giữ điểm gắn cha/con và được hủy khi rời cảnh. Tôn trọng tùy chọn giảm chuyển động.
- Dialog và bảng mobile giữ focus, đóng bằng Escape và dùng được bằng bàn phím. Thứ tự đọc khác thứ tự vẽ; nội dung dài phải đọc và cuộn được.
- Chữ của ứng dụng dùng khóa VI/EN chung; không đổi nội dung do người dùng nhập để chuẩn hóa giao diện.

## Build và tài nguyên

`web/index.html` khai báo thứ tự CSS và các điểm vào. Build tạo QR, thư viện phụ trợ, ảnh bìa và các chunk có tên theo nội dung. `web/assets/app` là đầu ra có thể dựng lại; build giữ tệp của bản hiện tại và bản liền trước khi dọn đầu ra cũ.

Ảnh bìa có đường dẫn riêng theo mẫu, ngôn ngữ và biến thể. Hai tệp giống nội dung vẫn có thể phục vụ hai URL đang được dùng; chỉ hợp nhất sau khi cập nhật bộ sinh và cơ chế phân giải tương ứng. Tài nguyên QA không đặt dưới `web/assets`; bằng chứng phát sinh lưu trong `local/` và không vào Git/gói nguồn.

## Kiểm tra thay đổi

- `npm run check`, `npm test`, `npm run build`.
- `npm run test:templates` cho thay đổi thư viện/mẫu và ảnh bìa.
- `npm run test:canvas:browser` cho thao tác Studio và vòng lưu/xem quà.
- `npm run test:motion:browser` và tùy chọn `-- --webkit` cho quan hệ hình học của icon.

Xem [hướng dẫn Canvas](CANVAS_SENDER_GUIDE.md), [hợp đồng API](ENDPOINTS.md), [icon chuyển động](MOTION_REPAIR_56.md) và [vận hành](OPERATIONS.md). Chi tiết các đợt UI cũ được giữ trong lịch sử Git thay vì các bản hướng dẫn trùng nhau.

## Tiếp tục bàn giao UI/UX ngày 26/11/2026

Điểm xuất phát là `95cc0da` trên `fix/ui-ux-audit-20261126`, đã chứa A1–A6. Phạm vi tiếp theo được người dùng chọn là B1a, toàn bộ B2 được đề xuất và BASE-list:

| Mục | Hành vi đã triển khai |
| --- | --- |
| B1a | Thứ tự link theo quyền mở hiện có; nhãn sao chép nói rõ link mời hoặc link thường. URL, quyền hồi đáp, chia sẻ và QR giữ nguyên. |
| B2 bố cục | Mobile tối đa 680 px: tên → giá → bìa → hành động → mô tả; desktop giữ hai cột. Thứ tự DOM cũng đưa bìa lên trước thao tác. |
| B2 toolbar | Nhóm VI/EN, phát lại, dùng mẫu và đóng cho phép xuống dòng, giữ vùng chạm tối thiểu 44 px. Giữ chiều cao scroll-padding theo toolbar thực tế. |
| B2 nút nổi | Chỉ hiện khi CTA trong nội dung hoàn toàn ngoài vùng nhìn thấy sau khi trừ header. CTA còn nhìn thấy một phần thì ẩn nút nổi; footer, dialog và trạng thái thiếu mẫu vẫn chặn. URL giữ đúng ID/version của mẫu. |
| BASE-list | Nút tải XLSX giới hạn theo vùng chứa, nhãn xuống dòng; endpoint và thuộc tính download giữ nguyên. |

Kiểm thử bằng `node tests/integration/ui-ux.mjs` (A1–A6) và `node tests/integration/ui-ux-followup.mjs` (B1/B2/BASE-list). Bài mới dùng Chrome cài trên máy và server JSON cô lập, có 54 phép kiểm bố cục VI/EN, 320/390/1440 px và chữ lớn; kiểm retry, Escape/trả focus, hủy nội dung player, URL phiên bản, nút nổi và bộ lọc khi quay lại. Không tạo nháp trong preview/replay/retry. Dữ liệu danh sách và mẫu có phiên bản trong các tình huống QA được mô phỏng; đây không phải xác nhận merchant, OAuth/email, Safari hoặc thiết bị thật.

Trên máy có `TEST_ACCOUNT_ENABLED=true` trong `.env`, ca `demo-flag-security` hiện hữu đọc cấu hình này khi tự chuyển sang production nên thất bại. Để tái hiện bộ 1.023 unit test đạt, tắt cờ này riêng trong tiến trình kiểm thử; không sửa `.env` hay cơ chế chặn tài khoản test trên production. PowerShell:

```powershell
$previousTestFlag = $env:TEST_ACCOUNT_ENABLED
try {
  $env:TEST_ACCOUNT_ENABLED = 'false'
  npm.cmd test
} finally {
  if ($null -eq $previousTestFlag) {
    Remove-Item Env:TEST_ACCOUNT_ENABLED -ErrorAction SilentlyContinue
  } else {
    $env:TEST_ACCOUNT_ENABLED = $previousTestFlag
  }
}
```

Các phương án trong PDF chưa thuộc phạm vi được chọn vẫn cần xem và chốt riêng:

| Mục | Việc còn lại |
| --- | --- |
| B3 Studio | Chốt cách ưu tiên nháp/hồi đáp trước tìm kiếm; giữ bộ lọc, phân trang và phân biệt lỗi với dữ liệu rỗng. |
| B4 Creator/Admin | Chốt thứ tự phản hồi sửa/bộ sưu tập và hàng đợi duyệt/chỉ số; giữ đúng phiên bản và quyền. |
| B5 Giao dịch | Chốt thứ tự tiếp tục → biên nhận → hoàn tiền khi API xác nhận paid và context hợp lệ. |
| B6 Tài khoản | Style Login/Register đã được khôi phục từ `d36c664` theo yêu cầu riêng. Các đề xuất thu gọn OAuth tắt và nội dung recover/verify vẫn chưa triển khai. |
| B7 Người nhận/Editor | Duyệt điều kiện ẩn đổi tên; giữ tên/receipt qua reload/retry và đầy đủ công cụ khi toolbar xuống dòng. |
| B8 Từng màn | Rà riêng Catalog, yêu thích rỗng, giới thiệu/preview, giá/FAQ, mục lục chính sách, lỗi/quyền/hết hạn/thu hồi, thành phần và âm thanh. |
| H1 Hero | Giữ thiết kế và timing/focus hiện tại; chưa xác nhận đáp ứng đầy đủ tiêu chí dừng chuyển động. |

Đợt này chưa commit/push, merge, triển khai hosting hoặc chạy migration vận hành.

## Giao diện Login/Register tối

Theo yêu cầu khôi phục ngày 26/11/2026, `auth-pages.css` dùng lại nguyên nội dung tại commit `d36c664`. `open-me-system.css` loại Login/Register khỏi lớp màu sáng và giữ màu của recovery cùng các trang còn lại. Khi sửa theme chung, kiểm tra màu hiển thị cuối cùng sau cascade, không chỉ kiểm tra tên test hay sự tồn tại của gradient trong CSS nguồn.

Chạy `node tests/integration/auth-dark-style.mjs` để kiểm 24 màn Login/Register VI/EN ở 320/390/768/1024/1440/1920 px, màu nền/header/input/nút sau cascade, vùng giới thiệu responsive, logo Zalo, trạng thái provider chưa cấu hình, toggle mật khẩu, đổi ngôn ngữ và đăng ký/đăng nhập email qua fixture JSON riêng. Bài kiểm tra cũng xác nhận Catalog, recover và verify-email vẫn dùng hệ màu sáng.
