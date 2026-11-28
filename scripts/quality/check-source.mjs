import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { ESLint } from 'eslint';
import {createHash} from 'node:crypto';
import { checkLocales } from './check-locales.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
checkLocales();
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.name !== 'data').flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}
const files = ['dev.mjs', 'gateway.mjs', ...['src', 'services', 'scripts', 'tests', 'web/js'].flatMap(dir => walk(path.join(root, dir)))];
for (const file of files.filter(file => /\.(mjs|js)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Syntax error: ${file}\n${result.stderr}`);
}
for (const file of walk(path.join(root, '.github/workflows')).filter(file => /\.ya?ml$/.test(file))) {
  const workflow = load(fs.readFileSync(file, 'utf8'));
  if (!workflow.on || !workflow.jobs) throw new Error(`Invalid workflow structure: ${file}`);
}
const vendor = fs.readFileSync(path.join(root, 'web/js/vendor/qrcode.js'));
const giftSource=JSON.parse(fs.readFileSync(path.join(root,'web/assets/animations/goodeisgn-gift-source.json'),'utf8'));
for(const asset of giftSource.files)if(createHash('sha256').update(fs.readFileSync(path.join(root,asset.file))).digest('hex')!==asset.sha256)throw new Error('Reviewed gift source hash mismatch: '+asset.file);
if (!vendor.equals(fs.readFileSync(path.join(root, 'node_modules/qrcode-generator/dist/qrcode.mjs')))) {
  throw new Error('QR module is out of date. Run npm run build.');
}
const lint = new ESLint({ cwd: root });
const results = await lint.lintFiles(['src', 'scripts', 'tests', 'web/js', 'dev.mjs', 'gateway.mjs']);
if (results.some(result => result.errorCount)) {
  console.error((await lint.loadFormatter('stylish')).format(results));
  throw new Error('Unresolved JavaScript identifiers');
}
console.log('PASS JavaScript syntax/scope, workflow YAML and local QR module.');
