# Creator feedback / CI

Lỗi ban đầu: `tests/browser/creator-journey.mjs:364` chờ lý do `Kiểm tra lại bố cục bìa` hiển thị, nhưng Playwright báo phần tử `<p>` bị ẩn.

Thay đổi: thông báo phản hồi mới nhất xuất hiện riêng, ở phía trên khu vực tạo mẫu, và browser test kiểm tra thông báo hiển thị trực tiếp. Nếu mới nhất đã duyệt, thông báo cũ sẽ không hiển thị. Không dịch hoặc chỉnh sửa nội dung tự nhập.

Kiểm thử cục bộ:

```bash
node --test tests/unit/creator-review-feedback.test.mjs
npm run build
npm run check
npm test
npm run test:browser
npm run test:canvas:browser
npm run changelog:check
```

Không bỏ hoặc skip assertion. Nếu browser test vẫn thất bại, ghi nhận screenshot và computed style của thông báo trên CI để xác minh nguyên nhân ẩn thực tế.
