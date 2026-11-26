import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';
import { journeySteps } from '../../web/js/features/marketing/journey.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('web/css/marketing-journey.css');
const html = createHomeViews({
  state: { templates: [] },
  buttonLink: (url, label) => `<a href="${url}" data-link>${label}</a>`,
  templateCard: () => '',
}).home();

test('Bento giữ năm nút đúng thứ tự, mỗi nút điều khiển panel thật', () => {
  const buttons = [...html.matchAll(/data-mkt-step="([a-z]+)" aria-pressed="(true|false)" aria-controls="([^"]+)"/g)];
  assert.deepEqual(buttons.map(match => match[1]), journeySteps);
  assert.equal(buttons.filter(match => match[2] === 'true').length, 1);
  for (const [, step, , panel] of buttons) {
    assert.equal(panel, `mkt-journey-panel-${step}`);
    assert(html.includes(`id="${panel}" data-mkt-panel="${step}"`));
  }
});

test('Bento dùng hai cột trên desktop và giữ rail mobile', () => {
  assert.match(css, /@media \(min-width: 901px\) \{\s*\.is-home \.mkt-journey__steps \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\[data-mkt-step="create"\] \{\s*grid-column: 1 \/ -1;/);
  assert.match(css, /@media \(max-width: 500px\) \{[\s\S]*?grid-auto-flow: column;[\s\S]*?overflow-x: auto;/);
  assert.match(css, /box-shadow: inset 0 0 0 1px var\(--mkt-action\)/);
});

test('Hover giới hạn thiết bị và giảm chuyển động, hướng dẫn có VI/EN', () => {
  assert.match(css, /@media \(min-width: 901px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(html, /aria-describedby="mkt-journey-keyboard-hint"/);
  assert.match(html, /id="mkt-journey-keyboard-hint" class="visually-hidden"/);
  for (const lang of ['vi', 'en']) {
    const locale = JSON.parse(read(`web/assets/locales/${lang}.json`));
    assert(locale['home.journey.keyboardHint']?.length > 20);
  }
  assert.match(read('web/index.html'), /marketing-journey\.css\?v=20261127-gift-showcase/);
});
