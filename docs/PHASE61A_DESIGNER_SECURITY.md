# Phase 6.1a — Bảo trì Canvas Designer & an toàn release

## Thực hiện

- Tách nhóm hằng số/tiện ích UI độc lập khỏi `web/js/pages/designer.js` sang `web/js/features/canvas-editor/designer-helpers.js`.
- Không thay đổi giao thức Canvas V1/V2, Fabric patch, quyền Creator/ Sender, revision/CAS, autosave, API hay DB.
- Kiểm tra mọi thư mục trong manifest, không bỏ qua `node_modules` ẩn và từ chối cả thư mục dữ liệu không có file. Loại trừ `.git`, khóa riêng (`.key`, `.pem`, `.p12`, `.pfx`), `credentials*.json`, `service-account*.json`, `.npmrc`, bản sao dữ liệu, SQLite và backup nén ra khỏi `dist/release`.
- Chạy unit test cho module mới và policy, mở rộng test đóng gói/kiểm tra manifest hiện tại.

## Giới hạn

- Bộ lọc file theo tên không thể phát hiện bí mật bị nhúng trong một file có tên bình thường. Cần quét secrets bằng công cụ CI độc lập và quản lý secret trong môi trường triển khai.
- Không nên public ZIP source kể cả khi release manifest PASS; ZIP thủ công cần kiểm tra riêng hoặc chỉ chia sẻ file do Git quản lý sau khi audit.
- Không sửa `package-lock.json`, không thêm dependency, không thay đổi billing/webhook/roles.
- **Không cam kết bản vá tương thích với mọi thay đổi trên `main`.** Installer từ chối ghi khi SHA-256 không khớp; cần merge thủ công nếu đồng đội sửa cùng file.

## Kiểm thử đề xuất trên máy Windows

```bash
node --test tests/unit/designer-helpers.test.mjs tests/unit/release-security-61.test.mjs tests/unit/release.test.mjs
npm run build && npm run check && npm test && npm run test:architecture && npm run test:canvas:browser && npm run test:templates && npm run package && npm run verify:package
```

Sau khi PASS, nghiệm thu Canvas trên 320, 390, 768 và 1440 px; thử thay ảnh, zoom, bấm phím tắt khi đang nhập, sửa và khôi phục nháp. Kiểm tra thêm quyền Sender/Creator và gói release không chứa dữ liệu cá nhân.

## Backlog Phase 6.1b

- Tách orchestration, Inspector, scenes, asset upload và xử lý event khỏi `designer.js` theo từng contract và integration test.
- Thêm browser E2E theo ma trận Sender/Creator/Recipient, kiểm tra autosave khi mất mạng, mốc revision và tài nguyên riêng tư.
- Thêm secret scanning trong CI, dependency/SBOM review và thử nghiệm security bằng môi trường staging.
