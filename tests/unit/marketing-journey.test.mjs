import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';
import { journeySteps, mountJourney } from '../../web/js/features/marketing/journey.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../../web/css/marketing-journey.css');
const vi = JSON.parse(read('../../web/assets/locales/vi.json'));
const en = JSON.parse(read('../../web/assets/locales/en.json'));
const html = createHomeViews({
  state: { templates: [] },
  buttonLink: (url, content) => `<a href="${url}" data-link>${content}</a>`,
  templateCard: () => '',
}).home();

test('Hành trình có đúng 5 bước, CTA thật và một layout VI/EN', () => {
  assert.deepEqual(journeySteps, ['create', 'share', 'open', 'reply', 'keep']);
  assert.match(html, /data-mkt-journey/);
  assert.match(html, /data-mkt-journey-scene/);
  assert.match(html, /href="\/explore"/);
  assert.equal((html.match(/data-mkt-step="/g) || []).length, 5);
  assert.equal((html.match(/data-mkt-panel="/g) || []).length, 5);
  assert.doesNotMatch(html, /[\p{Extended_Pictographic}]/u);
  for (const id of journeySteps) {
    for (const key of [`home.journey.${id}.title`, `home.journey.${id}.body`]) {
      assert.equal(typeof vi[key], 'string', key);
      assert.equal(typeof en[key], 'string', key);
    }
  }
});

test('3D CSS dùng backface thực, có reduced motion, không nén code hay tải library', () => {
  assert.match(css, /perspective:/);
  assert.match(css, /backface-visibility:/);
  assert.match(css, /transform-style: preserve-3d/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /@import|fonts\.googleapis|cdn\./);
  assert.deepEqual(css.split('\n').filter(line => /;\s*[\w-]+\s*:/.test(line)), []);
});

test('Điều khiển có thể đổi bước, điều hướng bàn phím và hủy listener', () => {
  const callbacks = new Map();
  const buttons = journeySteps.map(step => ({
    dataset: { mktStep: step },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; },
  }));
  const panels = journeySteps.map(step => ({ dataset: { mktPanel: step }, hidden: false }));
  const scene = { dataset: {} };
  const host = {
    querySelectorAll(selector) { return selector === '[data-mkt-step]' ? buttons : panels; },
    querySelector() { return scene; },
    contains(element) { return buttons.includes(element); },
    addEventListener(type, handler) { callbacks.set(type, handler); },
  };
  const dispose = mountJourney({ querySelector: () => host });
  assert.equal(scene.dataset.stage, 'create');
  assert.equal(buttons[0].attributes['aria-pressed'], 'true');
  callbacks.get('click')({ target: { closest: () => buttons[2] } });
  assert.equal(scene.dataset.stage, 'open');
  assert.equal(panels[2].hidden, false);
  assert.equal(panels[1].hidden, true);
  let prevented = false;
  callbacks.get('keydown')({
    key: 'ArrowRight', target: { closest: () => buttons[2] }, preventDefault() { prevented = true; },
  });
  assert.equal(scene.dataset.stage, 'reply');
  assert.equal(buttons[3].focused, true);
  assert.equal(prevented, true);
  dispose();
  dispose();
});
