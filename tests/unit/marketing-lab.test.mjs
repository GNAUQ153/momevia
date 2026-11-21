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

test('Animation môi trường chỉ chạy khi Hero hoạt động và tự tắt khi unmount', () => {
  const js = read('../../web/js/features/marketing/hero-templates.js');
  const css = read('../../web/css/marketing-immersive.css');
  assert.match(js, /root\.toggleAttribute\('data-mkt-ambient-running', running\)/);
  assert.match(js, /root\.removeAttribute\('data-mkt-ambient-running'\)/);
  assert.match(css, /\.mkt-hero:not\(\[data-mkt-ambient-running\]\) \.mkt-stage__orb\s*\{\s*animation-play-state:\s*paused;/);
  assert.match(js, /!document\.hidden && visible && !dialog\.open/);
});

test('Công cụ lab chỉ đo máy local, không gửi số liệu ra dịch vụ ngoài', () => {
  const src = read('../../scripts/quality/measure-marketing.mjs');
  assert.match(src, /\['127\.0\.0\.1', 'localhost', '\[::1\]'\]/);
  assert.match(src, /dist\/reports\/marketing-lab\.json/);
  assert.doesNotMatch(src, /sendBeacon\(|analytics\.google|fetch\(/);
});
