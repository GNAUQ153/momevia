import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fontDir = 'web/assets/fonts/app';
const cssPath = 'web/css/app-fonts.css';
const marker = '/* Phase 4.1 — font nhận diện Momevia (tự sinh). */';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const subsets = ['latin-ext', 'latin', 'vietnamese'];
const specs = [
  { family: 'Bricolage Grotesque', slug: 'bricolagegrotesque', query: 'Bricolage+Grotesque:wght@400..800', styles: [['normal', '400 800']] },
  { family: 'Be Vietnam Pro', slug: 'bevietnampro', query: 'Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600', styles: [...['400', '500', '600', '700', '800'].map(w => ['normal', w]), ['italic', '400'], ['italic', '600']] },
  { family: 'Fraunces', slug: 'fraunces', query: 'Fraunces:ital,wght@0,400..800;1,400..800', styles: [['normal', '400 800'], ['italic', '400 800']] },
];
const keys = spec => spec.styles.flatMap(([style, weight]) => subsets.map(subset => `${style}/${weight}/${subset}`));
const faceKey = face => `${face.style}/${face.weight}/${face.subset}`;
const googleCss = spec => `https://fonts.googleapis.com/css2?family=${spec.query}&display=swap`;
const licenseUrl = spec => `https://raw.githubusercontent.com/google/fonts/main/ofl/${spec.slug}/OFL.txt`;

