import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { staticFile } from '../../src/gateway/static.mjs';

// Kiểm chứng đường dẫn thư mục không gây lỗi stream làm sập máy chủ.
test('Static server trả 404 cho thư mục, trả 200 cho tài nguyên hợp lệ', async () => {
  const server = createServer((req, res) => {
    staticFile(req, res, new URL(req.url, 'http://localhost'));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/assets/', '/css/', '/js/']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 404, route);
    }
    const sheet = await fetch(`${base}/css/marketing-immersive.css`);
    assert.equal(sheet.status, 200);
    assert.match(sheet.headers.get('content-security-policy'), /object-src 'none'/);
    const head = await fetch(`${base}/css/marketing-immersive.css`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
