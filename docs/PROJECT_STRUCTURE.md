# Cấu trúc dự án Momevia v0.6.0

```text
momevia/
├── src/
│   ├── bootstrap/
│   │   ├── start.mjs                # khởi động mặc định, một process
│   │   ├── legacy.mjs               # wrapper topology cũ để kiểm thử
│   │   └── start-legacy.mjs         # launcher 6 process lịch sử
│   ├── server/
│   │   └── app.mjs                  # composition root + HTTP server
│   ├── modules/
│   │   ├── identity/                # credentials, sessions, role, OAuth
│   │   ├── catalog/                 # mẫu, favorites, creator
│   │   ├── checkout/                # đơn mô phỏng, kiểm tra quyền mẫu
│   │   ├── gifts/                   # thiệp, ảnh, replies
│   │   └── support/                 # yêu cầu liên hệ
│   ├── shared/                      # HTTP router, auth, storage, limiter
│   └── gateway/                     # gateway cũ / static file helper
├── services/*/                     # legacy entrypoint + data JSON hiện tại
├── web/                            # frontend, CSS, assets và JS
├── tests/
│   ├── unit/                       # test đơn vị
│   ├── integration/                # modular và legacy fixture
│   ├── smoke/                      # regression API
│   └── browser/                    # Playwright
├── scripts/                        # build, release, kiểm tra chất lượng
├── docs/                           # tài liệu và giấy phép bên thứ ba
└── .github/workflows/ci.yml
```

## Quy ước lập trình

- Mỗi module giữ `app.mjs` (composition), `routes.mjs` (HTTP), `*.service.mjs` (OOP domain logic), `repositories.mjs` (persistence).
- `src/server/app.mjs` là nơi **duy nhất** nối các module trong runtime mặc định. Nghiệp vụ không được import thẳng repository của module khác.
- Route không truy cập trực tiếp data file. Qua constructor injection/service interface khi cần trao đổi giữa module.
- Khai báo JSON storage hiện tại được giữ nguyên tạm thời để không mất ID, tài khoản, đơn, thiệp và phản hồi đã có.
- Không bật cùng lúc `npm run dev` và `npm run dev:legacy` với cùng dữ liệu.

## Kiểm thử

```bash
npm ci
npm run build
npm run check
npm test
npm run test:architecture
```

Xem [kiến trúc đang chạy](ARCHITECTURE.md) và [tình trạng các tính năng](PRODUCT_SCOPE.md).
