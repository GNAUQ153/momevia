import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTemplatePreviews } from './template-previews.mjs';
import { buildLocalizedHtml } from './localized-html.mjs';
import { checkLocales } from '../quality/check-locales.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'node_modules/qrcode-generator/dist/qrcode.mjs');
const target = path.join(root, 'web/js/vendor/qrcode.js');
checkLocales();
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('Built local QR module (qrcode-generator 2.0.4, MIT).');
buildTemplatePreviews();
buildLocalizedHtml();

await import('./recipient-vendor.mjs');

// Đóng gói Fabric.js ESM kèm thông báo bản quyền nếu đã cài.
await import('./fabric-vendor.mjs');
await (await import('./client-bundles.mjs')).buildClientBundles();
