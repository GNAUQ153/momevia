# CI và gói phát hành Momevia

Phạm vi thống nhất ngày 16/11/2026: CI và gói phát hành, chưa deploy hosting.

## Pipeline

`.github/workflows/ci.yml` chạy khi mở/cập nhật PR vào `main`, push vào `main`, hoặc chạy thủ công trong Actions.

1. Ma trận Windows/Linux, Node 22/24: `npm ci` → build QR cục bộ → kiểm tra cú pháp/YAML → audit dependency runtime → unit tests → HTTP regression và bốn smoke suite trên dữ liệu/cổng cô lập.
2. Khi toàn bộ ma trận đạt, push hoặc chạy thủ công trên `main` mới được đóng gói.
3. Gói nguồn được cài dependency và kiểm thử lại ngay trong `dist/release` để bắt lỗi thiếu file.
4. Upload `momevia-<commit>.tar.gz` thành artifact của workflow, lưu 14 ngày. Không tạo GitHub Release, không đưa dữ liệu lên hosting và không cần secret production.

Actions được pin bằng commit SHA; workflow chỉ có `contents: read`. PR không được xuất gói phát hành. Job package có `needs: test`, nên không chạy khi bất kỳ ô ma trận nào thất bại. Không dùng `pull_request_target` để chạy source từ PR.

## Chạy tại máy phát triển

```powershell
npm ci
npm run build
npm run check
npm test
npm run test:architecture
npm audit --omit=dev --audit-level=high
npm run package
npm run verify:package
tar --exclude=node_modules -czf dist/momevia-local.tar.gz -C dist/release .
```

`npm run package` tạo mới riêng thư mục đầu ra `dist/release`. Script dùng danh sách thư mục/file cho phép, bỏ `.env` thật, `.env.*` khác `.env.example`, mọi thư mục `data`, `node_modules`, log, file tạm và từ chối symbolic link. Không đọc/ghi lại dữ liệu nghiệp vụ nguồn. Chỉ cài dependency sau khi giải nén, trên đúng hệ điều hành đích vì sharp có binary riêng theo nền tảng.

`release-manifest.json` ghi phiên bản, commit nền, trạng thái working tree dirty và SHA-256 của từng file trong gói. Gói tạo từ WIP có `dirty: true`; không được coi commit nền là bằng chứng toàn bộ nội dung đã commit. File manifest không tự checksum chính nó. Khi cài dependency trong gói, danh sách file bổ sung trong `node_modules` không nằm trong manifest nguồn.

`npm run verify:package` đối chiếu checksum, từ chối đường dẫn vượt thư mục gói, file nguồn ngoài manifest và file secret/data/log/tạm chèn thêm. Đây là kiểm tra tính toàn vẹn, không phải chữ ký số xác thực người phát hành. Pipeline chạy bước này sau kiểm thử gói và trước khi nén.

## Kiểm tra gói trước khi dùng

Giải nén vào thư mục mới, không chép đè vào thư mục đang chứa dữ liệu. Chạy:

```powershell
npm ci
npm run check
npm test
npm run test:architecture
Copy-Item .env.example .env
```

Thay hai khóa ví dụ bằng hai khóa ngẫu nhiên riêng, mỗi khóa ít nhất 32 ký tự. Không dán giá trị khóa vào issue, log hoặc chat. Cấu hình OAuth nếu sử dụng. Để chạy local: `npm start`; mọi service hiện bind loopback.

Không dùng gói này làm bằng chứng sẵn sàng production: JSON chưa có transaction nhiều file, backup hay nhiều writer; chưa có cổng thanh toán thật, HA hoặc rate limit phân tán. Sau cập nhật phiên đăng nhập, người dùng cần đăng nhập lại; dữ liệu tài khoản/quà/đơn hàng cũ được giữ nguyên.

## Trạng thái bằng chứng

Kiểm thử local trên Windows được ghi trong `CODE_REVIEW_ARCHITECTURE.md`. Pipeline Linux/Node 22/24 và upload artifact chỉ được xem là PASS sau khi GitHub Actions thực sự chạy thành công. Việc chỉnh file workflow tại máy chưa kích hoạt pipeline, chưa đặt branch protection và chưa cấp quyền deploy. Khuyến nghị đặt các job ma trận làm required status checks của `main` sau lần chạy đầu tiên; thao tác này thuộc cấu hình repo trên GitHub.

Tài liệu tham khảo: [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data), [upload-artifact](https://github.com/actions/upload-artifact).
