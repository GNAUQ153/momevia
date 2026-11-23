# Momevia V14.1 — Browser regression fix

## Lỗi quan sát từ GitHub Actions

Workflow `45053816145` Node 24 Linux có `npm ci`, `npm run build`, `npm run check`, `npm audit` và 707 unit tests thành công. Bước `npm run test:browser` dừng tại `tests/browser/home.mjs:160` với lỗi `locator.getAttribute: Timeout 30000ms exceeded` khi tìm `getByRole('dialog').locator('[data-template-use]')`.

## Nguyên nhân

Trong bài test trang chủ ở viewport mobile 390px, assertion CTA được thực hiện **trước** khi `preview.focus()` và `page.keyboard.press('Enter')`. Dialog đang đóng nên Playwright không tìm thấy dialog trong accessibility tree mặc định.

## Sửa đổi

- Chuyển assertion CTA xuống sau lệnh mở hộp thoại bằng bàn phím.
- Thêm `await dialog.waitFor({ state: 'visible' })` và `await useTemplate.waitFor({ state: 'visible' })` để đồng bộ rõ ràng với vòng đời dialog.
- Bổ sung guard test ở `tests/unit/template-preview-create-v14.test.mjs` để phát hiện trường hợp assertion đặt trước thao tác mở dialog.
- Không sửa production frontend, backend, dữ liệu người dùng hoặc migration.

## Kiểm thử trên máy có dependencies

```bash
npm ci --include=dev
npm run build
npm run check
node --test tests/unit/template-preview-create-v14.test.mjs
npm run test:browser
npm test
```

Sau khi tất cả PASS mới commit và push. Không đánh dấu đã PASS browser nếu chưa chạy Playwright thật.
