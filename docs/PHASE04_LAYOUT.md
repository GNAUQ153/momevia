# Phase 4.3A — Layout Foundation

## Phạm vi

`tokens.css` bổ sung thang 4px, token container, khoảng cách section, Hero, card, độ bo góc và bóng đổ. Các token ứng dụng cũ (`--radius-*`, `--shadow-*`, `--ui-control-min-height`) giữ nguyên. `--container` trỏ đến `--layout-max` (1190px). Gutter tại các breakpoint 900/680/370px giữ nguyên giá trị 22/17/13px mỗi bên, desktop 36px mỗi bên. Không sửa breakpoint hoặc thứ tự nạp CSS.

Marketing sử dụng khoảng cách section 32–48px thay cho 28–44px, card 20px với góc trong 19px, Hero stage 24px, Journey showcase 28px, CTA Hero 12px; CTA giữ min-height 48px. Bóng đổ card mặc định/hover và showcase dùng token chung; không đổi hiệu ứng tilt, carousel, cấu trúc DOM hoặc logic nghiệp vụ. Giữ nguyên chiều rộng và thứ tự cột carousel 3/2/1. Hộp thoại chọn loại thiệp dùng token spacing/radius; không thay đổi lựa chọn hoặc hành vi. Các file CSS sửa được đổi cache version. Chưa chuyển toàn bộ Auth, Dashboard, Canvas sang token layout mới.

## Kiểm thử

```bash
node --test tests/unit/brand-layout.test.mjs
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Kiểm tra browser trên 320/370/390/680/768/900/1024/1440px, VI/EN, gồm gutter, CTA Hero, carousel, hộp thoại tạo thiệp, Journey, focus, reduced motion và không tràn ngang. Các assertion source không thay cho browser; nếu chưa chạy browser thật thì chưa nghiệm thu pixel/layout. Dùng demo local/QA độc lập, không dùng database production. Không cần migration, dependency, thay font hoặc cấu hình Railway. Push main có thể kích hoạt backend redeploy nếu bật auto-deploy. Chỉ upload gói frontend mới sau khi nghiệm thu giao diện.
