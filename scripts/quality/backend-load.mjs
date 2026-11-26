import http from 'node:http';
import { performance } from 'node:perf_hooks';

const thumbnail = '/api/designs/library/templates/birthday-radiance/thumbnail?width=320&locale=vi';
const scenarios = Object.freeze([
  { name: 'health', path: '/api/catalog/health', type: 'application/json' },
  { name: 'catalog-vi', path: '/api/catalog/templates', locale: 'vi', type: 'application/json' },
  { name: 'catalog-en', path: '/api/catalog/templates', locale: 'en', type: 'application/json' },
  { name: 'thumbnail-200', path: thumbnail, type: 'image/webp' },
  { name: 'thumbnail-304', path: thumbnail, type: 'image/webp', conditional: true },
]);
const maxBodyBytes = 8 * 1024 * 1024;

function boundedInteger(value, name, min, max) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)
    throw new Error(`${name} phải là số nguyên từ ${min} đến ${max}.`);
  return Number(value);
}

export function loadConfig(env) {
  // Chỉ cho phép chạy có xác nhận trên loopback, không nhận URL hoặc credential.
  if (env.MOMEVIA_LOAD_LOCAL_QA !== 'true') throw new Error('Cần xác nhận MOMEVIA_LOAD_LOCAL_QA=true (chỉ dùng Local/QA cô lập).');
  return Object.freeze({
    port: boundedInteger(env.MOMEVIA_LOAD_PORT ?? '4116', 'MOMEVIA_LOAD_PORT', 1024, 65535),
    requests: boundedInteger(env.MOMEVIA_LOAD_REQUESTS ?? '20', 'MOMEVIA_LOAD_REQUESTS', 1, 100),
    concurrency: boundedInteger(env.MOMEVIA_LOAD_CONCURRENCY ?? '2', 'MOMEVIA_LOAD_CONCURRENCY', 1, 10),
    timeoutMs: boundedInteger(env.MOMEVIA_LOAD_TIMEOUT_MS ?? '5000', 'MOMEVIA_LOAD_TIMEOUT_MS', 100, 10000),
  });
}

function requestOne(config, scenario, agent, etag) {
  return new Promise(resolve => {
    const start = performance.now();
    let status = null, bytes = 0, responseTag, finished = false, request, timer;
    const complete = error => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ status, bytes, elapsedMs: performance.now() - start, error, etag: responseTag });
    };
    const headers = { 'accept-encoding': 'identity', ...(scenario.locale ? { 'x-momevia-locale': scenario.locale } : {}),
      ...(etag ? { 'if-none-match': etag } : {}) };
    // Dùng HTTP trực tiếp tới IPv4 loopback; không proxy, redirect, cookie hay token.
    request = http.request({ hostname: '127.0.0.1', port: config.port, path: scenario.path, method: 'GET', headers, agent }, res => {
      status = res.statusCode;
      responseTag = res.headers.etag;
      res.on('error', () => complete('transport'));
      res.on('aborted', () => complete('transport'));
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxBodyBytes) {
          complete('body_limit');
          res.destroy();
        }
      });
      res.on('end', () => {
        const expected = etag ? 304 : 200;
        const type = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const valid = status === expected && (etag ? bytes === 0 && responseTag === etag : type === scenario.type && bytes > 0);
        complete(valid ? null : 'unexpected_response');
      });
    });
    request.on('error', () => complete('transport'));
    // Timeout toàn bộ request, kể cả khi server liên tục gửi từng chunk nhỏ.
    timer = setTimeout(() => {
      complete('timeout');
      request.destroy();
    }, config.timeoutMs);
    request.end();
  });
}

const round = value => Math.round(value * 100) / 100;
export function summarizeLoad(samples, elapsedMs) {
  const successful = samples.filter(sample => sample.error === null);
  const durations = successful.map(sample => sample.elapsedMs).sort((a, b) => a - b);
  const percentile = fraction => durations.length ? round(durations[Math.ceil(fraction * durations.length) - 1]) : null;
  const status = {}, errors = {};
  for (const sample of samples) {
    const key = sample.status ?? 'none';
    status[key] = (status[key] ?? 0) + 1;
    if (sample.error) errors[sample.error] = (errors[sample.error] ?? 0) + 1;
  }
  return {
    requests: samples.length, successful: successful.length, failed: samples.length - successful.length,
    elapsedMs: round(elapsedMs), requestsPerSecond: elapsedMs > 0 ? round(samples.length * 1000 / elapsedMs) : null,
    bodyBytes: samples.reduce((total, sample) => total + sample.bytes, 0), status, errors,
    // Percentile chỉ tính response đạt contract; lỗi luôn được báo riêng.
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
  };
}

export async function runBackendLoad(config) {
  // Kiểm tra lại cả khi được gọi trực tiếp từ module khác.
  const safe = loadConfig({ MOMEVIA_LOAD_LOCAL_QA: 'true', MOMEVIA_LOAD_PORT: config.port,
    MOMEVIA_LOAD_REQUESTS: config.requests, MOMEVIA_LOAD_CONCURRENCY: config.concurrency, MOMEVIA_LOAD_TIMEOUT_MS: config.timeoutMs });
  const agent = new http.Agent({ keepAlive: true, maxSockets: safe.concurrency });
  const report = { kind: 'local-backend-load', schemaVersion: 1, generatedAt: new Date().toISOString(), config: safe, scenarios: [] };
  try {
    for (const scenario of scenarios) {
      let etag;
      if (scenario.conditional) {
        const seed = await requestOne(safe, scenario, agent);
        // Không in ETag hoặc body; preflight không tính vào mẫu đo 304.
        if (seed.error || !/^"[a-f0-9]{64}"$/.test(seed.etag ?? '')) {
          report.scenarios.push({ name: scenario.name, skipped: 'invalid_etag_preflight' });
          continue;
        }
        etag = seed.etag;
      }
      const samples = [];
      let next = 0, failed = false;
      const start = performance.now();
      await Promise.all(Array.from({ length: Math.min(safe.concurrency, safe.requests) }, async () => {
        while (!failed && next < safe.requests) {
          next++;
          const sample = await requestOne(safe, scenario, agent, etag);
          samples.push(sample);
          if (sample.error) failed = true;
        }
      }));
      const result = summarizeLoad(samples, performance.now() - start);
      report.scenarios.push({ name: scenario.name, ...result });
      // Không tiếp tục tạo tải khi một kịch bản đã lỗi.
      if (result.failed > 0) break;
    }
  } finally {
    agent.destroy();
  }
  report.ok = report.scenarios.length === scenarios.length && report.scenarios.every(item => item.failed === 0);
  return report;
}
