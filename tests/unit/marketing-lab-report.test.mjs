import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingPercentile, summarizeMarketingSamples, compareMarketingSummaries } from '../../scripts/quality/marketing-metrics.mjs';

const sample = (run, locale, viewport, lcpMs, overflowPx = 0) => ({
  run, locale, viewport, width: viewport === 'mobile' ? 390 : 1024,
  height: viewport === 'mobile' ? 844 : 768,
  ttfbMs: 140, fcpMs: 500, lcpMs, cls: 0.02,
  longTaskBlockingMs: 0, overflowPx, warnings: overflowPx ? ['horizontal-overflow'] : [],
  pageErrors: [],
});

test('Phân vị bỏ qua NaN và dữ liệu thiếu, không coi thiếu số liệu bằng 0', () => {
  assert.equal(marketingPercentile([100, 400, 200, 300], 0.5), 250);
  assert.equal(marketingPercentile([100, 400, 200, 300], 0.75), 325);
  assert.equal(marketingPercentile([null, -2, Infinity, NaN], 0.75), null);
});

test('Tổng hợp không trộn các viewport hoặc hai ngôn ngữ', () => {
  const summaries = summarizeMarketingSamples([
    sample(1, 'vi', 'mobile', 1200), sample(2, 'vi', 'mobile', 1000), sample(3, 'vi', 'mobile', 1400, 5),
    sample(1, 'en', 'mobile', 2200), sample(1, 'vi', 'laptop', 900),
  ]);
  assert.equal(summaries.length, 3);
  const mobileVi = summaries.find(item => item.locale === 'vi' && item.viewport === 'mobile');
  assert.equal(mobileVi.runs, 3);
  assert.deepEqual(mobileVi.metrics.lcpMs, { median: 1200, p75: 1300, observed: 3 });
  assert.equal(mobileVi.overflowRuns, 1);
  assert.deepEqual(mobileVi.warnings, ['horizontal-overflow']);
  assert.equal(summaries.find(item => item.locale === 'en').metrics.lcpMs.median, 2200);
});

test('So sánh before/after chỉ ghép cùng locale + viewport và xử lý baseline bằng 0', () => {
  const baseline = summarizeMarketingSamples([sample(1, 'vi', 'mobile', 2000), sample(1, 'en', 'mobile', 0)]);
  const current = summarizeMarketingSamples([sample(1, 'vi', 'mobile', 1800), sample(1, 'en', 'mobile', 100)]);
  const diffs = compareMarketingSummaries(baseline, current);
  assert.equal(diffs.length, 2);
  assert.deepEqual(diffs[0].changes.lcpMs, { before: 2000, after: 1800, delta: -200, percent: -10 });
  assert.equal(diffs[1].changes.lcpMs.percent, null);
});

test('Thiếu số đo LCP được ghi N/A, không tạo giảm giả', () => {
  const baseline = summarizeMarketingSamples([sample(1, 'vi', 'mobile', null)]);
  const after = summarizeMarketingSamples([sample(1, 'vi', 'mobile', 1200)]);
  assert.equal(compareMarketingSummaries(baseline, after)[0].changes.lcpMs, null);
});
