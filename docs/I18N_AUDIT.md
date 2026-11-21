## Bổ sung kiểm toán App Shell (21/11/2026)

- `npm run check` nay kiểm tra thêm `web/js/app/main.js` ngoài `designer.js` và chặn nhãn giao diện tiếng Việt mới chưa gắn khóa dịch.
- Chuỗi `Lễ hội` được giữ dưới dạng **giá trị metadata bộ lọc** chứ không phải nhãn giao diện; giao diện hiển thị của bộ lọc tiếp tục dùng từ điển. Không dịch dữ liệu đã lưu.
- Đã sửa thuộc tính `alt` của ảnh xem trước và thông báo đối soát thanh toán để phản ứng với chuyển ngôn ngữ. Refund Queue có trạng thái tải/lỗi `aria-live` và bỏ qua phản hồi cũ khi người dùng đổi bộ lọc nhanh.
- Xem `docs/GLOBAL_SHELL_UX_I18N.md` để kiểm thử thủ công và các giới hạn. Kiểm tra này **không** bảo đảm tất cả module frontend đã được dịch.

# Kiểm toán ngôn ngữ UI — đợt Designer History & Fabric Design Tokens

## Phạm vi đã kiểm tra

- `web/js/pages/designer.js`: chuyển các nhãn chỉnh sửa và mô tả thao tác trong phiên Canvas sang khóa từ điển `editor.history.*`. Tên phần tử trên thư viện được tra từ `editor.library.item.*` ở thời điểm tạo thao tác.
- `web/assets/locales/vi.json` và `en.json`: 28 khóa mới trên mỗi ngôn ngữ, dùng cùng placeholder và không phụ thuộc font ngoài.
- `web/css/tokens.css`: token `--ui-control-min-height`, `--ui-panel-border`, `--ui-focus-ring`, `--ui-control-ease`; ba bảng Fabric dùng chung các token đó.
- Không sửa Canvas schema, revision, ID, ảnh, session, autosave, API, database, thanh toán hay quà đã phát hành.

## Tách dữ liệu người dùng khỏi nhãn giao diện

Các giá trị như `Cảnh ${n}`, `(bản sao)`, `Nội dung kỷ niệm`, `Chú thích ảnh`, `Món quà của tôi` và `Lời chúc của bạn` là giá trị đã/được lưu hoặc dùng để nhận diện mẫu cũ. **Không tự dịch các giá trị đó**: việc thay đổi sẽ làm đổi dữ liệu và ảnh hưởng tương thích mẫu/nháp, đặc biệt giữa VI và EN.

## Lệnh kiểm tra

```bash
npm run check
npm test
npm run i18n:audit
```

- `npm run check` gọi thêm bộ kiểm tra chuỗi UI của `designer.js`. Bất kỳ chuỗi tiếng Việt mới nào ngoài sáu giá trị có giải thích sẽ làm kiểm tra thất bại.
- `npm run i18n:audit` in danh sách ứng viên toàn bộ `web/js/pages` và `web/js/features/canvas-editor`. Đây là **báo cáo ứng viên**; không phải tất cả là lỗi. Nhiều chuỗi là dữ liệu thư viện mẫu, thông báo lỗi kỹ thuật hoặc nội dung mẫu cũ.
- Chỉ `designer.js` được thực thi chính sách chặn nghiêm ngặt ở giai đoạn này. Không được diễn giải việc `npm run check` đạt là đã kiểm toán đầy đủ mọi trang.

## Kiểm thử thủ công cần thực hiện

1. Mở Canvas Designer, chuyển VI → EN → VI; sửa chữ, ảnh, thêm/xóa cảnh, thêm phần tử và quan sát trạng thái/hành động.
2. Chọn một phần tử thư viện ở EN, xác nhận nhãn thao tác là tiếng Anh; tên/ID và nội dung thiết kế đã lưu vẫn giữ nguyên.
3. Kiểm tra ba bảng Fabric Quickbar, Inspector, Style Properties trên desktop 1440px, tablet 768px và mobile 375px: không overflow, Tab/Shift+Tab, focus-visible và giảm chuyển động.
4. Lưu nháp, Undo/Redo, mở lại thiết kế cũ; xác nhận không phát sinh phiên bản hay mutation khi chỉ đổi ngôn ngữ.
5. Xem lại bản quà đã xuất bản và các luồng thanh toán/Refund Review. Bản nâng cấp này không chủ động tác động các luồng đó.

## Giới hạn

- Chưa rà trực quan toàn bộ route của Admin, Creator, Sender, Recipient và mọi Fabric dialog trong trình duyệt thật.
- Bộ quét nhẹ không thay cho AST parser. Chế độ `--report` có thể chứa ứng viên sai; cần phân loại trước khi chuyển sang kiểm tra chặn cho những file khác.
- Chưa có chứng nhận WCAG 2.2 AA hoặc kiểm thử bảo mật độc lập.
