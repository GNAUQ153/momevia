// Xuất báo cáo tài chính chỉ đọc. Không suy diễn thành quyền hoàn tiền hoặc rút tiền.
// CSV chỉ chứa cột được cho phép, không chứa dữ liệu cá nhân hay thông tin xác thực.
const MAX_EXPORT_ROWS = 100;
const SAFE_ISSUES = new Set(['intent', 'receipt', 'entitlement', 'creatorSale', 'split']);
const SAFE_PROVIDERS = new Set(['momo', 'payos']);

function safeText(value, maxLength = 160) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, maxLength);
}

function safeMoney(value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError('Invalid financial amount');
  return amount;
}

function safeDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '';
}

// Chặn CSV/Formula Injection kể cả khi chuỗi chứa dấu cách trước =, +, -, @.
// Bao toàn bộ trường bằng dấu nháy kép để giữ nguyên dấu phẩy và xuống dòng.
export function csvCell(value) {
  const raw = safeText(value, 200);
  const guarded = /^[\s\uFEFF]*[=+\-@]/u.test(raw) || /^[\t\r\n]/u.test(raw)
    ? `'${raw}` : raw;
  return `"${guarded.replaceAll('"', '""')}"`;
}

function serialize(columns, records) {
  return `\uFEFF${[columns.join(','), ...records.map(row => row.map(csvCell).join(','))].join('\r\n')}\r\n`;
}

function requireRecords(input) {
  if (!Array.isArray(input) || input.length > MAX_EXPORT_ROWS) throw new TypeError('Invalid report rows');
  return input;
}

// Danh sách ngoại lệ là ảnh chụp dữ liệu gần nhất; không phải toàn bộ lịch sử đối soát.
export function adminExceptionsCsv(audit) {
  if (audit?.scope !== 'internal_paid_order_exceptions') throw new TypeError('Unsupported audit scope');
  const rows = requireRecords(audit.records).map(row => [
    safeText(row.orderId, 100),
    SAFE_PROVIDERS.has(row.provider) ? row.provider : 'unknown',
    row.sandbox === true ? 'sandbox' : 'live',
    safeMoney(row.amountVnd),
    safeDate(row.createdAt),
    (Array.isArray(row.issues) ? row.issues : []).filter(issue => SAFE_ISSUES.has(issue)).join('|'),
  ]);
  return serialize(['order_id', 'provider', 'environment', 'amount_vnd', 'created_at_utc', 'issue_codes'], rows);
}

// Chỉ nhận danh sách sale đã xác nhận từ API của Creator đã xác thực.
export function creatorSalesCsv(statement) {
  if (statement?.scope !== 'verified_paid_sales' || statement.currency !== 'VND')
    throw new TypeError('Unsupported statement scope');
  const rows = requireRecords(statement.recent).map(row => [
    safeText(row.orderId, 100),
    safeText(row.templateId, 100),
    row.sandbox === true ? 'sandbox' : 'live',
    safeMoney(row.grossVnd),
    safeMoney(row.platformFeeVnd),
    safeMoney(row.creatorVnd),
    safeDate(row.bookedAt),
  ]);
  return serialize(['order_id', 'template_id', 'environment', 'gross_vnd', 'platform_fee_vnd', 'creator_vnd', 'booked_at_utc'], rows);
}

export function exportFileName(kind, date = new Date()) {
  if (!['creator-sales', 'admin-exceptions'].includes(kind) || !Number.isFinite(date.getTime()))
    throw new TypeError('Invalid export request');
  return `momevia-${kind}-${date.toISOString().slice(0, 10)}.csv`;
}

// Chỉ gọi từ click người dùng; không tự tải file khi ứng dụng khởi chạy.
export function downloadCsvFile(filename, content) {
  if (!/^momevia-(creator-sales|admin-exceptions)-\d{4}-\d{2}-\d{2}\.csv$/.test(filename))
    throw new TypeError('Invalid export file name');
  const objectUrl = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Cho trình duyệt một lượt event loop để bắt đầu tải trước khi thu hồi URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
