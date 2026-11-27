// Nghiệm thu báo cáo local, không kết nối mạng hoặc database.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { marketingPercentile } from './marketing-metrics.mjs';

const viewports = [
  ['mobile', 390, 844],
  ['laptop', 1024, 768],
  ['desktop', 1440, 900],
];

const budgets = Object.freeze({
  lcpMs: 2500,
  fcpMs: 1800,
  ttfbMs: 800,
  cls: 0.1,
});

const metricKeys = [
  ...Object.keys(budgets),
  'longTaskBlockingMs',
  'overflowPx',
];

const valid = value =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0;

// Kiểm tra dữ liệu thô thay vì tin vào summaries có sẵn.
export function assessMarketingReport(report) {
  const invalid = [];
  const failures = [];
  const warnings = [];
  const groups = [];

  const result = {
    invalid,
    failures,
    warnings,
    groups,
  };

  if (
    report?.kind !== 'local-lab' ||
    report.schemaVersion !== 2 ||
    !Number.isInteger(report.runsPerCase) ||
    report.runsPerCase < 3 ||
    report.runsPerCase > 5 ||
    !Array.isArray(report.samples)
  ) {
    invalid.push('invalid-report');
    return result;
  }

  const count = report.runsPerCase;

  if (report.samples.length !== count * 6) {
    invalid.push('sample-count');
  }

  for (const locale of ['vi', 'en']) {
    for (const [viewport, width, height] of viewports) {
      const id = locale + ':' + viewport;

      const samples = report.samples.filter(sample =>
        sample?.locale === locale &&
        sample.viewport === viewport &&
        sample.width === width &&
        sample.height === height
      );

      const complete = Array.from(
        { length: count },
        (_, index) => index + 1
      ).every(run =>
        samples.filter(sample => sample.run === run).length === 1
      );

      if (samples.length !== count || !complete) {
        invalid.push(id + ':coverage');
        continue;
      }

      const metrics = {};

      for (const key of metricKeys) {
        if (!samples.every(sample => valid(sample[key]))) {
          invalid.push(id + ':missing:' + key);
          continue;
        }

        const values = samples.map(sample => sample[key]);

        metrics[key] = {
          median: marketingPercentile(values, 0.5),
          p75: marketingPercentile(values, 0.75),
          max: Math.max(...values),
        };

        if (!Object.hasOwn(budgets, key)) continue;

        if (metrics[key].p75 > budgets[key]) {
          failures.push(id + ':budget:' + key);
        } else if (metrics[key].max > budgets[key]) {
          warnings.push(id + ':peak:' + key);
        }
      }

      if (samples.some(sample =>
        !Array.isArray(sample.pageErrors)
      )) {
        invalid.push(id + ':missing:pageErrors');
      }

      if (samples.some(sample =>
        Array.isArray(sample.pageErrors) &&
        sample.pageErrors.length > 0
      )) {
        failures.push(id + ':page-errors');
      }

      if (samples.some(sample => sample.overflowPx > 0)) {
        failures.push(id + ':overflow');
      }

      groups.push({ id, metrics });
    }
  }

  return result;
}

// Chỉ so sánh các báo cáo có cùng điều kiện đo.
export function compareMarketingGate(before, after) {
  const previous = assessMarketingReport(before);
  const current = assessMarketingReport(after);
  const invalid = [];
  const warnings = [];

  if (
    previous.invalid.length ||
    current.invalid.length ||
    before.runsPerCase !== after.runsPerCase ||
    typeof before.url !== 'string' ||
    !before.url ||
    before.url !== after.url
  ) {
    invalid.push('incompatible-baseline');
    return { invalid, warnings };
  }

  const baseline = new Map(
    previous.groups.map(group => [group.id, group])
  );

  for (const group of current.groups) {
    const prior = baseline.get(group.id);

    for (const key of ['lcpMs', 'fcpMs']) {
      const oldValue = prior.metrics[key].median;
      const newValue = group.metrics[key].median;

      const delta = newValue - oldValue;

      // Dùng cả ngưỡng tương đối và tuyệt đối để giảm nhiễu.
      if (
        delta > 200 &&
        (oldValue === 0 || delta / oldValue > 0.2)
      ) {
        warnings.push(group.id + ':regression:' + key);
      }
    }
  }

  return { invalid, warnings };
}

function main() {
  const args = process.argv.slice(2);

  if (
    args.length !== 1 &&
    !(args.length === 3 && args[1] === '--baseline')
  ) {
    console.error(
      'Usage: marketing-gate.mjs <report.json> [--baseline <before.json>]'
    );
    process.exitCode = 2;
    return;
  }

  const read = filename =>
    JSON.parse(fs.readFileSync(filename, 'utf8'));

  const report = read(args[0]);
  const result = assessMarketingReport(report);

  if (args.length === 3) {
    const comparison = compareMarketingGate(read(args[2]), report);
    result.invalid.push(...comparison.invalid);
    result.warnings.push(...comparison.warnings);
  }

  for (const group of result.groups) {
    console.log(
      group.id +
      ' LCP p75=' + (group.metrics.lcpMs?.p75 ?? 'N/A') +
      'ms FCP p75=' + (group.metrics.fcpMs?.p75 ?? 'N/A') +
      'ms CLS p75=' + (group.metrics.cls?.p75 ?? 'N/A')
    );
  }

  for (const warning of result.warnings) {
    console.warn('WARNING: ' + warning);
  }

  for (const failure of [...result.invalid, ...result.failures]) {
    console.error('FAIL: ' + failure);
  }

  const failed = result.invalid.length || result.failures.length;

  console.log(
    'Marketing Gate: ' + (failed ? 'FAIL' : 'PASS') +
    ' | warnings=' + result.warnings.length
  );

  console.log(
    'Local lab only: không thay thế Core Web Vitals thực tế; chưa đo INP.'
  );

  process.exitCode = failed ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error('Marketing Gate: ' + error.message);
    process.exitCode = 2;
  }
}
