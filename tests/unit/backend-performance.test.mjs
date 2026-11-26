import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { createPerformanceMonitor, performanceInterval } from '../../src/shared/performance-monitor.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';

function fixture() {
  let time = 0, tick, canceled = 0, scheduled = 0, unref = 0;
  const reports = [];
  const monitor = createPerformanceMonitor({ intervalMs: 30000, now: () => time,
    cpu: () => ({ user: time * 250, system: time * 250 }),
    memory: () => ({ rss: 100, heapUsed: 50, external: 20 }),
    elu: () => ({ active: time / 4, idle: time * 3 / 4 }), emit: report => reports.push(report),
    schedule: (callback, ms) => { assert.equal(ms, 30000); scheduled++; tick = callback; return { unref() { unref++; } }; },
    cancel: () => { canceled++; } });
  return { monitor, reports, advance: ms => { time += ms; }, tick: () => tick(), counts: () => ({ canceled, scheduled, unref }) };
}
function response(statusCode = 200) {
  return Object.assign(new EventEmitter(), { statusCode, writableFinished: false });
}

test('Giám sát mặc định tắt, chỉ chấp nhận chu kỳ hữu hạn', () => {
  assert.equal(performanceInterval({}), 0);
  assert.equal(performanceInterval({ MOMEVIA_PERF_INTERVAL_MS: '0' }), 0);
  assert.equal(createPerformanceMonitor(), null);
  assert.equal(performanceInterval({ MOMEVIA_PERF_INTERVAL_MS: '60000' }), 60000);
  for (const value of ['1', 'NaN', '-1', '30000.5', '3600001']) {
    assert.throws(() => performanceInterval({ MOMEVIA_PERF_INTERVAL_MS: value }), /MOMEVIA_PERF/);
  }
});

test('HTTP đếm đúng finish/close, không giữ listener, tách request bị ngắt', () => {
  const f = fixture(); f.monitor.start();
  const ok = response(201), aborted = response();
  f.monitor.observeResponse(ok)('designs'); f.monitor.observeResponse(aborted)('designs');
  f.advance(22); ok.emit('finish'); ok.emit('close'); aborted.emit('close');
  assert.equal(ok.listenerCount('finish'), 0); assert.equal(aborted.listenerCount('finish'), 0);
  f.advance(30000); f.tick();
  const { http: report } = f.reports[0];
  assert.equal(report.inFlight, 0); assert.equal(report.peakInFlight, 2);
  assert.equal(report.groups.designs.count, 1); assert.equal(report.groups.designs.aborted, 1);
  assert.equal(report.groups.designs.status['2xx'], 1); assert.equal(report.groups.designs.p95UpperMs, 25);
});

test('Histogram có kích thước cố định, không ghi URL hoặc nhãn tùy ý', () => {
  const f = fixture(); f.monitor.start();
  for (let i = 0; i < 1000; i++) {
    const res = response(503); f.monitor.observeResponse(res)(`private-token-${i}`);
    f.advance(i === 999 ? 15000 : 7); res.emit('finish');
  }
  f.tick(); const report = f.reports[0];
  assert.equal(Object.keys(report.http.groups).length, 8);
  assert.equal(report.http.groups.other.count, 1000);
  assert.equal(report.http.groups.other.status['5xx'], 1000);
  assert.equal(report.http.groups.other.p99UpperMs, 10);
  assert.equal(report.http.groups.other.maxMs, 15000);
  assert.ok(!JSON.stringify(report).includes('private-token'));
});

test('Cửa sổ mới không đếm trùng, giữ request chưa hoàn thành', () => {
  const f = fixture(); f.monitor.start();
  const res = response(); f.monitor.observeResponse(res)('catalog');
  f.advance(30000); f.tick();
  assert.equal(f.reports[0].http.inFlight, 1);
  assert.equal(f.reports[0].http.groups.catalog.count, 0);
  res.emit('finish'); f.advance(30000); f.tick();
  assert.equal(f.reports[1].http.groups.catalog.count, 1);
  assert.equal(f.reports[1].http.groups.catalog.p95UpperMs, 30000);
  assert.equal(f.reports[1].http.peakInFlight, 1);
  f.advance(30000); f.tick(); assert.equal(f.reports[2].http.groups.catalog.count, 0);
  assert.equal(f.reports[2].http.groups.catalog.p95UpperMs, null);
});

test('CPU theo một core, RSS theo byte và ELU theo cửa sổ', () => {
  const f = fixture(); f.monitor.start(); f.advance(30000); f.tick();
  assert.deepEqual(f.reports[0].process, { cpuCorePercent: 50, rssBytes: 100, heapUsedBytes: 50, externalBytes: 20, eventLoopUtilization: .25 });
});

test('MySqlClient đo query và transaction từ đầu đến cuối, không log SQL hay lỗi gốc', async () => {
  const f = fixture();
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() {}, release() {}, async execute() { f.advance(20); } };
  const client = new MySqlClient({ env: { MYSQL_PASSWORD: 'fixture-secret' }, monitor: f.monitor, createPool: () => ({
    async execute() { f.advance(10); throw new Error('private-sql-error'); },
    async getConnection() { f.advance(30); return connection; }, async end() {}
  }) });
  f.monitor.start(() => client.active.size);
  await assert.rejects(client.execute('SELECT private_data'), /private-sql-error/);
  await client.withTransaction(tx => tx.execute('UPDATE private_data'));
  f.advance(30000); f.tick();
  const report = f.reports[0];
  assert.equal(report.mysql.operations.query.errors, 1);
  assert.equal(report.mysql.operations.query.meanMs, 10);
  assert.equal(report.mysql.operations.transaction.meanMs, 50);
  assert.equal(report.mysql.activeOperations, 0); assert.equal(report.mysql.peakActiveOperations, 1);
  assert.ok(!/private|fixture-secret/.test(JSON.stringify(report)));
  await client.close();
});

test('Timer chỉ khởi tạo một lần, unref và stop idempotent', () => {
  const f = fixture(); f.monitor.start(); f.monitor.start();
  const res = response(); f.monitor.observeResponse(res)('identity');
  f.monitor.stop(); f.monitor.stop(); f.monitor.start(); res.emit('finish');
  f.advance(30000); f.tick();
  assert.deepEqual(f.counts(), { canceled: 1, scheduled: 1, unref: 1 });
  assert.equal(f.reports.length, 0); assert.equal(res.listenerCount('close'), 0);
});

test('HTTP Server thực: phân loại và đếm status sau khi response kết thúc', async () => {
  const f = fixture(); f.monitor.start();
  const server = http.createServer((_req, res) => { f.monitor.observeResponse(res)('support'); res.writeHead(404); res.end('not found'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/private-path`); await res.text();
    f.advance(30000); f.tick();
    assert.equal(f.reports[0].http.groups.support.status['4xx'], 1);
    assert.ok(!JSON.stringify(f.reports[0]).includes('private-path'));
  } finally { f.monitor.stop(); await new Promise(resolve => server.close(resolve)); }
});
