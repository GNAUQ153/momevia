import { isIP } from 'node:net';

// Kiểm tra đường dẫn sau khi bỏ prefix /api/<service>.
export function isInternalRoute(route) {
  return /^\/internal(?:\/|$)/i.test(decodeURIComponent(route));
}

export function upstreamHeaders(req, target) {
  const headers = {
    ...req.headers,
    host: `127.0.0.1:${target}`,
    // Gateway là biên tin cậy: không nối tiếp IP do client tự khai báo.
    'x-forwarded-for': req.socket.remoteAddress || 'unknown',
  };
  delete headers['x-service-key'];
  delete headers['x-real-ip'];
  delete headers.forwarded;
  return headers;
}

export function clientIp(req) {
  const peer = req.socket.remoteAddress || 'unknown';
  const fromGateway = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
  const forwarded = req.headers['x-forwarded-for'];
  // Chỉ nhận một địa chỉ hợp lệ từ Gateway cùng máy; không nhận chuỗi IP.
  return fromGateway && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : peer;
}
