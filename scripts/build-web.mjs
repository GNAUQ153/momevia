import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/qrcode-generator/dist/qrcode.mjs');
const target = path.join(root, 'web/js/vendor/qrcode.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('Built local QR module (qrcode-generator 2.0.4, MIT).');
