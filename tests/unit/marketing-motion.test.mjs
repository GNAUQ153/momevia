import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';
import { mountMarketingMotion } from '../../web/js/features/marketing/scene-motion.js';

// Kiểm tra giao diện bằng dữ liệu mô phỏng; không sử dụng tài khoản thật.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const vi = JSON.parse(read('../../web/assets/locales/vi.json'));
const en = JSON.parse(read('../../web/assets/locales/en.json'));
const styles = read('../../web/css/marketing-immersive.css');
const index = read('../../web/index.html');
const app = read('../../web/js/app/main.js');
const home = read('../../web/js/pages/home.js');

function renderHome() {
  return createHomeViews({
    state: { templates: [] },
    buttonLink: (url, content) => `<a href="${url}" data-link>${content}</a>`,
    templateCard: () => '',
  }).home();
}

test('Trang chủ có preview thật, CTA và phần 3D không bắt buộc', () => {
  const html = renderHome();
  assert.match(html, /data-template-preview/);
  assert.match(html, /data-mkt-tilt/);
  assert.match(html, /data-mkt-reveal/);
  assert.match(html, /href="\/explore"/);
  assert.match(html, /href="#how-it-works"/);
  assert.doesNotMatch(html, /[\p{Extended_Pictographic}]/u);
});

test('Bản Anh và Việt dùng chính xác cùng các key trong trang chủ', () => {
  const keys = [...home.matchAll(/(?:text|attr)\(\s*['"](home\.[^'"]+)['"]/g)].map(match => match[1]);
  assert(keys.length >= 12);
  for (const key of keys) {
    assert.equal(typeof vi[key], 'string', `VI thiếu ${key}`);
    assert.equal(typeof en[key], 'string', `EN thiếu ${key}`);
  }
});

test('Hiệu ứng có bảo vệ reduced motion và tự hủy khi rời trang', () => {
  assert.equal(typeof mountMarketingMotion, 'function');
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(app, /disposeMarketingMotion\(\)/);
  assert.match(index, /marketing-immersive\.css/);
  assert.equal(typeof mountMarketingMotion(null), 'function');
});

test('CSS mới tách thuộc tính mỗi dòng và không nhúng font/emoji', () => {
  const declarations = styles.split('\n');
  const compact = declarations.filter(line => /;\s*[\w-]+\s*:/.test(line));
  assert.deepEqual(compact, []);
  assert.doesNotMatch(styles, /@import|fonts\.googleapis|cdn\./);
  assert.doesNotMatch(styles, /[\p{Extended_Pictographic}]/u);
});
