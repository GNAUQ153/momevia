import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Cập nhật mục Unreleased một lần để README Auto Sync lấy đúng chức năng mới.
const changelogPath = fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url));
const original = fs.readFileSync(changelogPath, 'utf8');
const marker = '## Unreleased — Marketing UI & Payment Status (2026-11-18)';

if (original.includes(marker)) {
  console.log('CHANGELOG đã có mục Marketing UI; không thêm trùng.');
} else {
  // Giữ xuống dòng của dự án trên Windows (CRLF) hoặc Linux (LF).
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = [
    marker,
    '',
    '- Nâng cấp trang chủ phục vụ marketing: lợi ích thật, mô tả tương tác, FAQ và CTA rõ ràng.',
    '- Tách CSS mới theo thành phần, breakpoint và màn hình thanh toán; SVG Lucide (ISC/MIT), không dùng emoji.',
    '- Trình bày trạng thái đơn hàng pending/paid và cảnh báo không thanh toán lại khi chưa được provider xác nhận.',
    '- Bổ sung kiểm thử nội dung, chống tràn mobile, giảm chuyển động và tài liệu giấy phép open source.',
    '- Chưa mở API hủy/retry/refund tự động; yêu cầu kiểm thử merchant sandbox và quy trình đối soát tiền chuyển muộn.',
    '',
  ];
  fs.writeFileSync(changelogPath, lines.join(newline) + newline + original, 'utf8');
  console.log('Đã cập nhật CHANGELOG. README Auto Sync sẽ đọc phần Unreleased sau khi CI đạt.');
}
