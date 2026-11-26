import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSource, analyze, cyclicGroups, newViolations, runAudit } from '../../scripts/quality/audit-architecture.mjs';

const row = (file, source) => inspectSource(source, file);

test('AST bỏ qua import trong comment và chuỗi, nhận re-export và dynamic import', () => {
  const result = row('src/a.mjs', `// import './ignored.mjs';
const text = "import './fake.mjs'";
import './b.mjs';
export { x } from './c.mjs';
export * from './d.mjs';
const load = () => import('./e.mjs');
const unknown = name => import(name);
`);
  assert.deepEqual(result.imports, [
    { specifier: './b.mjs', dynamic: false }, { specifier: './c.mjs', dynamic: false },
    { specifier: './d.mjs', dynamic: false }, { specifier: './e.mjs', dynamic: true },
  ]);
  assert.equal(result.dynamicUnknown, 1);
});

test('Đếm nhánh riêng của hàm lồng, class và số dòng LF/CRLF nhất quán', () => {
  const source = 'class Example {\n  check(x) {\n    const inner = () => x ? 1 : 0;\n    if (x && inner()) return true;\n  }\n}\n';
  const a = row('src/a.mjs', source);
  assert.deepEqual(a, row('src/a.mjs', source.replaceAll('\n', '\r\n')));
  assert.equal(a.lines, 6);
  assert.equal(a.classes, 1);
  assert.deepEqual(a.functions.map(({name, decisions}) => [name, decisions]), [['check', 2], ['inner', 1]]);
});

test('Tìm vòng tĩnh, không coi dynamic import là cạnh tĩnh', () => {
  const result = analyze([
    row('src/a.mjs', "import './b.mjs';"), row('src/b.mjs', "export * from './a.mjs';"),
    row('src/c.mjs', "import('./a.mjs');"), row('src/d.mjs', "import('./d.mjs');"),
  ]);
  assert.deepEqual(result.cycles, [['src/a.mjs', 'src/b.mjs']]);
  assert.equal(result.staticEdges, 2);
  assert.equal(result.dynamicImports, 2);
  assert.deepEqual(cyclicGroups(new Map([['self', new Set(['self'])]])), [['self']]);
});

test('Ranh giới shared/infrastructure và browser bao gồm cả dynamic import literal', () => {
  const result = analyze([
    row('src/shared/a.mjs', "import '../modules/gifts/a.mjs';"),
    row('src/infrastructure/a.mjs', "import('../modules/gifts/a.mjs');"),
    row('src/modules/gifts/a.mjs', 'export const x = 1;'),
    row('web/js/a.js', "import('../../src/modules/gifts/a.mjs');"),
  ]);
  assert.equal(result.boundaries.length, 3);
  assert.equal(result.outsideScannedGraph.length, 0);
});

test('Baseline chỉ chặn cạnh vi phạm mới; cho phép xóa nợ cũ', () => {
  const baseline = { cycleEdges: ['old'], boundaries: ['old-boundary'] };
  assert.deepEqual(newViolations({ cycleEdges: [], boundaries: [] }, baseline), []);
  assert.deepEqual(newViolations({ cycleEdges: ['old','new'], boundaries: ['old-boundary','new-boundary'] }, baseline), ['cycleEdges: new','boundaries: new-boundary']);
});

test('Quét source dự án và bảo đảm báo cáo có dữ liệu hai tầng', () => {
  const report = runAudit();
  assert.deepEqual(report.scopes.map(scope => scope.scope), ['src/', 'web/js/']);
  assert(report.scopes.every(scope => scope.files > 0 && scope.lines > 0));
  assert(report.staticEdges > 0);
  assert(!report.largestFiles.some(file => file.file.startsWith('web/js/vendor/')));
});
