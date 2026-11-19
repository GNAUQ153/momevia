import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = path.join(root, 'node_modules/fabric');
const source = path.join(packageRoot, 'dist/index.min.mjs');
const target = path.join(root, 'web/js/vendor/fabric.mjs');
const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt']
  .map(filename => path.join(packageRoot, filename))
  .find(filename => fs.existsSync(filename));

// Fabric là công cụ nâng cao tùy chọn. Không phụ thuộc CDN hoặc làm hỏng editor cũ.
if (!fs.existsSync(source)) {
  console.log('Fabric Studio chưa cài: npm install --save-exact fabric@7.4.0');
} else {
  if (!license) throw new Error('Thiếu giấy phép Fabric.js trong npm package.');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  fs.copyFileSync(license, path.join(root, 'web/js/vendor/FABRIC_LICENSE.txt'));
  console.log('Built local Fabric.js 7.4.0 ESM bundle (MIT).');
}
