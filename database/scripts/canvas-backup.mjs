// Backup/restore verifier for synthetic isolated Docker QA only. It deliberately
// does not load .env, choose a production target, migrate or switch storage flags.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
function option(name) { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; }
const container = option('--container'), schema = option('--schema'), restore = option('--restore-test');
const media = path.resolve(option('--media-root') || '');
const legacyMedia = option('--legacy-media-root') ? path.resolve(option('--legacy-media-root')) : null;
const output = path.resolve(option('--output') || '');
if (process.env.CANVAS_QA_MYSQL_ISOLATED !== 'true' || !/^momevia-canvas-qa-[\w-]+$/.test(container || '') ||
    !/^momevia_canvas_qa_[a-z0-9_]+$/.test(schema || '') ||
    (restore && (!/^momevia_canvas_qa_[a-z0-9_]+$/.test(restore) || restore === schema))) {
  throw new Error('Explicit isolated QA container/schema required. Restore test must use a NEW different momevia_canvas_qa_* schema.');
}
const password = process.env.CANVAS_QA_MYSQL_PASSWORD;
if (!password) throw new Error('Explicit synthetic QA password required; .env is not read.');
function insideLocal(value) { const relative = path.relative(path.join(root, 'local'), value); return relative && !relative.startsWith('..') && !path.isAbsolute(relative); }
if (!option('--media-root') || !option('--output') || !insideLocal(media) || !insideLocal(output)) throw new Error('QA media/output must be explicitly inside this workspace local/.');
if (legacyMedia && !insideLocal(legacyMedia)) throw new Error('QA legacy media must be inside this workspace local/.');
if (fs.existsSync(output)) throw new Error('Backup output already exists; choose a new directory.');
const inspect = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
if (inspect.Config.Labels?.['momevia.qa'] !== 'canvas-20261117' || inspect.State.Status !== 'running') throw new Error('Target is not the dedicated running canvas QA container.');
const run = (program, argv, input) => execFileSync('docker', ['exec', ...(input ? ['-i'] : []), '-e', `MYSQL_PWD=${password}`, container,
  program, ...argv], { input, maxBuffer: 128 * 1024 * 1024 });
const sql = (target, statement) => run('mysql', ['-uroot', '--batch', '--skip-column-names', target, '-e', statement]).toString('utf8').trim();
const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const version = sql(schema, 'SELECT VERSION()');
if (!/^8\.4\./.test(version)) throw new Error('MySQL 8.4 required for the canvas fixture.');
const migrations = sql(schema, 'SELECT version FROM schema_migrations ORDER BY version').split('\n');
if (!migrations.includes('006_canvas')) throw new Error('Canvas migration006 absent; not a canvas backup.');
const assetQuery = "SELECT id,storage_key,content_hash,bytes FROM design_assets WHERE status='ready' ORDER BY id";
const before = sql(schema, assetQuery);
const assets = before ? before.split('\n').map(row => {
  const [id, storageKey, contentHash, bytes] = row.split('\t');
  if (!/^[\da-f-]{36}\.(png|jpg|webp)$/.test(storageKey)) throw new Error('Unexpected media storage key.');
  const file = path.join(media, storageKey);
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Media symlinks are not supported.');
  const data = fs.readFileSync(file);
  if (sha(data) !== contentHash || data.length !== Number(bytes)) throw new Error(`Media checksum/length mismatch for synthetic asset ${id}.`);
  return { id, storageKey, contentHash, bytes: data.length };
}) : [];
const legacyQuery = "SELECT DISTINCT image_file FROM gifts WHERE image_file IS NOT NULL AND image_file <> '' ORDER BY image_file";
const beforeLegacy = sql(schema, legacyQuery);
if (beforeLegacy && !legacyMedia) throw new Error('Legacy photos exist: specify --legacy-media-root.');
const legacyPhotos = beforeLegacy ? beforeLegacy.split('\n').map(storageKey => {
  if (!/^[\da-f-]{36}\.(png|jpg|webp)$/.test(storageKey)) throw new Error('Unexpected legacy media storage key.');
  const file = path.join(legacyMedia, storageKey);
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Legacy media symlinks are not supported.');
  const bytes = fs.readFileSync(file);
  return { storageKey, contentHash: sha(bytes), bytes: bytes.length };
}) : [];
const dumpArgs = ['-uroot', '--single-transaction', '--set-gtid-purged=OFF', '--no-tablespaces', '--hex-blob', '--order-by-primary', '--skip-comments', '--skip-dump-date'];
const dump = run('mysqldump', [...dumpArgs, schema]);
if (!dump.length) throw new Error('Empty database dump.');
fs.mkdirSync(path.join(output, 'media'), { recursive: true });
fs.writeFileSync(path.join(output, 'database.sql'), dump, { flag: 'wx' });
// A reviewed demo can have separate asset IDs for multiple owners and one immutable file.
const mediaFiles = [...new Map(assets.map(asset => [asset.storageKey, asset])).values()];
function copyMedia(files, source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const asset of files) {
    const data = fs.readFileSync(path.join(source, asset.storageKey));
    if (sha(data) !== asset.contentHash) throw new Error('Media checksum differs.');
    const destinationFile = path.join(destination, asset.storageKey);
    fs.writeFileSync(destinationFile, data, { flag: 'wx' });
    if (sha(fs.readFileSync(destinationFile)) !== asset.contentHash) throw new Error('Copied media checksum differs.');
  }
}
copyMedia(mediaFiles, media, path.join(output, 'media'));
copyMedia(legacyPhotos, legacyMedia, path.join(output, 'legacy-media'));
if (sql(schema, assetQuery) !== before || sql(schema, legacyQuery) !== beforeLegacy) throw new Error('Asset metadata changed during backup; retry with an idle fixture.');
const manifest = { formatVersion: 1, storage: 'mysql', fixture: true, mysqlVersion: version,
  createdAt: new Date().toISOString(), migrations, dumpHash: sha(dump), assets, legacyPhotos, restoreTest: null };
if (restore) {
  const exists = sql(schema, `SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${restore}'`);
  if (exists !== '0') throw new Error('Restore-test schema already exists; no overwrite is allowed.');
  sql(schema, `CREATE DATABASE \`${restore}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  run('mysql', ['-uroot', restore], dump);
  const originalData = run('mysqldump', [...dumpArgs, '--no-create-info', schema]);
  const restoredData = run('mysqldump', [...dumpArgs, '--no-create-info', restore]);
  if (sha(originalData) !== sha(restoredData)) throw new Error('Restored table content differs from original fixture.');
  if (sql(restore, assetQuery) !== before) throw new Error('Restored asset metadata differs.');
  copyMedia(mediaFiles, path.join(output, 'media'), path.join(output, 'restore-media'));
  copyMedia(legacyPhotos, path.join(output, 'legacy-media'), path.join(output, 'restore-legacy-media'));
  manifest.restoreTest = { status: 'PASS', schema: restore, dataHash: sha(restoredData), mediaCount: mediaFiles.length, legacyCount: legacyPhotos.length };
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(`PASS synthetic MySQL canvas backup: migrations=${migrations.length}, canvas refs=${assets.length}, legacy photos=${legacyPhotos.length}, dump checksum verified.`);
if (restore) console.log('PASS separate-schema restore: full table data parity and media byte/hash parity.');
