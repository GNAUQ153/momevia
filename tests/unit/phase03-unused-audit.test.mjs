import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectModule, analyzeUnused, runUnusedAudit } from '../../scripts/quality/audit-unused.mjs';
import { validRecipientName } from '../../web/js/shared/recipient-naming.js';

const row = (file, source) => inspectModule(source, file);
const report = (rows, entries) => analyzeUnused(rows.map(([file, source]) => row(file, source)), entries);

test('AST nhận export khai báo, destructuring, alias và default; bỏ comment và chuỗi', () => {
  const source = `// export const fake = 0;
const text = "import './fake.mjs'";
export const { key: alias, nested: [a, ...rest], ...other } = {};
export let [b,,c = 0] = [];
export function f() {}
export class C {}
export { text as title };
export default 1;`;
  const r = row('src/a.mjs', source);
  assert.deepEqual(r.exports, ['C','a','alias','b','c','default','f','other','rest','title']);
  assert.deepEqual(r.references, []);
  assert.deepEqual(r, row('src/a.mjs', source.replaceAll('\n', '\r\n')));
});

test('Phân biệt import có tên, alias, default và import side-effect', () => {
  const r = report([
    ['src/a.mjs', 'export const a=1,b=2; export default 3;'],
    ['src/b.mjs', 'import x, { a as renamed } from "./a.mjs";'],
    ['src/c.mjs', 'import "./a.mjs";'],
  ], ['src/b.mjs','src/c.mjs']);
  assert.deepEqual(r.noObservedConsumer, [{ file: 'src/a.mjs', name: 'b' }]);
  assert.deepEqual(r.noIncoming, []);
});

test('Namespace, dynamic literal và export sao bảo vệ export có thể dùng gián tiếp', () => {
  const r = report([
    ['src/a.mjs', 'export const a=1;'],
    ['src/b.mjs', 'export const b=2;'],
    ['src/c.mjs', 'export const c=3;'],
    ['src/d.mjs', 'import * as mod from "./a.mjs"; import(`./b.mjs`); export * from "./c.mjs";'],
  ]);
  assert.deepEqual(r.noObservedConsumer, []);
  assert.deepEqual(r.opaqueModules, ['src/a.mjs','src/b.mjs','src/c.mjs','src/d.mjs']);
});

test('Re-export có alias ghi nhận tên gốc; phân biệt consumer test và công cụ', () => {
  const r = report([
    ['src/a.mjs', 'export const a=1,b=2,c=3,d=4;'],
    ['src/wrapper.mjs', 'export {a as aliased} from "./a.mjs";'],
    ['tests/unit/a.test.mjs', 'import {b} from "../../src/a.mjs";'],
    ['scripts/tool.mjs', 'import {c} from "../src/a.mjs";'],
  ]);
  assert.deepEqual(r.testOnly, [{file:'src/a.mjs',name:'b'}]);
  assert.deepEqual(r.toolOrTestOnly, [{file:'src/a.mjs',name:'c'}]);
  assert.deepEqual(r.noObservedConsumer, [{file:'src/a.mjs',name:'d'},{file:'src/wrapper.mjs',name:'aliased'}]);
});

test('Entry HTML, URL browser, dynamic không rõ và tham chiếu ngoài scope', () => {
  const r = report([
    ['web/js/app.js', 'import("/js/feature.js"); import(name); import("./vendor/x.js");'],
    ['web/js/feature.js', 'export const x=1;'],
    ['web/js/old.js', 'export const old=1;'],
  ], ['web/js/app.js']);
  assert.deepEqual(r.noIncoming, ['web/js/old.js']);
  assert.deepEqual(r.unknownDynamic, [{file:'web/js/app.js',line:1}]);
  assert.deepEqual(r.unresolved, [{file:'web/js/app.js',line:1,destination:'web/js/vendor/x.js'}]);
  assert.equal(r.mode,'advisory-only');
});

test('Audit source thật gồm runtime, test, tool và bỏ vendor; không chạy module', () => {
  const r = runUnusedAudit();
  assert(r.targets > 0 && r.scopes.runtime > 0 && r.scopes.test > 0 && r.scopes.tool > 0);
  assert(r.entries.includes('web/js/app.js'));
  assert(r.entries.includes('web/js/catalog-bootstrap.js'));
  assert(!r.noIncoming.includes('web/js/app.js'));
  assert(!r.noIncoming.some(f => f.startsWith('web/js/vendor/')));
});

test('Thu hẹp export không đổi giới hạn tên người nhận', () => {
  assert.equal(validRecipientName('Á'.repeat(60)), true);
  assert.equal(validRecipientName('Á'.repeat(61)), false);
  assert.equal(validRecipientName('   '), false);
  assert.equal(validRecipientName('Mai\nAnh'), false);
});
