import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessMarketingReport,
  compareMarketingGate,
} from '../../scripts/quality/marketing-gate.mjs';

function fixture() {
  const samples = [];

  for (const locale of ['vi', 'en']) {
    for (const [viewport, width, height] of [
      ['mobile', 390, 844],
      ['laptop', 1024, 768],
      ['desktop', 1440, 900],
    ]) {
      for (let run = 1; run <= 3; run += 1) {
        samples.push({
          locale,
          viewport,
          width,
          height,
          run,
          lcpMs: 300,
          fcpMs: 100,
          ttfbMs: 50,
          cls: 0.02,
          longTaskBlockingMs: 0,
          overflowPx: 0,
          pageErrors: [],
        });
      }
    }
  }

  return {
    kind: 'local-lab',
    schemaVersion: 2,
    url: 'http://127.0.0.1:4100',
    runsPerCase: 3,
    samples,
  };
}

test('Nghiệm thu đủ sáu cấu hình với 18 lượt hợp lệ', () => {
  const result = assessMarketingReport(fixture());

  assert.equal(result.groups.length, 6);
  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
});

test('Từ chối schema không hỗ trợ', () => {
  const report = fixture();
  report.schemaVersion = 1;

  assert.deepEqual(
    assessMarketingReport(report).invalid,
    ['invalid-report']
  );
});

test('Từ chối báo cáo thiếu cấu hình', () => {
  const report = fixture();
  report.samples.splice(0, 3);

  assert(
    assessMarketingReport(report).invalid.includes('vi:mobile:coverage')
  );
});

test('Từ chối lượt đo trùng', () => {
  const report = fixture();
  report.samples[0].run = 2;

  assert(
    assessMarketingReport(report).invalid.includes('vi:mobile:coverage')
  );
});

test('Không coi số đo null là 0', () => {
  const report = fixture();
  report.samples[0].lcpMs = null;

  assert(
    assessMarketingReport(report).invalid.includes('vi:mobile:missing:lcpMs')
  );
});

test('Phát hiện lỗi JavaScript', () => {
  const report = fixture();
  report.samples[0].pageErrors.push('runtime error');

  assert(
    assessMarketingReport(report).failures.includes('vi:mobile:page-errors')
  );
});

test('Phát hiện tràn ngang', () => {
  const report = fixture();
  report.samples[0].overflowPx = 1;

  assert(
    assessMarketingReport(report).failures.includes('vi:mobile:overflow')
  );
});

test('Đánh trượt khi LCP p75 vượt ngân sách', () => {
  const report = fixture();
  report.samples[0].lcpMs = 6000;

  assert(
    assessMarketingReport(report).failures.includes('vi:mobile:budget:lcpMs')
  );
});

test('Đánh trượt khi CLS p75 vượt ngân sách', () => {
  const report = fixture();
  report.samples[0].cls = 0.3;

  assert(
    assessMarketingReport(report).failures.includes('vi:mobile:budget:cls')
  );
});

test('Cảnh báo lượt đầu chậm dù FCP p75 vẫn đạt', () => {
  const report = fixture();
  report.samples[0].fcpMs = 2216;

  const result = assessMarketingReport(report);

  assert.deepEqual(result.failures, []);
  assert(result.warnings.includes('vi:mobile:peak:fcpMs'));
});

test('Phát hiện suy giảm đáng kể so với baseline', () => {
  const before = fixture();
  const after = fixture();

  for (const sample of after.samples.slice(0, 3)) {
    sample.lcpMs = 700;
  }

  assert(
    compareMarketingGate(before, after).warnings
      .includes('vi:mobile:regression:lcpMs')
  );
});

test('Không cảnh báo suy giảm nhỏ do nhiễu', () => {
  const before = fixture();
  const after = fixture();

  for (const sample of after.samples.slice(0, 3)) {
    sample.lcpMs = 350;
  }

  assert.deepEqual(
    compareMarketingGate(before, after).warnings,
    []
  );
});

test('Từ chối so sánh hai môi trường khác nhau', () => {
  const before = fixture();
  const after = fixture();

  after.url = 'http://localhost:4200';

  assert.deepEqual(
    compareMarketingGate(before, after).invalid,
    ['incompatible-baseline']
  );
});
