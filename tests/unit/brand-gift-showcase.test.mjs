import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';
import { journeySteps, mountJourney } from '../../web/js/features/marketing/journey.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function fixture(signal) {
  const listeners = new Map();
  const scene = { dataset: {} };
  const closedLabel = { hidden: false };
  const openLabel = { hidden: true };
  const message = { hidden: true };
  const toggle = {
    attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector(selector) { return selector === '[data-mkt-gift-label-open]' ? openLabel : closedLabel; },
  };
  const buttons = journeySteps.map(id => ({ dataset: { mktStep: id }, setAttribute() {} }));
  const panels = journeySteps.map(id => ({
    dataset: { mktPanel: id },
    querySelector(selector) { return selector === '[data-mkt-gift-toggle]' ? toggle : message; },
  }));
  const host = {
    querySelector: () => scene,
    querySelectorAll: selector => selector === '[data-mkt-step]' ? buttons : panels,
    contains: button => buttons.includes(button),
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  const dispose = mountJourney({ querySelector: () => host }, { signal });
  const click = target => listeners.get('click')({ target: { closest: selector =>
    selector === '[data-mkt-gift-toggle]' ? (target === toggle ? target : null) : target } });
  return { scene, closedLabel, openLabel, message, toggle, click, buttons, dispose };
}

test('Mở và đóng quà mẫu đồng bộ trạng thái cảnh, nhãn và ARIA', () => {
  const f = fixture();
  f.click(f.toggle);
  assert.equal(f.scene.dataset.giftOpen, 'false', 'không mở ngoài bước Open');
  f.click(f.buttons[2]);
  assert.equal(f.message.hidden, true);
  f.click(f.toggle);
  assert.equal(f.scene.dataset.giftOpen, 'true');
  assert.equal(f.toggle.attrs['aria-expanded'], 'true');
  assert.equal(f.closedLabel.hidden, true);
  assert.equal(f.openLabel.hidden, false);
  assert.equal(f.message.hidden, false);
  f.click(f.toggle);
  assert.equal(f.scene.dataset.giftOpen, 'false');
  assert.equal(f.toggle.attrs['aria-expanded'], 'false');
  assert.equal(f.closedLabel.hidden, false);
  assert.equal(f.openLabel.hidden, true);
  assert.equal(f.message.hidden, true);
  f.dispose();
});

test('Đổi bước đặt lại quà, chọn lại cùng bước không đặt lại, dispose ngăn click cũ', () => {
  const lifetime = new AbortController();
  const f = fixture(lifetime.signal);
  f.click(f.buttons[2]);
  f.click(f.toggle);
  f.click(f.buttons[2]);
  assert.equal(f.scene.dataset.giftOpen, 'true');
  f.click(f.buttons[3]);
  assert.equal(f.scene.dataset.giftOpen, 'false');
  f.click(f.buttons[2]);
  assert.equal(f.message.hidden, true);
  lifetime.abort();
  f.click(f.toggle);
  f.click(f.buttons[4]);
  assert.equal(f.scene.dataset.giftOpen, 'false');
  assert.equal(f.scene.dataset.stage, 'open');
});

test('Demo chỉ có một nút native, nội dung song ngữ và liên kết ARIA hợp lệ', () => {
  const html = createHomeViews({ state: { templates: [] }, buttonLink: (url, label) => `<a href="${url}">${label}</a>`, templateCard: () => '' }).home();
  assert.equal((html.match(/data-mkt-gift-toggle\b/g) || []).length, 1);
  assert.match(html, /type="button"[^>]*data-mkt-gift-toggle aria-expanded="false" aria-controls="mkt-journey-gift-message"/);
  assert.match(html, /id="mkt-journey-gift-message" data-mkt-gift-message hidden/);
  assert.match(html, /data-mkt-journey-scene data-stage="create" data-gift-open="false" aria-hidden="true"/);
  for (const lang of ['vi', 'en']) {
    const locale = JSON.parse(read(`web/assets/locales/${lang}.json`));
    for (const key of ['open', 'close', 'message']) assert(locale[`home.journey.gift.${key}`]);
  }
  const css = read('web/css/marketing-journey.css');
  assert.match(css, /\[data-stage="open"\]\[data-gift-open="true"\] \.mkt-journey__postcard/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.mkt-journey__gift-lid \{\s*transition: none;/);
});
