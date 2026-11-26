# Phase 3.6C — Cache & Asset Response

## Phạm vi

- Chỉ `GET /api/designs/library/templates/:id/thumbnail` sử dụng conditional response cho WebP mẫu tĩnh. ETag SHA-256 được tính trên chính bytes WebP, không phải URL hay ID người dùng. `public, no-cache` cho phép lưu nhưng yêu cầu xác thực lại trước mỗi lần tái sử dụng. ID, locale, variant và kích thước vẫn qua luồng tạo ảnh hiện tại trước khi kiểm tra ETag. HTTP 304 không có body, không trả Content-Length của ảnh.
- Cover động từ library, preview Creator, API JSON, bản nháp và thiệp riêng tư không được chuyển sang public cache. Không dùng ETag để bỏ qua authorization. Luồng file riêng tư tiếp tục dùng `private, no-store` và `nosniff`.
- Dùng Node pipeline cho file của Designs, Gift assets, Gift photo và Creator assets qua helper hiện tại. Khi response đóng sớm hoặc đọc file lỗi, pipeline giải phóng stream; không đọc cả file vào RAM. Nếu response đã kết thúc, không mở file.

## Giới hạn

ETag giảm số byte response khi client gửi validator hợp lệ; không loại bỏ request, đọc SVG, hash nội dung hoặc render khi cache miss. Không thay đổi proxy, Hostinger, cache API JSON, Range request hay cấu hình MySQL/Railway. Chưa đo mức giảm traffic/CPU/RAM thực tế. Không tạo migration hay dependency mới.

## Kiểm thử

```sh
node --test tests/unit/asset-response.test.mjs tests/unit/cover-thumbnail.test.mjs
npm run check:architecture
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Chỉ chạy integration test trên local/QA. Kiểm tra 200 có ETag, 304 body rỗng, thay đổi nội dung trả 200, invalid ID/size vẫn trả lỗi dù có validator; ảnh riêng tư vẫn trả no-store và không có ETag. So sánh số byte truyền và số request trên trình duyệt sau deployment, không suy ra mức tiết kiệm chi phí chỉ từ 304.
