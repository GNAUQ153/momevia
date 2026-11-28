import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRelativeTargets, summarizeTechnical, runTechnicalAudit } from '../../scripts/quality/audit-technical.mjs';

const source = 'src/shared/locale.mjs -> web/assets/locales/en.json';
const vendor = 'web/js/features/gifts/qr.js -> web/js/vendor/qrcode.js';
const unknown = 'web/js/features/gifts/qr.js -> web/js/vendor/typo.js';

test('Chấp nhận đúng cạnh đã rà soát khi file tồn tại', () => {
  const inspected = [];
  const result = assessRelativeTargets([source, vendor], file => { inspected.push(file); return true; }, { built: true });
  assert.deepEqual(result, { issues: [], pending: [] });
  assert.deepEqual(inspected, ['web/assets/locales/en.json', 'web/js/vendor/qrcode.js']);
});

test('Vendor thiếu chỉ pending trước build, fail sau build', () => {
  assert.deepEqual(assessRelativeTargets([vendor], () => false), { issues: [], pending: [{ edge: vendor, reason: 'missing-generated' }] });
  assert.deepEqual(assessRelativeTargets([vendor], () => false, { built: true }), { issues: [{ edge: vendor, reason: 'missing-generated' }], pending: [] });
});

test('Thiếu JSON nguồn luôn fail, kể cả trước build', () => {
  const result = assessRelativeTargets([source], () => false);
  assert.deepEqual(result.issues, [{ edge: source, reason: 'missing-source' }]);
  assert.deepEqual(result.pending, []);
});

test('Không tự cho phép cạnh mới hoặc đọc đường dẫn chưa rà soát', () => {
  const result = assessRelativeTargets([unknown, 'src/a.mjs -> ../../.env'], () => assert.fail('Không đọc file chưa được duyệt'));
  assert.equal(result.issues.length, 2);
  assert(result.issues.every(row => row.reason === 'unreviewed-relative-target'));
});

const policyArchive = 'src/modules/identity/policy-archive/2026-11-28.1.json';
const policyEdge = `src/modules/identity/policy-archive.mjs -> ${policyArchive}`;

test('Chấp nhận đúng bản lưu chính sách đã rà soát trong cả hai chế độ audit', () => {
  for (const built of [false, true]) {
    assert.deepEqual(assessRelativeTargets([policyEdge], file => {
      assert.equal(file, policyArchive);
      return true;
    }, { built }), { issues: [], pending: [] });
  }
});

test('Bản lưu chính sách thiếu luôn fail, không chuyển thành pending', () => {
  for (const built of [false, true]) {
    assert.deepEqual(assessRelativeTargets([policyEdge], () => false, { built }), {
      issues: [{ edge: policyEdge, reason: 'missing-source' }], pending: [],
    });
  }
});

test('Không miễn trừ cả thư mục policy-archive hoặc module import khác', () => {
  const edges = [
    'src/modules/identity/policy-archive.mjs -> src/modules/identity/policy-archive/next.json',
    `src/modules/identity/other.mjs -> ${policyArchive}`,
  ];
  assert.deepEqual(assessRelativeTargets(edges, () => assert.fail('Không đọc cạnh chưa duyệt')), {
    issues: edges.map(edge => ({ edge, reason: 'unreviewed-relative-target' })), pending: [],
  });
});

function fixture() {
  return {
    architecture: { cycleEdges: [], boundaries: [], scopes: [], cycles: [], staticEdges: 1, dynamicUnknown: 0, mostDecisions: [] },
    targets: { issues: [], pending: [] },
    css: [{ declarationCount: 1, errors: [] }],
    assets: { fontManifest: { checked: 1, issues: [] }, duplicateGroups: 3, repeatedBytes: 10 },
    migrations: { migrations: [{}], pinnedCount: 1, tableCount: 1, issues: [] },
    unused: { noObservedConsumer: ['candidate'], noIncoming: ['compatibility'], unknownDynamic: ['dynamic'] },
  };
}

test('Ứng viên dead code không làm fail và không suy ra production readiness', () => {
  const report = summarizeTechnical(fixture());
  assert.equal(report.status, 'pass');
  assert.equal(report.advisory.unusedExports, 1);
  assert.equal(report.advisory.duplicateAssetGroups, 3);
  assert.equal(report.productionReadiness, 'not-assessed');
  assert(report.externalEvidenceRequired.includes('payment-and-refund-live'));
});

test('Báo cáo phân biệt pending và fail, không che lỗi bằng advisory', () => {
  const data = fixture();
  data.targets.pending.push({ edge: vendor });
  assert.equal(summarizeTechnical(data).status, 'pending');
  data.architecture.cycleEdges.push('cycle');
  data.css[0].errors.push('compact');
  data.assets.fontManifest.issues.push('font');
  data.migrations.issues.push('migration');
  const report = summarizeTechnical(data);
  assert.equal(report.status, 'fail');
  assert.deepEqual(report.failed, ['architecture', 'css', 'fonts', 'migrations']);
  assert.deepEqual(report.pending, ['relativeTargets']);
});

test('Audit source thật có đủ năm nhóm kiểm tra, không cần database', async () => {
  const report = await runTechnicalAudit();
  assert.deepEqual(report.failed, []);
  assert.equal(report.checks.architecture.status, 'pass');
  assert(report.checks.css.files > 0);
  assert(report.checks.fonts.checked > 0);
  assert(report.checks.migrations.count >= 19);
  assert.equal(report.productionReadiness, 'not-assessed');
});
