# Phase 4.3E — Component Regression & Accessibility

- Liên kết bỏ qua điều hướng chuyển focus vào main, cuộn ngay, không thay đổi URL/history khi kích hoạt thông thường. Liên kết vẫn có href gốc.
- Modal app shell cô lập main, header, footer, công cụ hỗ trợ và CTA nổi; khôi phục trạng thái inert trước khi mở. Không sửa native dialog của Canvas. Toast live region vẫn độc lập.
- Tắt cuộn mượt CSS khi hệ điều hành yêu cầu giảm chuyển động; không tắt animation nội dung thiệp tùy tiện.
- Giữ font, bảng màu, nghiệp vụ và schema hiện tại; không thêm dependency.

## Kiểm thử

```bash
node --test tests/unit/brand-*.test.mjs
npm run build && npm run check && npm test
npm run test:browser
npm run package && npm run verify:package
```

Browser home kiểm tra skip link VI/EN ở desktop và mobile, focus main, URL không đổi và reduced motion. Browser smoke kiểm tra inert của các vùng nền khi mở QR modal và sau Escape. Chạy với fixture độc lập, không dùng MySQL production.

## Nghiệm thu thủ công còn lại

- Tab/Shift+Tab/Escape, focus không bị header che, focus trả về nơi mở dialog; kiểm tra cả native Canvas dialog riêng.
- Chrome/Edge/Safari, 320px trở lên, browser zoom thật 200%, reflow, dấu tiếng Việt và bố cục EN. Kiểm tra NVDA/VoiceOver, các cặp màu có gradient và chế độ giảm chuyển động bật/tắt.
- Không coi kiểm tra tự động là chứng nhận WCAG 2.2 AA. Chưa nghiệm thu mọi route, thiết bị và assistive technology.

## Hotfix 4.3E.1

- Modal, animation di chuyển từ Hero và animation ra/vào CTA dùng khóa inert theo từng chủ sở hữu. Chỉ khôi phục trạng thái ban đầu khi tất cả đã nhả khóa.
- Giữ assertion Browser Smoke cho CTA và bổ sung unit test về thứ tự mở/đóng modal, hủy và hoàn tất animation.
