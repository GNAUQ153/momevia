import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream';

// So sánh yếu cho If-None-Match của GET, không tách dấu phẩy bên trong entity-tag.
export function matchesEntityTag(header, etag) {
  if (typeof header !== 'string') return false;
  const value = header.trim();
  if (value === '*') return true;
  const token = /(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"/y;
  let offset = 0, matched = false;
  while (offset < value.length) {
    while (value[offset] === ' ' || value[offset] === '\t' || value[offset] === ',') offset++;
    if (offset === value.length) break;
    token.lastIndex = offset;
    const item = token.exec(value);
    if (!item) return false;
    matched ||= item[0].replace(/^W\//, '') === etag;
    offset = token.lastIndex;
    while (value[offset] === ' ' || value[offset] === '\t') offset++;
    if (offset < value.length && value[offset] !== ',') return false;
  }
  return matched;
}

// Chỉ dùng cho ảnh mẫu tĩnh công khai, sau khi đã xác thực ID và render thành công.
export function sendBuiltinThumbnail(req, res, bytes) {
  if (res.destroyed || res.writableEnded) return;
  const etag = `"${createHash('sha256').update(bytes).digest('hex')}"`;
  const headers = {
    'cache-control': 'public, no-cache',
    'etag': etag,
    'x-content-type-options': 'nosniff',
  };
  if (matchesEntityTag(req.headers['if-none-match'], etag)) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, { ...headers, 'content-type': 'image/webp', 'content-length': bytes.length });
  return res.end(bytes);
}

// Quyền truy cập phải được kiểm tra tại route trước khi gọi hàm này.
export function streamPrivateAsset(res, file) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  const source = createReadStream(file.filePath);
  // Pipeline đóng nguồn khi client ngắt và xử lý lỗi đọc tệp sau khi gửi header.
  pipeline(source, res, () => {});
  return source;
}
