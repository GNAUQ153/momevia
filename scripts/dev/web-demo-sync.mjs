import fs from 'node:fs';
import path from 'node:path';

const entries = ['src', 'web', 'dev.mjs', 'package.json'];
const generated = new Set(['web/js/__demo-reload.js', 'web/assets/__demo-revision.json']);
const tag = /\s*<script type="module" src="\/js\/__demo-reload\.js" data-demo-revision="[\w-]+"><\/script>/g;

function writeChanged(file, bytes) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(Buffer.from(bytes))) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

// Mirror code only. services/*/data, uploads, credentials and runtime.json are
// outside these four entries and are never copied, removed or reseeded.
export function syncWebDemo(root, appDir) {
  root = path.resolve(root);
  appDir = path.resolve(appDir);
  if (root === appDir || root.startsWith(appDir + path.sep)) throw new Error('Demo must use a separate generated directory.');
  function mirror(relative) {
    const source = path.join(root, relative), target = path.resolve(appDir, relative);
    if (!target.startsWith(appDir + path.sep)) throw new Error('Demo sync escaped its directory.');
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error(`Demo code cannot overwrite a symlink: ${relative}`);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Demo code cannot contain a symlink: ${relative}`);
    if (fs.statSync(source).isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      const names = fs.readdirSync(source).filter(name => !['data', 'node_modules', '.env'].includes(name));
      for (const name of fs.readdirSync(target)) {
        const child = path.join(relative, name);
        if (names.includes(name) || generated.has(child.replaceAll(path.sep, '/')) || ['data', 'node_modules', '.env'].includes(name)) continue;
        const stale = path.resolve(appDir, child);
        if (!stale.startsWith(appDir + path.sep)) throw new Error('Demo deletion escaped its directory.');
        fs.rmSync(stale, { recursive: true, force: true });
      }
      for (const name of names) mirror(path.join(relative, name));
    } else {
      let bytes = fs.readFileSync(source);
      if (relative === path.join('web', 'index.html') && fs.existsSync(target)) {
        const previous = fs.readFileSync(target, 'utf8').match(/<script type="module" src="\/js\/__demo-reload\.js" data-demo-revision="[\w-]+"><\/script>/)?.[0];
        if (previous) bytes = Buffer.from(bytes.toString().replace('</body>', `${previous}\n</body>`));
      }
      writeChanged(target, bytes);
    }
  }
  for (const entry of entries) mirror(entry);
  writeChanged(path.join(appDir, 'web/js/__demo-reload.js'), fs.readFileSync(path.join(root, 'scripts/dev/web-demo-client.js')));
}

export function publishDemoRevision(appDir, revision) {
  if (!/^[\w-]+$/.test(revision)) throw new Error('Invalid demo revision.');
  const index = path.join(appDir, 'web/index.html');
  writeChanged(index, fs.readFileSync(index, 'utf8').replace(tag, '').replace('</body>',
    `<script type="module" src="/js/__demo-reload.js" data-demo-revision="${revision}"></script>\n</body>`));
  const file = path.join(appDir, 'web/assets/__demo-revision.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify({ revision }));
  fs.renameSync(file + '.tmp', file);
}

export function watchWebDemo(root, onChange, onError) {
  const watchers = [];
  // Observe the containing directory for top-level files: atomic editor saves
  // replace the inode, which would detach a watcher attached to the file itself.
  for (const entry of ['', 'src', 'web', 'scripts/dev']) {
    const watcher = fs.watch(path.join(root, entry), { recursive: Boolean(entry) }, (_event, file) => {
      if (!entry && !['dev.mjs', 'package.json'].includes(String(file))) return;
      if (entry === 'scripts/dev' && !['web-demo-client.js', 'web-demo-server.mjs'].includes(String(file))) return;
      onChange(path.join(entry, String(file || '')));
    });
    watcher.on('error', onError);
    watchers.push(watcher);
  }
  return () => watchers.forEach(watcher => watcher.close());
}
