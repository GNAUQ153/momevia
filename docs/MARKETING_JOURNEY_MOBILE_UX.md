# Marketing Journey — Mobile UX

## Mục tiêu
Cải thiện trải nghiệm Create → Share → Open → Reply → Keep trên điện thoại mà không tác động vào dữ liệu người dùng, API hoặc Canvas Player.

## Thay đổi
- Ở màn hình tối đa 500px: năm bước chuyển sang thanh cuộn ngang, mỗi nút rộng ít nhất 112px và chữ 13px. Desktop giữ nguyên.
- Vuốt ngang trên thiệp minh họa để tiến/lùi một bước, với ngưỡng 48px; bỏ qua cuộn dọc, cử chỉ đa chạm và touchcancel. Không quay vòng ở đầu/cuối.
- Chỉ nút được chọn có `tabindex=0`; ArrowLeft/ArrowRight/Home/End giữ nguyên; cập nhật `aria-pressed` và panel `hidden` đúng bước.
- Thêm hướng dẫn vuốt song ngữ Việt–Anh; không dùng emoji hay thư viện JavaScript mới.
- Dùng `touch-action: pan-y` để không chặn cuộn dọc. Không can thiệp nội dung thiệp thật.

## Phạm vi kiểm thử
`node --test tests/unit/marketing-journey*.test.mjs`, `npm run check`, `npm run test:browser`, `npm run test:canvas:browser`, `npm run build`.
Kiểm tra tay ở 320/390/500/768px, VI/EN, Reduced Motion và Safari iOS/Chrome Android.

## Những giới hạn
Chưa có phép đo trên thiết bị thực tế hoặc xác nhận từ GitHub CI cho gói mới.
Công cụ hợp nhất dừng khi có xung đột; không đè source của các thành viên khác.
