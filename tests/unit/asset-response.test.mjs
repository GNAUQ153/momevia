import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { matchesEntityTag, sendBuiltinThumbnail, streamPrivateAsset } from '../../src/shared/asset-response.mjs';

async function withServer(handler, run) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
function get(port, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('If-None-Match so sánh yếu, danh sách tag và wildcard', () => {
  for (const value of ['"abc"', 'W/"abc"', '"x,y", W/"abc"', ' * ', ', "abc", ,']) assert(matchesEntityTag(value, '"abc"'), value);
  for (const value of [undefined, '', '"ABC"', '"x,abc"', 'W/"abc" bad', '"abc" "x"', '*, "abc"', '"abc", invalid']) assert.equal(matchesEntityTag(value, '"abc"'), false, String(value));
});

test('Thumbnail trả HTTP 304 không body và giữ cache policy/ETag', async () => {
  const bytes = Buffer.from('test thumbnail');
  await withServer((req, res) => sendBuiltinThumbnail(req, res, bytes), async port => {
    const first = await get(port);
    assert.equal(first.status, 200);
    assert.equal(first.headers['cache-control'], 'public, no-cache');
    assert.equal(first.headers['content-type'], 'image/webp');
    assert.equal(first.headers['content-length'], String(bytes.length));
    assert.match(first.headers.etag, /^"[a-f0-9]{64}"$/);
    assert.deepEqual(first.bytes, bytes);
    for (const tag of [first.headers.etag, `W/${first.headers.etag}`, `"other,tag", ${first.headers.etag}`, '*']) {
      const next = await get(port, { 'If-None-Match': tag });
      assert.equal(next.status, 304);
      assert.equal(next.headers.etag, first.headers.etag);
      assert.equal(next.headers['cache-control'], first.headers['cache-control']);
      assert.equal(next.headers['content-length'], undefined);
      assert.equal(next.bytes.length, 0);
    }
  });
});

test('Thay đổi bytes thumbnail buộc trả 200 và validator mới', async () => {
  let bytes = Buffer.from('vi');
  await withServer((req, res) => sendBuiltinThumbnail(req, res, bytes), async port => {
    const first = await get(port);
    bytes = Buffer.from('en');
    const second = await get(port, { 'If-None-Match': first.headers.etag });
    assert.equal(second.status, 200);
    assert.notEqual(second.headers.etag, first.headers.etag);
    assert.deepEqual(second.bytes, bytes);
  });
});

test('File riêng tư vẫn no-store và không dùng validator', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'momevia-private-'));
  try {
    const filePath = join(dir, 'asset.bin'), bytes = Buffer.from('private fixture');
    await writeFile(filePath, bytes);
    await withServer((_req, res) => streamPrivateAsset(res, { filePath, contentType: 'application/octet-stream' }), async port => {
      const response = await get(port, { 'If-None-Match': '*' });
      assert.equal(response.status, 200);
      assert.equal(response.headers['cache-control'], 'private, no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers.etag, undefined);
      assert.deepEqual(response.bytes, bytes);
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Đóng response khi đang backpressure giải phóng file stream', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'momevia-stream-'));
  try {
    const filePath = join(dir, 'asset.bin');
    await writeFile(filePath, Buffer.alloc(1024 * 1024));
    const res = new Writable({ highWaterMark: 1, write(_chunk, _encoding, _callback) { this.emit('received'); } });
    res.writeHead = () => {};
    const received = once(res, 'received');
    const source = streamPrivateAsset(res, { filePath, contentType: 'application/octet-stream' });
    const closed = new Promise(resolve => source.once('close', resolve));
    await received;
    assert.equal(source.destroyed, false);
    res.destroy();
    await closed;
    assert.equal(source.destroyed, true);
    assert.equal(source.closed, true);
    assert.equal(source.fd, null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('File biến mất sau authorization không làm sập HTTP server', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'momevia-missing-'));
  try {
    const filePath = join(dir, 'missing.bin');
    await withServer((_req, res) => streamPrivateAsset(res, { filePath, contentType: 'application/octet-stream' }), async port => {
      await assert.rejects(get(port));
      await writeFile(filePath, 'ready');
      assert.equal((await get(port)).bytes.toString(), 'ready');
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Response đã đóng không mở file hoặc gửi thumbnail', () => {
  for (const state of [{ destroyed: true }, { writableEnded: true }]) {
    const res = { ...state, writeHead() { assert.fail('response already closed'); } };
    assert.equal(streamPrivateAsset(res, {}), undefined);
    assert.equal(sendBuiltinThumbnail({}, res, null), undefined);
  }
});
