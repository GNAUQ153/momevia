# Phase 3.7A — Rà soát module và export dư thừa

## Cách chạy

```bash
npm run --silent audit:unused
```

Lưu báo cáo ngoài source hoặc trong `dist/reports/` (tạo thư mục trước).
Công cụ chỉ đọc mã nguồn và phân tích AST bằng Acorn hiện có. Không import hoặc
thực thi module được quét, không đọc `.env`, không kết nối MySQL hay gọi API.
Không tự xóa file, không làm CI thất bại vì có ứng viên. Lỗi parse vẫn làm lệnh thất bại.

## Phạm vi và cách đọc

- Mục tiêu: `src/` và `web/js/`, bỏ vendor. Consumer: hai thư mục trên,
  `web/assets/moments`, `services`, `scripts`, `tests`, `database/scripts`,
  cùng `dev.mjs`, `gateway.mjs`, `eslint.config.mjs`. Bỏ symlink và path ngoài
  chính sách source/release. Không quét bundle sinh ra hoặc dữ liệu khách hàng.
- `noIncoming`: module không có cạnh import/re-export đi vào trong graph đã quét,
  sau khi loại entry trực tiếp từ `web/index.html` và script npm nhận diện được.
  Không phải phép phân tích reachability đầy đủ từ mọi entry.
- `noObservedConsumer`: export tường minh chưa thấy consumer trong phạm vi quét.
- `testOnly` / `toolOrTestOnly`: consumer trực tiếp chỉ từ test hoặc tool/test;
  không có nghĩa là toàn bộ module không dùng ở runtime.
- `opaqueModules`: có namespace import, dynamic import literal hoặc export sao
  khiến không thể xác định từng binding an toàn. Giữ toàn bộ export liên quan.
- `unknownDynamic`: vị trí import động chưa xác định được tên file bằng literal.
- `unresolved`: đường dẫn tương đối hoặc URL nội bộ không thuộc graph đã quét;
  có thể là JSON, vendor, file sinh khi build, hoặc tham chiếu cần rà soát.

Import có tên được tính là consumer kể cả binding không được đọc. Re-export có tên
được tính là consumer trực tiếp kể cả wrapper chưa được sử dụng. Công cụ không
phân tích mọi chuỗi, URL, cấu hình triển khai, import qua biến, mã ngoài repo hay
API truy cập từ browser cũ. Không chứng minh một export hoặc module là dead code.

## Kết quả trên baseline tái dựng

Bản đầu (trước thu hẹp export): 653 module quét, 334 module mục tiêu, 933 export
tường minh, 20 export chưa thấy consumer. Sau thay đổi và thêm test: 654 module,
334 mục tiêu, 931 export tường minh, 18 export chưa thấy consumer. Số liệu có
thể khác trên checkout đã build hoặc release. Có 20 import động chưa xác định,
27 tham chiếu ngoài graph, 53 module có consumer/export không rõ từng binding.

5 module không có cạnh đi vào: `web/js/api.js`, `catalog-filter.js`, `icons.js`,
`legal.js`, `qr.js` (cùng thư mục). Tất cả được ghi rõ là compatibility module;
giữ nguyên để tránh phá import cũ ngoài graph. Giữ 98 export chỉ thấy consumer
test và 17 export chỉ thấy consumer tool hoặc test; không xóa test hook.

Chỉ thu hẹp `NAME_LIMIT` trong `recipient-naming.js` và `CANVAS_VERSIONS` trong
`canvas/schema.js` thành hằng nội bộ. Rà soát tên trong source/test/tool/docs cho
thấy chỉ có khai báo và sử dụng nội bộ. Không đổi giá trị, validation, schema
version hay HTTP contract. Không bảo đảm tương thích cho consumer ESM bên ngoài
repo chưa được cung cấp; nếu có consumer như vậy cần giữ export.

## Nghiệm thu

```bash
node --test tests/unit/phase03-unused-audit.test.mjs tests/unit/phase03-architecture-audit.test.mjs tests/unit/recipient-naming.test.mjs tests/unit/canvas-schema.test.mjs
npm run check:architecture
npm run build && npm run check && npm test
npm run package && npm run verify:package
```

Không xóa 18 ứng viên còn lại theo báo cáo tự động. Review thủ công cả reference
động, lịch sử và test chức năng; loại bỏ từng phần trong patch riêng.
