# Momevia — Canvas Editor nâng cao (Phase 5, beta)

## Quyết định kiến trúc

Momevia sử dụng **Canvas document schema v1** làm nguồn dữ liệu duy nhất. Trình xem thiệp của người nhận giữ nguyên DOM-based player (nhiều cảnh, chuyển cảnh, phản hồi, quyền truy cập). Công cụ Fabric Studio mới chỉ mở trong trang editor dành cho Sender/Creator với quyền chỉnh bố cục và **không lưu Fabric JSON vào MySQL**.

### Các nguồn tham khảo và vai trò

| Công nghệ | Giấy phép / trạng thái | Phạm vi dùng |
|---|---|---|
| [Fabric.js 7.4.0](https://fabricjs.com/) | MIT | Runtime của công cụ thiết kế nâng cao: chọn, kéo, xoay, resize, căn chỉnh, sửa chữ tĩnh, xuất PNG tĩnh khi an toàn |
| [Konva.js](https://konvajs.org/) | MIT | Đã đánh giá; chưa đưa vào bundle. Không chạy song song hai engine vẽ để tránh hai scene graphs và sự lệch hit testing |
| [Lumio Design Studio](https://github.com/vipinyadav01/lumio-design-studio) | MIT theo repo | Tham khảo UX toolbar, thao tác lớp, trình biên tập nhiều trang; không sao chép code ứng dụng |
| [CardCraft](https://github.com/Whizkevina/cardcraft) | README mô tả MIT; kiểm tra LICENSE của phiên bản được sử dụng nếu sao chép | Tham khảo quy trình thiệp, tải ảnh và xuất thiết kế; không sao chép code ứng dụng |

Nguồn: các trang dự án được kiểm tra ngày 19/11/2026. Fabric.js 7.4.0 là bản có các bản sửa bảo mật SVG export được công bố trước đó; tính năng beta này **không cho nhập Fabric JSON hoặc SVG tùy ý**, không gọi `loadFromJSON()` hoặc `toSVG()` từ nội dung người dùng. Mọi dữ liệu chỉnh sửa phải đi qua `validateDocument()` của Momevia.

## Chức năng đã triển khai

- Nút **Fabric Studio** trong chế độ chỉnh bố cục của Designer; không xuất hiện ở chế độ cá nhân hóa nhanh.
- Dialog có bộ công cụ kéo thả, xoay, thay đổi kích thước, căn trái/giữa/phải/trên/dưới.
- Hỗ trợ `text`, `shape` (rectangle, ellipse), `image` với asset nội bộ; xử lý chữ liên kết (`textBinding`) dưới dạng **không cho sửa nội dung**.
- Các lớp tương tác như button, envelope, gift box và reply hiển thị dạng minh họa không chỉnh sửa, bảo toàn scene actions trong document gốc.
- Khi bấm **Áp dụng**, chỉ cập nhật thuộc tính bố cục và nội dung chữ tĩnh được phép; sử dụng lịch sử Undo/Redo và autosave hiện có.
- Xuất PNG tĩnh 2× khi tất cả lớp của cảnh có thể hiển thị đúng. Nút xuất bị khóa nếu có element tương tác hoặc thiếu ảnh. Xuất PNG không thay thế đường dẫn thiệp tương tác.
- Khóa chỉnh cấu trúc Creator template và policy `lockedElements`, ngăn thay đổi vô tình các lớp không thuộc quyền người dùng.

**Giới hạn beta:** Khung ảnh trong Fabric được xem bằng tỷ lệ co dãn, chưa mô phỏng chính xác `object-fit: cover`, focal point, border radius và font token giống DOM 100%. Nội dung phát hành luôn phải xem lại trong trình phát gốc trước khi gửi. Không thêm import SVG, bộ lọc ảnh, hiệu ứng timeline, tính năng nhóm/layer reorder hoặc đồng chỉnh sửa qua nhiều người.

## Cách cài và đóng gói trên localhost

```bash
# Tại thư mục gốc Momevia sau khi áp dụng overlay:
npm install --save-exact fabric@7.4.0
npm run build
npm run check
npm test
npm run test:architecture
npm run package
npm run verify:package
```

`npm run build` sẽ sao chép ESM bundle từ `node_modules/fabric/dist/index.min.mjs` sang `web/js/vendor/fabric.mjs` cùng bản quyền `FABRIC_LICENSE.txt`. Không dùng CDN runtime, phù hợp môi trường self-host. Không commit `node_modules/`, file `.env` hoặc vendor bundle sinh tự động; file bundle được đưa vào release package sau build.

Nếu chưa cài Fabric, editor cũ vẫn hoạt động. Nút Fabric Studio sẽ thông báo cần cài dependency, không phá vỡ luồng thiệp hiện hữu. Phải cập nhật cả `package.json` lẫn `package-lock.json` bằng `npm install` để các job `npm ci` trên GitHub có cùng dependency.

## Kiểm tra bắt buộc trước khi push

1. Mở thiết kế Sender có text, shape, image; thử kéo, thay kích thước, xoay và căn chỉnh. Bấm Áp dụng, Save, Reload, Undo/Redo và xác nhận vị trí được giữ.
2. Mở mẫu có `textBinding`, các lớp có `locked` và Creator template: không được sửa nội dung bị khóa.
3. Thử trên mobile 320/390px và desktop 1440px; không có horizontal overflow ngoài vùng artboard, focus chạy được bằng bàn phím.
4. Kiểm tra ảnh nội bộ (`/api/designs/.../assets/...`), import không dùng URL ngoài; lỗi ảnh phải giữ nguyên dữ liệu gốc.
5. Thử một thiệp nhiều cảnh có nút và phong bì: link quà tương tác sau lưu/publish vẫn chạy như cũ; PNG tĩnh không được thay thế trải nghiệm người nhận.
6. Chạy lại Browser Integration, MySQL 8.4 CI và toàn bộ matrix Ubuntu/Windows Node 22/24.

## Quy tắc nguồn mở

- Bảo toàn thông báo bản quyền Fabric (file license tự đi kèm release).
- Lumio và CardCraft chỉ được nghiên cứu làm tham khảo UX; không đưa code, ảnh, template hoặc asset của họ vào sản phẩm.
- Không dùng MUI, emoji, CDN hoặc font không rõ giấy phép cho phần UI mới. Các thuộc tính CSS được tách dòng và chia thành file `editor-fabric.css`.
