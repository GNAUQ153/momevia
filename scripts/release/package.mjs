import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isExcludedSourcePath } from './policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'dist/release');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!fs.existsSync(path.join(root, 'web/js/vendor/qrcode.js'))) throw new Error('Run npm ci and npm run build first.');
if (path.relative(root, output) !== path.join('dist', 'release')) throw new Error('Unexpected output path');
for (const directory of [path.dirname(output), output]) {
  if (fs.existsSync(directory)) {
    const expected = path.join(fs.realpathSync(root), path.relative(root, directory));
    if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== expected) {
      throw new Error('Refusing release output through a link or outside the workspace');
    }
  }
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
// Allowlist roots; never package local settings, generated business data or dependencies.
const roots = [
  'src', 'services', 'web', 'scripts', 'tests', 'docs',
  'deploy/https',
  '.github',
  'database/compose.yml',
  'database/migrations',
  'database/scripts',
  'database/verify.sql',
  'gateway.mjs',
  'dev.mjs',
  'start-local.bat',
  'package.json',
  'package-lock.json',
  'README.md',
  'CHANGELOG.md',
  '.env.example',
  '.gitignore',
  'eslint.config.mjs'
];

function copy(source, target) {
  if (isExcludedSourcePath(path.relative(root, source))) return;

  const stat = fs.lstatSync(source);

  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing symlink: ${source}`);
  }

  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });

    for (const entry of fs.readdirSync(source)) {
      copy(path.join(source, entry), path.join(target, entry));
    }
  } else {
    // Tạo thư mục đích trước khi sao chép file.
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

for (const entry of roots) copy(path.join(root, entry), path.join(output, entry));
function entries(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? entries(filename) : [filename];
  });
}
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
const manifest = {
  version: packageInfo.version, createdAt: new Date().toISOString(),
  commit: commit.status === 0 ? commit.stdout.trim() : null,
  dirty: status.status === 0 ? Boolean(status.stdout.trim()) : null,
  files: entries(output).sort().map(filename => ({
    path: path.relative(output, filename).split(path.sep).join('/'),
    sha256: createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
  })),
};
fs.writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Packaged ${manifest.files.length} files at dist/release (dirty=${manifest.dirty}).`);
