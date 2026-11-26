import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installAppFonts, verifyAppFonts, parseFontCss } from '../../scripts/assets/install-app-fonts.mjs';
import { textFont } from '../../web/js/features/gift-runtime/renderer.js';

const specs = [
  { family: 'Bricolage Grotesque', slug: 'bricolagegrotesque', styles: [['normal', '400 800']] },
  { family: 'Be Vietnam Pro', slug: 'bevietnampro', styles: [...['400','500','600','700','800'].map(w => ['normal',w]), ['italic','400'], ['italic','600']] },
  { family: 'Fraunces', slug: 'fraunces', styles: [['normal','400 800'],['italic','400 800']] },
];
const ranges = { latin: 'U+0000-00FF', 'latin-ext': 'U+0100-02FF', vietnamese: 'U+0300-0329, U+1EA0-1EF9' };
function css(spec) {
  return spec.styles.flatMap(([style, weight]) => Object.keys(ranges).map(subset => `/* ${subset} */\n@font-face {\n  font-family: '${spec.family}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/${spec.slug}/v1/${style}-${weight.replace(' ','-')}-${subset}.woff2) format('woff2');\n  unicode-range: ${ranges[subset]};\n}`)).join('\n');
}
function fixture(t) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-font-test-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const dir = path.join(project, 'web/assets/fonts/app');
  const cssPath = path.join(project, 'web/css/app-fonts.css');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), '{"fonts":[{"family":"Inter","file":"legacy.woff2"}]}\n');
  fs.writeFileSync(cssPath, '/* legacy CSS */\n');
  return { project, dir, cssPath };
}
async function get(url) {
  if (url.startsWith('https://fonts.googleapis.com/')) {
    const spec = specs.find(item => url.includes(item.family.replaceAll(' ', '+')));
    return Buffer.from(css(spec));
  }
  if (url.endsWith('OFL.txt')) return Buffer.from('SIL OPEN FONT LICENSE Version 1.1');
  // Chỉ fixture kiểm tra header WOFF2; không phải file font render được.
  const bytes = Buffer.alloc(48);
  bytes.write('wOF2');
  bytes.writeUInt32BE(bytes.length, 8);
  return bytes;
}

test('Đủ subset VI/EN, thứ tự Vietnamese cuối và đúng các weight', () => {
  const spec = specs[1];
  const faces = parseFontCss(css(spec), spec);
  assert.equal(faces.length, 21);
  assert.deepEqual(faces.slice(0, 3).map(face => face.subset), ['latin-ext', 'latin', 'vietnamese']);
});
test('Từ chối thiếu subset, thiếu phạm vi dấu và URL bên ngoài', () => {
  const spec = specs[0];
  assert.throws(() => parseFontCss(css(spec).replace(/\/\* vietnamese \*\/[\s\S]*?\}/, ''), spec), /Thiếu/);
  assert.throws(() => parseFontCss(css(spec).replace('U+1EA0-1EF9', 'U+1EA0'), spec), /Unicode/);
  assert.throws(() => parseFontCss(css(spec).replaceAll('fonts.gstatic.com','example.com'), spec), /descriptor/);
});
test('Cài đặt giữ manifest cũ, sinh CSS nội bộ và chạy lại không tải mạng', async t => {
  const { project, dir, cssPath } = fixture(t);
  assert.throws(() => verifyAppFonts(project), /Thiếu/);
  assert.deepEqual(await installAppFonts(project, get), { families: 3, faces: 30 });
  assert.deepEqual(await installAppFonts(project, () => { throw Error('network'); }), { families: 3, faces: 30 });
  const manifest = JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  assert.equal(manifest.fonts[0].file, 'legacy.woff2');
  assert.equal(manifest.typography.licenses.length, 3);
  assert.match(fs.readFileSync(cssPath,'utf8'), /^\/\* legacy CSS \*\//);
  assert.doesNotMatch(fs.readFileSync(cssPath,'utf8'), /https:\/\//);
});
test('Tải lỗi hoặc OFL không hợp lệ không ghi thay đổi', async t => {
  const { project, dir, cssPath } = fixture(t);
  await assert.rejects(installAppFonts(project, url => url.endsWith('OFL.txt') ? Buffer.from('bad') : get(url)), /OFL/);
  assert.deepEqual(fs.readdirSync(dir), ['manifest.json']);
  assert.equal(fs.readFileSync(cssPath,'utf8'), '/* legacy CSS */\n');
});
test('Kiểm tra offline phát hiện file font, license hoặc CSS bị sửa', async t => {
  const { project, dir, cssPath } = fixture(t);
  await installAppFonts(project, get);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  const font = path.join(dir,manifest.fonts[1].file);
  const original = fs.readFileSync(font);
  fs.writeFileSync(font, 'bad');
  assert.throws(() => verifyAppFonts(project), /Font lỗi/);
  fs.writeFileSync(font, original);
  const license = path.join(dir,manifest.typography.licenses[0].file);
  const licenseBytes = fs.readFileSync(license);
  fs.writeFileSync(license, 'bad');
  assert.throws(() => verifyAppFonts(project), /Giấy phép lỗi/);
  fs.writeFileSync(license, licenseBytes);
  fs.appendFileSync(cssPath, '/* unexpected */');
  assert.throws(() => verifyAppFonts(project), /CSS font/);
});
test('Token chữ Canvas tách khỏi bộ font UI mới', () => {
  assert.equal(textFont('heading'), 'var(--canvas-font-display)');
  assert.equal(textFont('body'), 'var(--canvas-font-body)');
  assert.equal(textFont('serif'), 'var(--canvas-font-serif)');
  const tokens = fs.readFileSync(new URL('../../web/css/tokens.css',import.meta.url),'utf8');
  assert.match(tokens, /\.editor-artboard,\s*\.gift-runtime-stage\s*\{\s*--font-display: var\(--canvas-font-display\)/);
  const marketing = fs.readFileSync(new URL('../../web/css/marketing.css',import.meta.url),'utf8');
  assert.doesNotMatch(marketing, /--font-display: var\(--mkt-font\)/);
  assert.match(marketing, /font-family: var\(--font-display\)/);
});
