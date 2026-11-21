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
