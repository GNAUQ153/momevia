import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isExcludedSourcePath } from '../release/policy.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
const assetRoot = 'web/assets';
const fontRoot = `${assetRoot}/fonts/app`;
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Chỉ đọc tài nguyên nguồn, bỏ qua bundle sinh bởi build và đường dẫn riêng tư.
function walk(root, relative) {
  if (relative === `${assetRoot}/app` || isExcludedSourcePath(relative)) return [];
  const full = path.join(root, relative);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw new Error(`Asset symlink: ${relative}`);
  if (stat.isDirectory()) {
    return fs.readdirSync(full).sort(order).flatMap(name => walk(root, `${relative}/${name}`));
  }
  if (!stat.isFile()) throw new Error(`Unsupported asset: ${relative}`);
  return [{ file: relative, bytes: stat.size, sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex') }];
}

export function summarizeAssets(files) {
  const groups = new Map();
  const hashes = new Map();
  for (const entry of files) {
    const name = entry.file.slice(assetRoot.length + 1).split('/')[0];
    const group = groups.get(name) ?? { name, files: 0, bytes: 0 };
    group.files++;
    group.bytes += entry.bytes;
    groups.set(name, group);
    const matches = hashes.get(entry.sha256) ?? [];
    matches.push(entry);
    hashes.set(entry.sha256, matches);
  }
  const duplicates = [...hashes.values()].filter(items => items.length > 1).map(items => ({
    sha256: items[0].sha256,
    bytesEach: items[0].bytes,
    repeatedBytes: (items.length - 1) * items[0].bytes,
    files: items.map(item => item.file).sort(order),
  })).sort((a, b) => b.repeatedBytes - a.repeatedBytes || order(a.sha256, b.sha256));
  return {
    files: files.length,
    bytes: files.reduce((sum, item) => sum + item.bytes, 0),
    groups: [...groups.values()].sort((a, b) => b.bytes - a.bytes || order(a.name, b.name)),
    duplicateGroups: duplicates.length,
    repeatedBytes: duplicates.reduce((sum, item) => sum + item.repeatedBytes, 0),
    duplicates,
  };
}

export function auditFontManifest(manifest, files) {
  if (!Array.isArray(manifest?.fonts) || !manifest.fonts.length) throw new Error('Invalid font manifest');
  const byFile = new Map(files.map(entry => [entry.file, entry]));
  const seen = new Set();
  const issues = [];
  for (const font of manifest.fonts) {
    if (typeof font?.file !== 'string' || !/^[\w.-]+\.woff2$/.test(font.file) || seen.has(font.file)) {
      throw new Error('Invalid or duplicate font filename');
    }
    seen.add(font.file);
    const entry = byFile.get(`${fontRoot}/${font.file}`);
    if (!entry) issues.push({ file: font.file, reason: 'missing' });
    else if (entry.bytes !== font.bytes || entry.sha256 !== font.sha256) issues.push({ file: font.file, reason: 'manifest-mismatch' });
  }
  for (const entry of files) {
    if (entry.file.startsWith(`${fontRoot}/`) && entry.file.endsWith('.woff2') && !seen.has(entry.file.slice(fontRoot.length + 1))) {
      issues.push({ file: entry.file, reason: 'not-in-manifest' });
    }
  }
  return { checked: seen.size, issues };
}

export function runAssetAudit(root = project) {
  // Không đi qua đường dẫn web/ hoặc assets/ là symlink.
  if (fs.lstatSync(path.join(root, 'web')).isSymbolicLink()) throw new Error('Asset parent symlink');
  const files = walk(root, assetRoot);
  const manifestPath = `${fontRoot}/manifest.json`;
  if (!files.some(entry => entry.file === manifestPath)) throw new Error('Missing font manifest');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
  return {
    mode: 'advisory-only',
    scope: assetRoot,
    excluded: ['web/assets/app', 'release policy exclusions'],
    ...summarizeAssets(files),
    fontManifest: auditFontManifest(manifest, files),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = runAssetAudit();
  console.log(JSON.stringify(report, null, 2));
  if (report.fontManifest.issues.length) process.exitCode = 1;
}
