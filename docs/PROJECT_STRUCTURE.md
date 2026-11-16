# Cấu trúc dự án Momevia

Ngày đối chiếu: 16/11/2026. Đợt này tách mã nguồn theo trách nhiệm, giữ API và mô hình chạy hiện tại. Chưa gộp service, đổi DB hoặc di chuyển dữ liệu nghiệp vụ.

```text
momevia/
├── src/
│   ├── bootstrap/start.mjs       # khởi động các process
│   ├── gateway/                  # dispatch HTTP, proxy, static assets
│   ├── modules/
│   │   ├── identity/             # tài khoản, OAuth, phiên và role
│   │   ├── catalog/              # mẫu, kiểm duyệt và favorites
│   │   ├── checkout/             # đơn demo và license
│   │   ├── gifts/                # thiệp, phản hồi và ảnh
│   │   └── support/              # yêu cầu hỗ trợ
│   └── shared/                   # HTTP, security, config, storage, paths, limiter
├── web/
│   ├── js/
│   │   ├── app/main.js           # điều hướng, sự kiện và điều phối API
│   │   ├── core/                 # API client và state
│   │   ├── pages/                # các hàm dựng trang
│   │   ├── ui/                   # layout, icon và thành phần dùng lại
│   │   ├── features/catalog/     # lọc/phân trang
│   │   ├── features/gifts/       # QR cục bộ
│   │   └── vendor/               # module QR sinh bởi build, không track
│   ├── css/                      # các vùng CSS hiện có
│   └── assets/                   # ảnh/nhận diện
├── tests/
│   ├── unit/                     # kiểm thử độc lập
│   ├── integration/              # fixture HTTP sáu process, data/cổng riêng
│   ├── smoke/                    # các smoke suite có thể chạy riêng
│   └── browser/                  # Playwright trên fixture cô lập
├── scripts/
│   ├── build/                    # tạo module QR
│   ├── quality/                  # cú pháp, lint/scope, YAML và build integrity
│   ├── release/                  # đóng gói và kiểm tra manifest
│   └── dev/                      # tạo tài khoản QA theo yêu cầu
├── services/<service>/
│   ├── server.mjs                # chuyển tiếp lệnh khởi động cũ
│   └── data/                     # dữ liệu local hiện hữu, ignored
├── docs/                         # tài liệu hiện hành và license
├── .github/workflows/ci.yml
├── dev.mjs                       # entrypoint tương thích npm start/dev
├── gateway.mjs                   # entrypoint Gateway tương thích
├── eslint.config.mjs
├── package.json / package-lock.json
├── dist/                         # gói sinh ra, ignored
└── local/                        # snapshot mã WIP/đồ thị/QA, ignored
```

## Một module backend được tổ chức thế nào?

| File | Trách nhiệm |
|---|---|
| `server.mjs` | Mở cổng; không chứa nghiệp vụ |
| `app.mjs` | Khởi tạo repository, limiter, client và service; đăng ký route |
| `routes.mjs` | Nhận HTTP, đọc body/session, gọi service và trả response |
| `*.service.mjs` | Quy tắc nghiệp vụ và kiểm soát quyền theo nghiệp vụ |
| `repositories.mjs` | Khởi tạo các kho dữ liệu mà module sở hữu |
| `client.mjs` nếu có | Hợp đồng gọi module khác qua HTTP hiện tại |
| Adapter chuyên biệt | Ví dụ `gifts/media.repository.mjs` sở hữu đọc/ghi file ảnh |

Service nghiệp vụ nhận repository/client qua constructor thay vì tự mở server hoặc đóng cứng lời gọi HTTP bên trong. `app.mjs` là nơi lắp ráp phụ thuộc. Điều này giúp có thể đổi adapter HTTP sang lời gọi trong cùng process ở một đợt chuyển sang modular monolith sau, mà vẫn giữ các ranh giới nghiệp vụ.

Identity có các service nhỏ riêng: credentials, sessions và roles. Catalog giữ favorites trong service riêng; Gifts giữ pipeline kiểm tra/encode ảnh trong `photo.mjs`. Không tạo thêm thư mục/lớp trống chỉ để đủ một mẫu kiến trúc.

## Tương thích và dữ liệu

- Các URL API, cổng 4100–4105 và lệnh npm hiện có được giữ.
- `dev.mjs`, `gateway.mjs`, `services/*/server.mjs` chỉ chuyển tiếp sang nguồn trong `src`. Không đặt logic mới ở các file tương thích này.
- Các URL module frontend cũ như `/js/app.js`, `/js/api.js`, `/js/icons.js` vẫn hợp lệ cho client đang cache. Nội dung thực nằm trong các thư mục trách nhiệm mới.
- Dữ liệu giữ ở `services/*/data/`. `src/shared/paths.mjs` định vị cùng đường dẫn cũ từ project root; không dựa vào vị trí của file class mới.
- Không đổi ID, slug, role đã lưu, password hash, license hoặc thời hạn thiệp. Không chạy ứng dụng/seed trên dữ liệu thật để kiểm thử refactor.
- `local/refactor-before/` là snapshot mã WIP trước sắp xếp; `local/data-before-refactor.json` chỉ lưu hash để đối chiếu, không chứa bản sao dữ liệu nghiệp vụ. Đây là tài nguyên QA local, không phải backup DB production.
- Hướng dẫn UPDATE cũ và bản review ban đầu lưu nguyên bản tại `local/archive/docs/`, không track hoặc đóng gói. Các file tài liệu hiện hành và license vẫn giữ trong Git.

## Kiểm thử

```powershell
npm ci
npm run build
npm run check
npm test
npm run test:architecture
```

Node hỗ trợ công cụ hiện tại: 22.13+ trong nhánh 22 hoặc 24+. `npm run check` kiểm tra cú pháp, định danh/import qua ESLint, YAML và nội dung QR build. Unit và HTTP không đòi hỏi browser.

Để chạy browser trên Windows có Microsoft Edge:

```powershell
$env:BROWSER_CHANNEL='msedge'
npm run test:browser
Remove-Item Env:BROWSER_CHANNEL
```

Trên máy chưa có browser tương ứng, cài Chromium bằng `npx playwright install chromium` rồi chạy `npm run test:browser`. Browser test dùng fixture riêng, chặn tài nguyên mạng ngoài; không kiểm chứng font/logo ngoài, OAuth thật hoặc mọi tổ hợp màn hình. `smoke:ui` vẫn chỉ là smoke HTTP.

Xem [đánh giá kiến trúc và DB](ARCHITECTURE_OPTIONS.md), [kiến trúc đang chạy](ARCHITECTURE.md), [CI/gói phát hành](CI_RELEASE.md).
