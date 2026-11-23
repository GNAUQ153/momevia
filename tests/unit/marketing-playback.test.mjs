import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';

// Kiểm thử trình bày tĩnh bổ sung cho browser regression của đồng hồ thiệp.
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const source = read('../../web/js/features/marketing/hero-templates.js');
const styles = read('../../web/css/marketing-immersive.css');
const vi = JSON.parse(read('../../web/assets/locales/vi.json'));
const en = JSON.parse(read('../../web/assets/locales/en.json'));
const html = createHomeViews({
  state: { templates: [] },
  buttonLink: (url, label) => `<a href="${url}">${label}</a>`,
  templateCard: () => '',
}).home();

test('Hero bỏ nút tạm dừng và giữ nguyên ba nút chọn mẫu', () => {
  assert.doesNotMatch(html, /data-hero-playback/);
  assert.equal((html.match(/data-hero-select=/g) || []).length, 3);
  assert.match(html, /data-hero-image=/);
  assert.match(html, /data-i18n-aria-label/);
});

test('Song ngữ VI/EN có hai trạng thái điều khiển autoplay', () => {
  for (const key of ['home.hero.pauseSlides', 'home.hero.resumeSlides']) {
    assert(vi[key]?.trim());
    assert(en[key]?.trim());
    assert.notEqual(vi[key], en[key]);
  }
  assert.match(source, /onLocaleChange\(\(\) => \{[^}]*syncPlayback\(\)/);
});

test('Tạm dừng đóng băng đồng hồ và không làm thay đổi dữ liệu thiệp', () => {
  assert.match(source, /!userPaused &&/);
  assert.match(source, /userPaused = !userPaused/);
  assert.match(source, /syncPlayback\(\);\s*schedule\(\)/);
  assert.match(source, /progress\?\.pause\(\)/);
  assert.match(source, /noteMotions\.forEach\(motion => motion\.pause\(\)\)/);
  assert.doesNotMatch(source, /localStorage\.setItem|fetch\(/);
});

test('Nút dễ chạm, không lỗi CSS một dòng và ẩn khi giảm chuyển động', () => {
  assert.match(styles, /\.mkt-hero__rotation \.mkt-hero__playback/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.mkt-hero__rotation \.mkt-hero__playback \{\s*display: none;/);
  assert.deepEqual(styles.split('\n').filter(line => /;\s*[\w-]+\s*:/.test(line)), []);
});
