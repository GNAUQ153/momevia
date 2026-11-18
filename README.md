# Momevia

Momevia là ứng dụng web tạo quà tương tác. Creator thiết kế mẫu và gửi duyệt. Sender chọn phiên bản đã duyệt, thay ảnh và lời chúc rồi gửi qua link hoặc QR. Người nhận mở quà và hồi đáp trên web. Thư viện có 12 mẫu tích hợp bên cạnh mẫu của Creator.

## Chạy ứng dụng

Dùng Node.js 22.13 trở lên trong nhánh 22 hoặc Node.js 24 trở lên.

```powershell
npm ci
npm run build
npm start
```

Mở [localhost:4100](http://localhost:4100). JSON là mặc định. Xem [vận hành, MySQL và CI/CD](docs/OPERATIONS.md) khi cấu hình phiên, reverse proxy, kho dữ liệu hoặc migration.

## Thử toàn bộ hành trình

```powershell
npm run demo:web
```

Mở [web demo](http://127.0.0.1:4110). Bộ khởi tạo tạo ba tài khoản, mẫu chờ duyệt, mẫu V1/V2, nháp, quà, hồi đáp và báo cáo. Nếu cổng 4110 đang dùng, mở bản demo đang chạy hoặc chọn cổng khác bằng `npm run demo:web -- --port 4112`. [Tài khoản và các bước thử](docs/DEMO_WEB.md)

## Kiểm tra thay đổi

```powershell
npm run check
npm test
npm run test:templates
npm run test:architecture
npm run test:canvas
```

Với thay đổi UI, chạy `npm run test:browser` và `npm run test:canvas:browser`. Với thay đổi quyền, phiên bản, SQL hoặc xuất bản, chạy thêm hai gate MySQL cô lập. [Hướng dẫn kiểm thử](docs/OPERATIONS.md#ci-và-phát-hành)

## Tài liệu

- [Dùng canvas, gửi và quản lý quà](docs/CANVAS_SENDER_GUIDE.md)
- [Kiến trúc](docs/ARCHITECTURE.md) và [API](docs/ENDPOINTS.md)
- [Kịch bản beta, ghi tay và đo lường](docs/SENDER_CREATOR_BETA.md)
- [Mục lục tài liệu](docs/README.md)
