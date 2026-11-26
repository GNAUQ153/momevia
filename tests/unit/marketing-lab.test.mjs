import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeMarketingMetrics, marketingLabWarnings } from '../../scripts/quality/marketing-metrics.mjs';

const read = location => readFileSync(new URL(location, import.meta.url), 'utf8');

test('Không ghi kết quả lab âm, không hữu hạn hoặc thiếu dữ liệu như số đo hợp lệ', () => {
  const metrics = normalizeMarketingMetrics({ ttfbMs: -1, fcpMs: NaN, lcpMs: 1724.124, cls: 0.01789, longTaskBlockingMs: Infinity, overflowPx: 0 });
  assert.deepEqual(metrics, { ttfbMs: null, fcpMs: null, lcpMs: 1724.12, cls: 0.02, longTaskBlockingMs: null, overflowPx: 0 });
  assert.deepEqual(marketingLabWarnings(metrics), ['fcp-unavailable']);
});

test('Báo cảnh báo tràn ngang, thiếu LCP nhưng không tự gắn nhãn Core Web Vitals', () => {
  const metrics = normalizeMarketingMetrics({ fcpMs: 150, cls: 0, overflowPx: 13 });
  assert.deepEqual(marketingLabWarnings(metrics), ['horizontal-overflow', 'lcp-unavailable']);
});

test('Hero khôi phục animation và dừng đồng hồ khi ẩn hoặc unmount', () => {
  const js = read('../../web/js/features/marketing/hero-templates.js');
  const html = read('../../web/js/pages/home.js');
  assert.doesNotMatch(js, /setInterval|setTimeout/);
  for(const marker of ['mkt-stage__orb','data-mkt-tilt'])assert(html.includes(marker));
  assert(js.includes('data-hero-progress'));
  assert.match(js,/root\.toggleAttribute\('data-mkt-ambient-running', running\)/);
  assert.match(js,/lifetime\.abort\(\);/);assert.match(js,/resetProgress\(\);/);
  assert.match(js, /const removeLocaleListener = onLocaleChange/);
});

test('Công cụ lab chỉ đo máy local, không gửi số liệu ra dịch vụ ngoài', () => {
  const src = read('../../scripts/quality/measure-marketing.mjs');
  assert.match(src, /\['127\.0\.0\.1', 'localhost', '\[::1\]'\]/);
  assert.match(src, /dist\/reports\/marketing-lab/);
  assert.match(src, /MOMEVIA_PERF_TAG/);
  assert.doesNotMatch(src, /sendBeacon\(|analytics\.google|fetch\(/);
});


test('Công cụ đo có lặp mẫu VI/EN và sinh bảng tổng hợp, không chỉ một số đo', () => {
  const src = read('../../scripts/quality/measure-marketing.mjs');
  assert.match(src, /MOMEVIA_PERF_RUNS/);
  assert.match(src, /summarizeMarketingSamples\(result\.samples\)/);
  assert.match(src, /const browser = await chromium\.launch/);
});
