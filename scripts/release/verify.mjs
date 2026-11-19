import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isExcludedSourcePath } from './policy.mjs';

const root = fs.realpathSync(path.resolve(process.argv[2] || 'dist/release'));
const manifestPath = path.join(root, 'release-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expected = new Set(['release-manifest.json']);

if (!Array.isArray(manifest.files)) {
  throw new Error('Release manifest thiếu danh sách file.');
}

for (const entry of manifest.files) {
  const relative = entry?.path;
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || isExcludedSourcePath(relative)) {
    throw new Error(`Forbidden manifest path: ${relative}`);
  }
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep) ||
    path.relative(root, absolute).split(path.sep).join('/') !== relative ||
    expected.has(relative)) {
    throw new Error(`Unsafe or duplicate manifest path: ${relative}`);
  }
  const info = fs.lstatSync(absolute);
  if (!info.isFile() || info.isSymbolicLink() || fs.realpathSync(absolute) !== absolute) {
    throw new Error(`Unsafe release file: ${relative}`);
  }
  expected.add(relative);
  const sha256 = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  if (sha256 !== entry.sha256) {
    throw new Error(`Checksum mismatch: ${relative}`);
  }
}

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    // Không bỏ qua node_modules hay thư mục rỗng: tệp lạ nào cũng phải bị phát hiện.
    if (isExcludedSourcePath(relative) || entry.isSymbolicLink()) {
      throw new Error(`Unexpected release entry: ${relative}`);
    }
    if (entry.isDirectory()) inspect(absolute);
    else if (!entry.isFile() || !expected.has(relative)) {
      throw new Error(`Unexpected release file: ${relative}`);
    }
  }
}

inspect(root);
console.log(`PASS Release manifest: ${manifest.files.length} files, checksums and source exclusions.`);
