# Momevia — Fix release smoke-test Interactive Cards

## Nguồn lỗi

Cả workflow PR #22 (`45042423147`) và V10 (`45043859036`) thất bại ở bước `Verified release package / Verify packaged installation and regressions`, bài test `library rollout detects customization, supports interruption, idempotent rerun and revision rollback` (`tests/unit/interactive-cards.test.mjs:58–59`).

Bản source gốc có `database/updates/interactive-cards-20261122-v1.json` nhưng `scripts/release/package.mjs` chưa thêm file đó vào allowlist, nên file không có trong `dist/release-smoke` và `fs.readFileSync()` báo `ENOENT`.

## Thay đổi

- Allowlist chính xác 1 file JSON nguồn `database/updates/interactive-cards-20261122-v1.json` trong `scripts/release/package.mjs`.
- Bổ sung fixture và kiểm thử cho `tests/unit/release.test.mjs`: bắt buộc bundle được đóng gói, có checksum trong release manifest, file `database/updates/private-export.json` không được đưa vào gói.
- Bổ sung tài liệu và CHANGELOG. Không sửa `tests/unit/interactive-cards.test.mjs`, tránh xóa test bảo vệ quy trình rollout.

## Chạy xác nhận

```bash
npm ci
npm run build
npm run check
node --test tests/unit/release.test.mjs
npm run package
npm run verify:package
node --test tests/unit/interactive-cards.test.mjs
```

Kiểm tra file nguồn và bản phát hành:

```bash
ls database/updates/interactive-cards-20261122-v1.json
ls dist/release/database/updates/interactive-cards-20261122-v1.json
```

Sau khi chạy `npm ci` trong bản sao `dist/release-smoke` (không cài dependency vào `dist/release` đã đóng gói), hãy chạy `npm test` tại bản sao để xác minh release smoke. GitHub Actions thực hiện điều này theo workflow hiện có.

## Rủi ro và phạm vi

Bản phát hành tăng khoảng 1,2 MB dữ liệu update đã có trong repository. Release security policy vẫn loại trừ `.env`, secrets, thư mục `local`, và dữ liệu vận hành. Nếu có thay đổi mã ở `package.mjs` hoặc `release.test.mjs` trên `main`, không ghi đè thủ công; đối chiếu diff và kiểm tra lại.
