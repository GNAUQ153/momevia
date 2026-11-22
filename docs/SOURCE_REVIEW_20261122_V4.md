# Code Review Momevia — nguồn ZIP `(2)`, ngày 22/11/2026

**Nguồn kiểm tra:** `Momevia_Main_Latest_20261122(2).zip` (906 mục ZIP). Mọi kết luận về mã gốc dưới đây dựa trên nội dung đã giải nén. Đợt cập nhật Music Occasion V4 được ghi riêng ở phần cuối.

## 1. Kiến trúc và OOP

**Kết luận: có OOP; kiến trúc backend theo Modular Monolith, mức độ tách lớp khá.** Có `CredentialsService`, `IdentityService`, `RoleService`, `DesignsService`, `AssetsService`, `PaymentService`, `RefundReviewService`, cùng repository JSON/MySQL. Các lớp nhận repository qua constructor/factory, giảm phụ thuộc implementation. Không có yêu cầu đưa mọi hàm UI vào class: ES Modules + pure functions ở frontend là lựa chọn hợp lý.

- Composition root và router: `src/server/app.mjs`, `src/shared/http.mjs`.
- Auth và session: `src/modules/identity/`, `src/shared/security.mjs`.
- Thư viện mẫu, Creator workflow: `src/modules/catalog/`.
- Canvas nháp, xuất bản, quyền asset: `src/modules/designs/`.
- Đơn hàng/giấy phép/payments: `src/modules/checkout/`, `src/modules/payments/`.
- Quà, link, phản hồi: `src/modules/gifts/`, `src/modules/support/`.

**Điểm yếu về bảo trì:** `web/js/pages/designer.js` có 2.543 dòng và `web/js/app/main.js` có 1.642 dòng; tuy đã tách panel và dialogs, điều phối UI vẫn rất lớn. 46 file CSS có 32 dòng nhiều khai báo trên một dòng (mẫu: `gift-runtime.css`, `admin-library.css`, `template-library.css`). `web/index.html` nạp nhiều lớp CSS; nguy cơ cascade/override về sau cần stylelint, visual regression, chuẩn hóa layer. `web/css/tokens.css` dùng đúng ba bộ font; Plus Jakarta Sans/Inter đang lấy từ Google Fonts, Lora có tệp font local trong source. Không tự khẳng định offline hiển thị giống online.

## 2. An ninh thông tin

| Ưu tiên | Quan sát trong source | Khuyến nghị / giới hạn |
| --- | --- | --- |
| Tốt | `CredentialsService` sử dụng `scrypt` + salt, so sánh bằng `timingSafeEqual`; API công khai không trả `passwordHash`. | Không lưu mật khẩu rõ; kiểm tra luồng reset/credentialVersion bằng E2E. |
| Tốt | `src/shared/security.mjs` ký session HMAC-SHA256; server lấy role hiện hành từ identity session, không tin role gửi từ trình duyệt. | Chạy kiểm thử BOLA/IDOR trên từng route của Sender/Creator/Admin. |
| Tốt | Cookie có `HttpOnly`, `SameSite=Lax`; static server và Origin allowlist; thông số ảnh tối đa 2 MB và đi qua `sharp` để chuẩn hóa. | Fuzz file hỏng/ảnh lớn; kiểm soát quyền truy cập ảnh và link mời thực tế. |
| P0 | Flag `Secure` của cookie phụ thuộc biến `PUBLIC_BASE_URL` ở `src/shared/security.mjs`. | Production phải dùng HTTPS end-to-end, cấu hình base URL, proxy, secret đúng và test cookie trên domain thật. |
| P1 | `requireRequestOrigin()` bỏ qua kiểm tra khi request không có header `Origin`, nhằm hỗ trợ CLI và callback server. | Rà từng endpoint dùng cookie, CSRF strategy, phương thức thay đổi trạng thái và phân biệt webhook; không coi `SameSite=Lax` là bảo đảm tuyệt đối. |
| P0 | Refund hiện là workflow **review beta**, không gọi provider để hoàn tiền; Creator finance chỉ báo cáo, không phải tài khoản có thể rút. | Tách rõ `approved request`/`provider refunded`/`reconciled`; transaction, audit log, ledger đảo, payout và đối soát MySQL. |
| P0 | Có chế độ JSON mặc định và MySQL tùy cấu hình. | Trước production phải chứng minh migration, backup/restore, quyền DB hạn chế, crash-recovery và concurrency. |
| P1 | Nhạc Canvas dùng allowlist ID tại `web/js/shared/canvas/schema.js` và `soundtracks.js`, không nhận URL bất kỳ. | Giữ cách triển khai này cho V4; không thêm upload MP3 công khai nếu chưa có xác minh định dạng, quyền tác giả, dung lượng và quét an toàn. |

