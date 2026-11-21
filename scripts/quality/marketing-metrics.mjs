// Chuẩn hóa số liệu đo marketing trên máy phát triển, không gửi dữ liệu ra ngoài.
const numberOrNull = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ? Math.round(value * 100) / 100
  : null;

export function normalizeMarketingMetrics(input = {}) {
  return {
    ttfbMs: numberOrNull(input.ttfbMs),
    fcpMs: numberOrNull(input.fcpMs),
    lcpMs: numberOrNull(input.lcpMs),
    cls: numberOrNull(input.cls),
    longTaskBlockingMs: numberOrNull(input.longTaskBlockingMs),
    overflowPx: numberOrNull(input.overflowPx),
  };
}

// Mốc được dùng để theo dõi so sánh, không biến bài đo local thành chỉ số người dùng thật.
export function marketingLabWarnings(sample) {
  const warnings = [];
  if (sample.overflowPx !== null && sample.overflowPx > 1) warnings.push('horizontal-overflow');
  if (sample.lcpMs === null) warnings.push('lcp-unavailable');
  if (sample.fcpMs === null) warnings.push('fcp-unavailable');
  return warnings;
}


// Nội suy phân vị để báo cáo ổn định hơn phép đo đơn lẻ.
// Giá trị không hợp lệ được bỏ qua, không biến thành 0.
export function marketingPercentile(values, fraction) {
  if (!Array.isArray(values) || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = (sorted.length - 1) * fraction;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return Math.round((sorted[low] + (sorted[high] - sorted[low]) * (rank - low)) * 100) / 100;
}

const metricKeys = Object.freeze(['ttfbMs', 'fcpMs', 'lcpMs', 'cls', 'longTaskBlockingMs', 'overflowPx']);

// Tổng hợp theo cùng locale/viewport, không trộn số đo desktop với mobile.
export function summarizeMarketingSamples(samples = []) {
  const groups = new Map();
  for (const sample of samples) {
    if (!sample || !['vi', 'en'].includes(sample.locale) || !['mobile', 'laptop', 'desktop'].includes(sample.viewport)) continue;
    const key = `${sample.locale}:${sample.viewport}:${sample.width}x${sample.height}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }
  return [...groups.values()].map(group => {
    const { locale, viewport, width, height } = group[0];
    const metrics = {};
    for (const key of metricKeys) {
      const observed = group.map(sample => sample[key]).filter(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
      metrics[key] = {
        median: marketingPercentile(observed, 0.5),
        p75: marketingPercentile(observed, 0.75),
        observed: observed.length,
      };
    }
    return {
      locale, viewport, width, height, runs: group.length, metrics,
      pageErrors: group.reduce((total, sample) => total + (Array.isArray(sample.pageErrors) ? sample.pageErrors.length : 0), 0),
      overflowRuns: group.filter(sample => typeof sample.overflowPx === 'number' && sample.overflowPx > 1).length,
      warnings: [...new Set(group.flatMap(sample => Array.isArray(sample.warnings) ? sample.warnings : []))],
    };
  });
}

// So sánh cùng kích thước/locale. Delta dương là chậm hơn hoặc dịch chuyển nhiều hơn.
// Không tự kết luận tối ưu/thoái lui từ một mẫu lab nhiễu.
export function compareMarketingSummaries(before = [], after = []) {
  const baseline = new Map(before.map(item => [`${item.locale}:${item.viewport}:${item.width}x${item.height}`, item]));
  return after.flatMap(item => {
    const prior = baseline.get(`${item.locale}:${item.viewport}:${item.width}x${item.height}`);
    if (!prior) return [];
    const changes = {};
    for (const key of metricKeys) {
      const oldValue = prior.metrics?.[key]?.median;
      const newValue = item.metrics?.[key]?.median;
      changes[key] = typeof oldValue === 'number' && Number.isFinite(oldValue) &&
        typeof newValue === 'number' && Number.isFinite(newValue)
        ? {
          before: oldValue,
          after: newValue,
          delta: Math.round((newValue - oldValue) * 100) / 100,
          percent: oldValue > 0 ? Math.round((newValue - oldValue) / oldValue * 10000) / 100 : null,
        }
        : null;
    }
    return [{ locale: item.locale, viewport: item.viewport, changes }];
  });
}
