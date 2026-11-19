import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const packageJob = ci.split(/\n  package:\r?\n/)[1]?.split(/\n  release:\r?\n/)[0];

test('release CI checks pristine package while installing dependencies only in smoke copy', () => {
  assert.ok(packageJob, 'Thiếu job package');
  const build = packageJob.indexOf('npm run package');
  const firstVerify = packageJob.indexOf('npm run verify:package', build);
  const copy = packageJob.indexOf('cp -a dist/release dist/release-smoke', firstVerify);
  const smoke = packageJob.indexOf('working-directory: dist/release-smoke', copy);
  const install = packageJob.indexOf('npm ci', smoke);
  const finalVerify = packageJob.lastIndexOf('npm run verify:package');
  assert.ok(build >= 0 && firstVerify > build && copy > firstVerify && smoke > copy);
  assert.ok(install > smoke && finalVerify > install);
  assert.doesNotMatch(packageJob, /working-directory: dist\/release\s*\n/);
  assert.match(packageJob, /tar --exclude=node_modules/);
});
