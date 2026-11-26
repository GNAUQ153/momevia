# Phase 4.3D — Typography Scale

Thang chữ dùng chung cho trang chủ, danh mục, bảng giá và hộp thoại tạo thiệp ở trang chủ. Cỡ chữ gốc 16px là giả định để minh họa các khoảng dưới đây; không ép `html` về 16px.

| Token | Khoảng ở root 16px | Vai trò |
| --- | --- | --- |
| `--type-display` | 36–72px | Hero |
| `--type-h1` | 30–48px | Catalog, Pricing |
| `--type-h2` | 24–36px | Section, FAQ |
| `--type-h3` | 20–26px | Tiêu đề nhóm, dialog |
| `--type-card` | 18–22px | Tiêu đề mẫu |
| `--type-lead` | 16–18px | Giới thiệu |
| `--type-body` | 16px | Nội dung chính |
| `--type-small` | 14px | Mô tả ngắn |
| `--type-caption` | 13px | Nhãn phụ |

Dùng rem kết hợp vw trong clamp; chiều cao dòng không đơn vị (1.2/1.3/1.65). Không có CSS riêng cho VI và EN. Giữ artwork, font binary, token `--canvas-font-*`, Auth và Workspace. Không bỏ line clamp mô tả ngắn của Catalog hay thay đổi logic giá. Không đổi breakpoint bố cục. Cache bust các stylesheet đã sửa.

## Kiểm thử

```bash
node --test tests/unit/brand-type-scale.test.mjs
npm run fonts:check
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Các test token và cascade là kiểm tra source, không chứng minh layout thực tế. Nghiệm thu trên Chrome/Edge/Safari: VI/EN, 320/390/768/1024/1440px, zoom 200%, cỡ font mặc định tăng, tiêu đề dài và chữ có dấu (Ấm áp, Đường phố, Nguyễn, Ữ). Kiểm tra text không bị che, CTA còn thao tác được, không tràn ngang ngoài vùng cuộn chủ đích, giá và nhãn vẫn đọc được. So sánh Canvas cũ, Auth và chức năng Creator trước/sau. Chưa tuyên bố đạt WCAG toàn website.