**Lưu ý:** đây là source audit và kiểm thử tĩnh/Node, không thay thế pentest, rà cấu hình máy chủ, kiểm tra dữ liệu vận hành hoặc tuân thủ pháp lý. Tham chiếu OWASP: [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## 3. Mức hoàn thiện nghiệp vụ từng vai trò

| Vai trò | Đã có trong mã nguồn | Còn thiếu/chưa được xác minh |
| --- | --- | --- |
| **Sender** | Đăng nhập/đăng ký, thư viện mẫu, yêu thích, tạo và sửa Canvas, lưu nháp, phát hành, link/QR, quản lý quà, đọc phản hồi. | Trải nghiệm thanh toán thật (canceled, retry, expired, mismatch), hoàn tiền thật, mobile/offline, chính sách lưu trữ. |
| **Recipient (khách)** | Mở quà theo link và policy, xem Canvas, trả lời, phát nhạc tùy chọn, tắt/điều chỉnh âm lượng; không yêu cầu tài khoản cho luồng cơ bản. | Đo thực tế Safari iOS/Android mạng chậm, screen reader, kiểm tra link đã thu hồi hết hiệu lực, cơ chế retention và xóa nội dung. |
| **Creator** | Thiết kế mẫu, revision, nộp duyệt, xem phản hồi, quản lý mẫu, báo cáo tài chính chỉ đọc/CSV. | Bản quyền/giấy phép mẫu, chính sách hoa hồng, phí/thuế, payout, số dư khả dụng và hoàn tiền liên quan tác giả. |
| **Admin** | Quản lý vai trò, hàng đợi duyệt, hỗ trợ/báo cáo, refund review, đối soát và đọc finance. | Refund provider thật, phê duyệt chi, phân tách nhiệm vụ (maker–checker), payout, nhật ký production/giám sát. |

**Đánh giá:** luồng sản phẩm `Create → Personalize → Send → Open → Reply` tương đối phù hợp bản Beta. **Chưa đủ điều kiện tuyên bố payment/refund/payout production hoàn thiện.** Ví dụ trạng thái `awaiting_provider` trong `docs/REFUND_REVIEW_BETA.md` không có nghĩa đã hoàn tiền; `docs/FINANCE_READONLY.md` không chứng minh Creator có số dư rút.

## 4. UI/UX và Marketing

**Phù hợp phần lớn nền tảng:** `web/css/tokens.css` thiết lập:

```css
--font-display: "Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif;
--font-body: "Inter", system-ui, -apple-system, sans-serif;
--font-serif: "Lora", Georgia, serif;
```

Trang có theme, marketing 3D/CSS animation, các điều khiển Fabric, menu responsive, motion preferences và Lucide SVG (không cần emoji). Nhưng còn CSS nén một dòng, một số khu vực có chữ nhỏ, thứ tự stylesheet nhiều và các override vùng marketing. **Không được đánh đồng hiệu ứng CSS 3D với tích hợp mô hình Spline WebGL**, và không gọi thiết kế là hoàn toàn đạt chuẩn quốc tế trước khi test mobile, WCAG, Lighthouse/Core Web Vitals.

**Ưu tiên giai đoạn sau:** (1) design token/font single source; (2) mobile 320/390/768/1024/1440, 44px hit targets và focus; (3) LCP/INP/CLS + reduced-motion; (4) visual regression VI/EN; (5) tối ưu onboarding từ xem thiệp sang tạo thiệp; (6) 3D trang marketing có fallback 2D nếu yếu tài nguyên.

Tham khảo định hướng: [ChungDoi](https://chungdoi.com/vi/help/templates) có điều chỉnh thiệp kèm nhạc, còn [Spline với Webflow](https://help.webflow.com/hc/en-us/articles/33961236080787-Add-a-Spline-scene-to-your-Webflow-site) dùng cảnh 3D có tương tác. Source Momevia không sao chép tài nguyên hay mã từ các website này.

## 5. Đợt nâng cấp Music Occasion V4

- Mở rộng thư viện từ 4 lên 10 bài, gồm sáu giai điệu mới theo dịp: sinh nhật, đám cưới, Giáng sinh, Tết dương lịch, Tết Nguyên đán, Valentine.
- Bộ lọc **dịp + cảm xúc + từ khóa** trong cùng giao diện Designer VI/EN; giữ dropdown cũ và trạng thái Không dùng nhạc.
- Nhạc nội bộ MP3 được tổng hợp từ script tự viết, **không dùng file âm thanh của bên thứ ba**. Không khẳng định tác phẩm được cấp phép thương mại bởi một tổ chức bên ngoài; cần lưu hồ sơ quyền và có bước rà soát trước phát hành thương mại.
- Giữ `soundtrack: { id, volume }`, không thay schema/API/migration, không autoplay ở Recipient, không nhận URL lạ, không chỉnh Creator policy. Thêm CSS theo module, hiệu ứng chiều sâu nhẹ và `prefers-reduced-motion`.

### Đã xác minh

- 6 MP3 đều được FFprobe xác nhận giải mã được, mỗi bài khoảng 24,06 giây, 80 kb/s.
- Các test liên quan đến nhạc và kiểm toán khóa VI/EN đạt.
- Chạy `node --test tests/unit/*.test.mjs`: 571 test đạt; 6 file test không khởi động do thiếu `sharp` tại môi trường kiểm thử. Không tuyên bố tổng CI đã đạt.

### Cần kiểm tra trên máy bạn trước commit

`npm ci && npm run build && npm run check && npm test && npm run test:browser && npm run test:canvas:browser && npm run i18n:audit`.

Tại Designer: tìm nhạc, lọc dịp, đổi VI/EN, chọn bài, nghe thử, đổi âm lượng, Undo/Redo, lưu nháp, xuất bản; tại Recipient: bấm phát/tắt nhạc, đảm bảo không autoplay. Kiểm tra Safari iOS, Chrome Android và focus trên bàn phím.
