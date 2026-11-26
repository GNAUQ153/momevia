import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { loadConfig, runBackendLoad, summarizeLoad } from '../../scripts/quality/backend-load.mjs';
import { sendBuiltinThumbnail } from '../../src/shared/asset-response.mjs';

const confirm = { MOMEVIA_LOAD_LOCAL_QA: 'true' };
const sampleImage = Buffer.from('sample-webp-fixture');
async function withServer(handler, work) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await work({ port: server.address().port, requests: 4, concurrency: 2, timeoutMs: 1000 });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
function normal(req, res) {
  if (req.url.includes('/thumbnail?')) return sendBuiltinThumbnail(req, res, sampleImage);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end('{}');
}

test('Yêu cầu opt-in và chỉ nhận cổng hợp lệ, giới hạn tải hữu hạn', () => {
  assert.throws(() => loadConfig({}), /Local\/QA/);
  assert.deepEqual(loadConfig(confirm), { port: 4116, requests: 20, concurrency: 2, timeoutMs: 5000 });
  for (const [name, value] of [['PORT', 'https://momevia.io.vn'], ['PORT', '65536'], ['REQUESTS', '101'], ['REQUESTS', '0'], ['CONCURRENCY', '11'], ['TIMEOUT_MS', 'NaN'], ['TIMEOUT_MS', '10001']]) {
    assert.throws(() => loadConfig({ ...confirm, [`MOMEVIA_LOAD_${name}`]: value }));
  }
});

test('Percentile nearest rank chỉ dùng mẫu thành công; không giấu lỗi', () => {
  const samples = [1, 2, 3, 4].map(elapsedMs => ({ status: 200, bytes: 10, elapsedMs, error: null }));
  samples.push({ status: 503, bytes: 4, elapsedMs: 100, error: 'unexpected_response' });
  const result = summarizeLoad(samples, 100);
  assert.deepEqual(result.latencyMs, { p50: 2, p95: 4, p99: 4 });
  assert.equal(result.failed, 1);
  assert.equal(result.bodyBytes, 44);
  assert.equal(result.requestsPerSecond, 50);
  assert.deepEqual(result.status, { 200: 4, 503: 1 });
  assert.equal(summarizeLoad([samples.at(-1)], 100).latencyMs.p95, null);
});

test('HTTP thật: 5 kịch bản, VI/EN, 304 không có body, concurrency giới hạn', async () => {
  let active = 0, peak = 0, total = 0;
  const locales = new Set();
  await withServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.headers.cookie, undefined);
    if (req.headers['x-momevia-locale']) locales.add(req.headers['x-momevia-locale']);
    total++;
    peak = Math.max(peak, ++active);
    setTimeout(() => { active--; normal(req, res); }, 10);
  }, async config => {
    const report = await runBackendLoad(config);
    assert.equal(report.ok, true);
    assert.equal(report.scenarios.length, 5);
    assert.equal(total, 21);
    assert.equal(peak, 2);
    assert.deepEqual([...locales].sort(), ['en', 'vi']);
    assert.equal(report.scenarios[3].bodyBytes, 4 * sampleImage.length);
    assert.equal(report.scenarios[4].bodyBytes, 0);
    assert.deepEqual(report.scenarios[4].status, { 304: 4 });
    assert.ok(!JSON.stringify(report).includes(sampleImage.toString()));
  });
});

test('Không follow redirect và dừng kịch bản khi thất bại', async () => {
  let requests = 0;
  await withServer((_req, res) => {
    requests++;
    res.writeHead(302, { location: 'https://example.invalid/secret' });
    res.end();
  }, async config => {
    const report = await runBackendLoad(config);
    assert.equal(report.ok, false);
    assert.equal(report.scenarios.length, 1);
    assert.equal(requests, 2);
    assert.deepEqual(report.scenarios[0].status, { 302: 2 });
    assert.ok(!JSON.stringify(report).includes('example.invalid'));
  });
});

test('Timeout toàn request kể cả response nhỏ gửi liên tục', async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    const timer = setInterval(() => res.write('x'), 15);
    res.on('close', () => clearInterval(timer));
  }, async config => {
    const report = await runBackendLoad({ ...config, timeoutMs: 100 });
    assert.equal(report.ok, false);
    assert.deepEqual(report.scenarios[0].errors, { timeout: 2 });
  });
});

test('Giới hạn dung lượng response không giữ buffer lớn', async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(Buffer.alloc(9 * 1024 * 1024));
  }, async config => {
    const report = await runBackendLoad({ ...config, concurrency: 1 });
    assert.equal(report.ok, false);
    assert.deepEqual(report.scenarios[0].errors, { body_limit: 1 });
  });
});

test('Thiếu ETag hợp lệ không báo PASS hoặc phát request 304', async () => {
  await withServer((req, res) => {
    if (!req.url.includes('/thumbnail?')) return normal(req, res);
    res.writeHead(200, { 'content-type': 'image/webp' });
    res.end(sampleImage);
  }, async config => {
    const report = await runBackendLoad(config);
    assert.equal(report.ok, false);
    assert.equal(report.scenarios.at(-1).skipped, 'invalid_etag_preflight');
  });
});

test('HTTP 200 sai content-type và lỗi kết nối không thành mẫu đạt', async () => {
  await withServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('not API'); }, async config => {
    const report = await runBackendLoad(config);
    assert.equal(report.ok, false);
    assert.equal(report.scenarios[0].successful, 0);
  });
  await withServer((req) => req.socket.destroy(), async config => {
    const report = await runBackendLoad(config);
    assert.equal(report.ok, false);
    assert.deepEqual(report.scenarios[0].errors, { transport: 2 });
  });
});
