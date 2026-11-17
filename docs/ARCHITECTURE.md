# Kiến trúc đang chạy — Momevia Modular Monolith (v0.8.0)

**Trạng thái:** Runtime mặc định sử dụng **1 backend process**. Từ v0.8 có **MySQL Foundation** và adapter MySQL **tùy chọn cho Support**; Identity, Catalog, Gifts, Checkout vẫn dùng JSON. **Chưa đủ điều kiện triển khai production**.

```mermaid
flowchart TB
    B[Browser / Web client] --> H[HTTP Server :4100]
    subgraph Backend[Modular Monolith - một Node.js process]
        H --> I[Identity Module]
        H --> C[Catalog Module]
        H --> O[Checkout Module]
        H --> G[Gifts Module]
        H --> S[Support Module]
        O -->|Port getTemplate| C
        G -->|Port getTemplate| C
        G -->|Port hasLicense| O
        C -->|Xác minh phiên trong process| I
        O -->|Xác minh phiên trong process| I
        G -->|Xác minh phiên trong process| I
        S -->|Xác minh phiên trong process| I
    end
    I --> DI[(identity JSON)]
    C --> DC[(catalog JSON)]
    O --> DO[(checkout JSON)]
    G --> DG[(gifts JSON / media)]
    S --> DS[(support JSON - mặc định)]
    S -. SUPPORT_STORAGE=mysql .-> MY[(MySQL 8.4 - Support)]
```

## Entry points

- `npm run dev` và `npm start` → `dev.mjs` → `src/bootstrap/start.mjs` → `src/server/app.mjs`, mặc định một HTTP listener `127.0.0.1:4100`.
- `PORT`/`HOST` hỗ trợ thay đổi điểm lắng nghe. Khi triển khai qua reverse proxy phải cấu hình `PUBLIC_BASE_URL`, HTTPS và trust boundary đúng.
- `npm run dev:legacy` khởi động topology 6 process **chỉ để kiểm tra tương thích**. Các entrypoint `services/*/server.mjs` và `src/gateway/*` giữ cho trường hợp này, không nên vận hành hai topology đồng thời trên cùng dữ liệu JSON.

## Composition root và ranh giới module

`src/server/app.mjs` tạo từng module rồi inject phụ thuộc theo hướng một chiều:

1. Identity cung cấp phương thức truy xuất phiên hiện hành (`SessionStore.find`). Các route có bảo vệ nhận `resolveUser` từ composition root.
2. Catalog cung cấp `getTemplate` cho Checkout và Gifts; không còn gọi HTTP `4102` trong runtime mới.
3. Checkout cung cấp `hasLicense` cho Gifts; không còn gọi HTTP `4104` trong runtime mới.
4. Các lớp `Service`, `Repository` và API contract của frontend vẫn giữ nguyên.

Factory `createApp` của Identity và `createHttpApp` trả Promise; entrypoint phải `await` để hoàn tất việc tạo tài khoản mẫu từ `TEST_ACCOUNT_*` trước khi mở HTTP listener. Tài khoản được lưu trong `users.json` hiện có với `passwordHash` và metadata `testAccount.source = "env"`; không có kho tài khoản riêng. Xem [cấu hình tài khoản mẫu](../README.md#tài-khoản-mẫu-qua-env).

`src/shared/http.mjs` có `Router.handle` để ghép nhiều router vào một HTTP server. Server gốc nhận đúng tiền tố `/api/auth`, `/api/catalog`, `/api/checkout`, `/api/gifts`, `/api/support`. Server chỉ chấp nhận các HTTP method cũ và tiếp tục chặn namespace `/internal`, request POST cross-origin và các forwarded headers do client tự khai.

## Bảo mật và nhất quán

- Mỗi request cần đăng nhập đều truy vấn `SessionStore.find` trong tiến trình để kiểm tra chữ ký, JTI đã thu hồi, hạn sử dụng và role **mới nhất**, thay vì tin role nằm sẵn trong JWT.
- Không còn HTTP session introspection nội bộ ở runtime mặc định, nhưng legacy adapter vẫn tồn tại. Điều này không làm mất chức năng logout/revoke.
- Tốc độ tăng, khả năng chịu tải và độ an toàn dữ liệu **chưa được benchmark**. Identity/Catalog/Gifts/Checkout vẫn lưu JSON ở `services/*/data/`; riêng Support có thể dùng MySQL qua `SUPPORT_STORAGE=mysql`. Chưa có transaction nghiệp vụ xuyên module hoặc nhiều instance an toàn.
- Không chạy server legacy và modular cùng lúc trên cùng tập file dữ liệu.

## Kiểm thử và tiếp tục phát triển

```bash
npm ci
npm run build
npm run check
npm test
npm run test:architecture
```

`test:architecture` chạy **một backend process** trên port ngẫu nhiên với dữ liệu riêng trong thư mục tạm, kiểm tra API, phân quyền, phiên và nhiều luồng nghiệp vụ. `test:architecture:legacy` dành cho topology cũ. Browser tests dùng `npm run test:browser` khi Playwright/browser đã được cài.

**Bước tiếp theo:** Xác minh migration và adapter trên MySQL 8.4 thật (xem [hướng dẫn setup](MYSQL_SETUP.md)), sau đó chuyển Identity/Catalog/Gifts/Checkout từ JSON sang MySQL theo từng module, có backup và kiểm thử transaction; chỉ sau đó mới tích hợp thanh toán thật, webhook idempotent và worker gửi lời mời.
