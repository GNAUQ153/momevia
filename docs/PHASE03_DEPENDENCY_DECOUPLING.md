# Phase 3.2A — Tách phụ thuộc cấu hình và nghiệp vụ

## Phạm vi

- `src/shared/feature-config.mjs` sở hữu hai hàm đọc chính sách cấu hình gia hạn và quota QA; giữ nguyên toàn bộ điều kiện, mặc định, thông báo lỗi và đường import cũ (`renewal.mjs`, `quota-config.mjs` re-export).
- `src/shared/credential-policy.mjs` sở hữu chuẩn hóa email và kiểm tra mật khẩu, giữ nguyên `HttpError`, status và messageKey. `CredentialsService` vẫn sở hữu đăng ký, đăng nhập, hash, giới hạn scrypt và repository; giữ các method công khai. `testAccountConfig` gọi policy trực tiếp, không tạo instance service không có repository.
- Sửa thông báo lỗi `TEST_ACCOUNT_PASSWORD` từ 10 thành 8 ký tự cho đúng giới hạn đã thực thi từ trước; không nới lỏng hay siết chặt quy tắc mật khẩu.
- Checkout, Gifts và Designs đọc quota từ shared, không phụ thuộc vào Checkout chỉ để đọc cấu hình. Không đổi API, schema, SQL, dữ liệu, cấu hình Railway, frontend, dependency hoặc quyền lợi khách hàng.

## Kết quả kiến trúc

| Chỉ số AST trong phạm vi Phase 3.1 | Trước | Sau |
| --- | ---: | ---: |
| Nhóm vòng import tĩnh | 1 | 0 |
| Cạnh thuộc vòng tĩnh | 4 | 0 |
| Cạnh vi phạm ranh giới | 3 | 0 |
| Cạnh import tĩnh nội bộ | 948 | 951 |
| File backend | 112 | 114 |
| Class backend | 42 | 42 |

Số cạnh tĩnh tổng tăng do tách module và giữ re-export tương thích, không phải giảm mọi coupling. `docs/architecture-baseline.json` được thu hẹp về hai mảng rỗng; không cho phép tái đưa các cạnh vi phạm cũ vào. Phạm vi audit không bao phủ import runtime không xác định, package ngoài hoặc toàn bộ kiến trúc triển khai. Đây không phải chứng nhận an ninh thông tin.

## Nghiệm thu

```bash
npm run check:architecture
node --test tests/unit/phase03-dependency-decoupling.test.mjs
npm run build
npm run check
npm test
npm run test:architecture
npm run test:browser
npm run test:canvas:browser
```

Các test mới dùng cấu hình giả lập, tiến trình con trong thư mục tạm và AST; không gọi database/provider. Giữ nguyên `PAYMENT_SCOPED_CHECKOUT_ENABLED=false`, `PUBLICATION_QUOTA_QA_ENABLED=false`, `GIFT_RENEWAL_DAYS=0` theo chính sách triển khai hiện tại. Không bật refund QA trên Railway. Không cần chạy migration hoặc upload frontend chỉ cho bản refactor này.
