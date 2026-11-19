# Momevia Phase 5.4 — Kho hình trang trí riêng

## Mục tiêu

Mở rộng **100 elements hiện tại** bằng **24 sticker vector Momevia Originals** (4 nhóm × 6), không thay renderer, tài liệu Canvas V1/V2 hoặc các loại tương tác đã phát hành.

Các nhóm có sẵn trong tab **Thêm** → **Nhóm khối**:

- **Kho trang trí · Giáng sinh**: cây thông, bông tuyết, cầu tuyết, quả châu, tất, chuông đôi.
- **Kho trang trí · Tết Nguyên đán**: hoa mai, lì xì, đèn lồng, hoa đào, pháo giấy, quạt xuân.
- **Kho trang trí · Valentine**: hai trái tim, thư tình, hoa hồng, mũi tên, đôi cánh, nơ.
- **Kho trang trí · Kỷ niệm**: Polaroid, confetti, nhạc, bánh, dải sao, vòng hoa.

## Kiến trúc

- `web/js/shared/canvas/decorative-art.js`: 24 hình vector path nội bộ, tọa độ SVG `viewBox 100×100`, **không có remote URL, script, font hay emoji**.
- `web/js/shared/canvas/artwork.js`: đăng ký vector trong `stickerArt`, tái sử dụng `vectorParts` sẵn có.
- `web/js/features/canvas-editor/decorations.js`: dữ liệu nhóm, tên, từ khóa, sắc độ, factory `createElement("sticker")`.
- `web/js/features/canvas-editor/library.js`: bổ sung 4 nhóm vào `catalog`; tìm kiếm không dấu, lazy thumbnail, drag/layer/Undo/Redo và chính sách Creator đều sử dụng luồng có sẵn.
- `tests/unit/canvas-elements.test.mjs`: **giữ nguyên kiểm thử bất biến cho 100 phần tử cũ**, mở rộng phép kiểm tra xuất bản cho 124 factory.
- `tests/unit/decorative-library.test.mjs`: ID, 4 nhóm, metadata, vector safety, schema V2, sao chép, preview SVG.

Chèn các sticker mới vào một document V1 sẽ tự nâng lên **V2** bằng `requiresCanvasV2` trong `designer.js`, không thay đổi bản nháp hoặc quà cũ. Không dùng database migration, thêm dependency hoặc loader bên ngoài.

## Tham chiếu open-source, giấy phép và nguồn gốc

Đối chiếu theo README/GitHub tại thời điểm 19/11/2026:

| Repository | Tình trạng | Cách sử dụng trong Momevia |
| --- | --- | --- |
| https://github.com/gridaco/library | CC0-1.0 công bố cho thư viện | Tham khảo mô hình catalog, metadata, phân nhóm; chưa import asset |
| https://github.com/CaptExcellent/kits-library-assets | README quảng bá các bộ illustrations CC0 | Tham khảo cấu trúc bộ theo mùa; chưa import asset |
| https://github.com/shaongitbd/doory | **Attribution Assurance License**, yêu cầu ghi công hiển thị | Chỉ tham khảo UX; **không sao chép code/assets** |
| https://github.com/mir-ashiq/canvix | MIT | Tham khảo chức năng palette/sticker; không sao chép code |
| https://github.com/Yashwanthgouda/CanvasLite | MIT | Tham khảo quản lý layer và thao tác thiết kế; không sao chép code |
| https://github.com/vipinyadav01/lumio-design-studio | MIT | Tham khảo bố cục editor; không sao chép code |

**24 hình mới là vector nguyên bản được biên soạn cho Momevia trong bản nâng cấp này**: không phải ảnh tải hay bản sao từ sáu dự án. Việc sử dụng code/asset bên ngoài trong tương lai phải rà giấy phép **từng file**, logo/trademark, nguồn ảnh và yêu cầu attribution; CC0 của một repository không tự chứng minh mọi asset bên thứ ba trong đó đều thuộc CC0. Không chuyển bất kỳ hình ảnh không đáng tin thành HTML hay SVG inline tùy ý.

## QA thủ công sau khi cài

1. Chạy `npm run dev`, mở Designer, tab **Thêm**, bộ lọc **Nhóm khối**, chọn từng nhóm “Kho trang trí”.
2. Tìm kiếm không dấu: `noel`, `li xi`, `valentine`, `anh ky uc`; chèn mẫu, kéo và đổi màu.
3. Lưu, thoát, đăng nhập lại, Undo/Redo; kiểm tra preview và recipient renderer hiển thị cùng hình.
4. Với document V1: chèn hình mới → lưu document V2; mọi document V1 cũ vẫn mở và có thể xuất bản.
5. Kiểm tra mobile 320/390px, desktop 1440px, font, bảng layer, trạng thái Creator policy và bàn phím.
6. Chạy CI GitHub thực tế, gồm MySQL QA **cô lập**; không trỏ test QA đến `momevia_dev`.

## Các giới hạn chưa xử lý

Không triển khai importer SVG/PNG bất kỳ, hình vector mới không phải thư viện cloud, không có hiệu ứng animation riêng, không thay cơ chế mask/crop và không triển khai Group/Ungroup lưu bền vững. Đó là những nhánh công việc độc lập cần API an toàn và kiểm thử riêng.
