import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishDemoRevision, syncWebDemo, watchWebDemo } from '../../scripts/dev/web-demo-sync.mjs';

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-demo-sync-'));
  const root = path.join(folder, 'source'), app = path.join(folder, 'demo/app');
  function write(file, contents) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); }
  for (const [file, body] of Object.entries({ 'src/main.mjs': 'old backend', 'web/index.html': '<html><body>old</body></html>', 'web/js/old.js': 'old module', 'web/assets/old.svg': '<svg/>', 'dev.mjs': '', 'package.json': '{}', 'scripts/dev/web-demo-client.js': '// browser reload' })) write(path.join(root, file), body);
  write(path.join(app, 'services/designs/data/designs.json'), '[{"id":"edited-draft","revision":8}]');
  write(path.join(app, 'services/designs/data/uploads/photo.png'), 'uploaded photo');
  write(path.join(folder, 'demo/runtime.json'), 'existing keys');
  write(path.join(root, '.env'), 'must not copy');
  write(path.join(root, 'src/data/private.json'), 'must not copy');
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return { root, app, folder, write };
}

test('demo refresh mirrors updated/deleted code and preserves edited drafts, uploads and keys', t => {
  const { root, app, folder, write } = fixture(t);
  syncWebDemo(root, app);
  write(path.join(root, 'src/main.mjs'), 'new backend');
  write(path.join(root, 'web/js/new.js'), 'new module');
  fs.rmSync(path.join(root, 'web/js/old.js'));
  syncWebDemo(root, app);
  assert.equal(fs.readFileSync(path.join(app, 'src/main.mjs'), 'utf8'), 'new backend');
  assert.equal(fs.readFileSync(path.join(app, 'web/js/new.js'), 'utf8'), 'new module');
  assert(!fs.existsSync(path.join(app, 'web/js/old.js')));
  assert.equal(fs.readFileSync(path.join(app, 'services/designs/data/designs.json'), 'utf8'), '[{"id":"edited-draft","revision":8}]');
  assert.equal(fs.readFileSync(path.join(app, 'services/designs/data/uploads/photo.png'), 'utf8'), 'uploaded photo');
  assert.equal(fs.readFileSync(path.join(folder, 'demo/runtime.json'), 'utf8'), 'existing keys');
  assert(!fs.existsSync(path.join(app, '.env')));
  assert(!fs.existsSync(path.join(app, 'src/data')));
});

test('repeated demo refreshes publish one current revision and one reload script', t => {
  const { root, app, write } = fixture(t);
  syncWebDemo(root, app);
  publishDemoRevision(app, 'first');
  write(path.join(root, 'web/index.html'), '<html><body>updated</body></html>');
  syncWebDemo(root, app);
  publishDemoRevision(app, 'second');
  const html = fs.readFileSync(path.join(app, 'web/index.html'), 'utf8');
  assert.match(html, /updated/);
  assert.equal((html.match(/data-demo-revision/g) || []).length, 1);
  assert.match(html, /data-demo-revision="second"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(app, 'web/assets/__demo-revision.json'))), { revision: 'second' });
});

test('demo watcher reports nested frontend/backend edits and stops observing on disposal', async t => {
  const { root, write } = fixture(t);
  const events = [];
  const stop = watchWebDemo(root, file => events.push(file), error => { throw error; });
  t.after(stop);
  write(path.join(root, 'web/js/old.js'), 'changed');
  write(path.join(root, 'src/main.mjs'), 'changed');
  for (let attempt = 0; attempt < 30 && !(events.includes(path.join('web/js/old.js')) && events.includes(path.join('src/main.mjs'))); attempt++) await new Promise(resolve => setTimeout(resolve, 20));
  assert(events.some(file => file === path.join('web/js/old.js')));
  assert(events.some(file => file === path.join('src/main.mjs')));
  stop();
  const before = events.length;
  write(path.join(root, 'web/js/old.js'), 'after stop');
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(events.length, before);
});
