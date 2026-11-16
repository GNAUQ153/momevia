import http from 'node:http';
import { upstreamHeaders } from '../shared/proxy.mjs';

export function proxy(req, res, target, route) {
  const options = {
    hostname: '127.0.0.1', port: target,
    path: route, method: req.method,
    headers: upstreamHeaders(req, target),
  };
  const upstream = http.request(options, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.setTimeout(30_000, () => upstream.destroy(new Error('Upstream timeout')));
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({error:'Dịch vụ đang khởi động hoặc tạm thời không khả dụng.'}));
    } else res.destroy();
  });
  req.pipe(upstream);
}
