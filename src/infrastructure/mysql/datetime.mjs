// Quy ước thời gian MySQL: cột DATETIME được đọc dưới dạng UTC.
// Giữ nguyên cách chuyển đổi lịch sử, kể cả lỗi với ngày không hợp lệ.
export function mysqlDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid MySQL datetime');
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

export function mysqlTimestampToIso(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}