// Chỉ chấp nhận URL font từ CDN chính thức, không follow redirect.
function validSource(source) {
  return /^https:\/\/fonts\.gstatic\.com\/s\/[a-z0-9_-]+\/v\d+\/[A-Za-z0-9_-]+\.woff2$/.test(source);
}
function checkFaces(spec, faces) {
  const expected = keys(spec);
  const actual = faces.map(faceKey);
  if (expected.length !== actual.length || new Set(actual).size !== actual.length || expected.some(key => !actual.includes(key))) {
    throw new Error(`Thiếu hoặc trùng font/subset: ${spec.family}`);
  }
  for (const face of faces) {
    if (face.family !== spec.family || !validSource(face.source) || !/^U\+[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})?(?:, U\+[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})?)*$/i.test(face.range)) throw new Error('Font descriptor không hợp lệ');
  }
  // Kiểm tra phạm vi Unicode được khai báo cho mọi style/weight, không thay thế kiểm tra glyph thật.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĐđ';
  const accented = [...'aăâeêioôơuưyAĂÂEÊIOÔƠUƯY'].flatMap(letter =>
    ['', '\u0300', '\u0301', '\u0303', '\u0309', '\u0323'].map(tone => (letter + tone).normalize('NFC'))).join('');
  for (const [style, weight] of spec.styles) {
    const ranges = faces.filter(face => face.style === style && face.weight === weight)
      .flatMap(face => face.range.split(', ').map(range => range.slice(2).split('-').map(hex => Number.parseInt(hex, 16))));
    for (const char of new Set([...alphabet, ...accented, ...'\u0300\u0301\u0303\u0309\u0323'])) {
      const point = char.codePointAt(0);
      if (!ranges.some(([start, end = start]) => point >= start && point <= end)) throw new Error(`Thiếu Unicode ${char}: ${spec.family}`);
    }
  }
}
export function parseFontCss(css, spec) {
  const faces = [];
  for (const block of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^{}]*)\}/g)) {
    const [, subset, body] = block;
    if (!subsets.includes(subset)) continue;
    const field = name => new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+);`, 'm').exec(body)?.[1].trim();
    const family = field('font-family')?.replace(/^['"]|['"]$/g, '');
    const source = /^url\((https:\/\/[^)]+)\)\s+format\(['"]woff2['"]\)$/.exec(field('src') || '')?.[1];
    faces.push({ family, subset, style: field('font-style'), weight: field('font-weight')?.replace(/\s+/g, ' '), source, range: field('unicode-range')?.replace(/,\s*/g, ', ') });
  }
  checkFaces(spec, faces);
  // Đặt latin-ext trước latin và Vietnamese cuối để ưu tiên bộ dấu tiếng Việt.
  return keys(spec).map(key => faces.find(face => faceKey(face) === key));
}
function filename(spec, face, sha256) {
  return `${spec.slug}-${face.style}-${face.weight.replace(' ', '-')}-${face.subset}-${sha256.slice(0, 12)}.woff2`;
}
function validWoff2(bytes) {
  return bytes.length >= 48 && bytes.toString('ascii', 0, 4) === 'wOF2' && bytes.readUInt32BE(8) === bytes.length;
}
function generatedCss(fonts) {
  return `${marker}\n` + fonts.map(face => `\n/* ${face.family} / ${face.subset} */\n@font-face {\n  font-family: '${face.family}';\n  font-style: ${face.style};\n  font-weight: ${face.weight};\n  font-display: swap;\n  src: url(/assets/fonts/app/${face.file}) format('woff2');\n  unicode-range: ${face.range};\n}\n`).join('');
}
async function download(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' } });
  if (!response.ok) throw new Error(`Tải font thất bại: HTTP ${response.status} — ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Dung lượng tài nguyên font không hợp lệ');
  return bytes;
}
function isLicense(bytes) {
  return /SIL OPEN FONT LICENSE/i.test(bytes.toString('utf8')) && /Version 1\.1/i.test(bytes.toString('utf8'));
}
export function verifyAppFonts(project = root) {
  const read = file => fs.readFileSync(path.join(project, fontDir, file));
  const manifest = JSON.parse(read('manifest.json'));
  const faces = manifest.fonts.filter(font => specs.some(spec => spec.family === font.family));
  for (const spec of specs) {
    const family = faces.filter(face => face.family === spec.family);
    checkFaces(spec, family);
    for (const face of family) {
      if (!/^[a-f0-9]{64}$/.test(face.sha256) || face.file !== filename(spec, face, face.sha256)) throw new Error('Tên font không khớp checksum');
      const bytes = read(face.file);
      if (!validWoff2(bytes) || bytes.length !== face.bytes || hash(bytes) !== face.sha256) throw new Error(`Font lỗi: ${face.file}`);
    }
    const license = manifest.typography?.licenses?.find(item => item.family === spec.family);
    if (!license || license.file !== `${spec.slug}-OFL.txt` || license.source !== licenseUrl(spec)) throw new Error(`Thiếu giấy phép: ${spec.family}`);
    const bytes = read(license.file);
    if (!isLicense(bytes) || hash(bytes) !== license.sha256) throw new Error(`Giấy phép lỗi: ${spec.family}`);
  }
  const css = fs.readFileSync(path.join(project, cssPath), 'utf8').replace(/\r\n/g, '\n');
  if (!css.endsWith(generatedCss(faces)) || css.split(marker).length !== 2) throw new Error('CSS font chưa khớp manifest');
  return { families: specs.length, faces: faces.length };
}
export async function installAppFonts(project = root, get = download) {
  const dir = path.join(project, fontDir);
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const css = fs.readFileSync(path.join(project, cssPath), 'utf8').replace(/\r\n/g, '\n');
  if (manifest.typography || css.includes(marker) || manifest.fonts.some(font => specs.some(spec => spec.family === font.family))) return verifyAppFonts(project);
  const pending = new Map();
  const downloaded = new Map();
  const faces = [];
  const licenses = [];
  // Tải và xác minh tất cả trước khi ghi; không sửa font cũ.
  for (const spec of specs) {
    const parsed = parseFontCss((await get(googleCss(spec))).toString('utf8'), spec);
    for (const face of parsed) {
      if (!downloaded.has(face.source)) downloaded.set(face.source, await get(face.source));
      const bytes = downloaded.get(face.source);
      if (!validWoff2(bytes)) throw new Error(`Không phải WOFF2 hợp lệ: ${face.source}`);
      const sha256 = hash(bytes);
      const file = filename(spec, face, sha256);
      pending.set(file, bytes);
      faces.push({ ...face, file, sha256, bytes: bytes.length, license: 'SIL Open Font License 1.1' });
    }
    const source = licenseUrl(spec);
    const bytes = await get(source);
    if (!isLicense(bytes)) throw new Error(`Thiếu OFL: ${spec.family}`);
    const file = `${spec.slug}-OFL.txt`;
    pending.set(file, bytes);
    licenses.push({ family: spec.family, file, source, sha256: hash(bytes) });
  }
  for (const [file, bytes] of pending) {
    const target = path.join(dir, file);
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes)) throw new Error(`File đã tồn tại: ${file}`);
  }
  // Sau lỗi ghi đĩa, chạy lại hoặc khôi phục file theo git status trước khi commit.
  for (const [file, bytes] of pending) fs.writeFileSync(path.join(dir, file), bytes);
  fs.writeFileSync(path.join(project, cssPath), `${css.trimEnd()}\n\n${generatedCss(faces)}`);
  manifest.fonts.push(...faces);
  manifest.typography = { cssSources: specs.map(googleCss), licenses };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyAppFonts(project);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = process.argv.includes('--check') ? verifyAppFonts() : await installAppFonts();
    console.log(`PASS typography: ${result.families} families, ${result.faces} faces.`);
  } catch (error) {
    console.error(`Typography: ${error.message}. Chạy npm run fonts:install trước khi build/commit.`);
    process.exitCode = 1;
  }
}
