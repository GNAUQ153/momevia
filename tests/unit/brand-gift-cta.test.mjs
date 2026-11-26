import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';
import { mountHomeChoices } from '../../web/js/features/marketing/hero-templates.js';

function fixture() {
  const triggers = [new EventTarget(), new EventTarget()];
  for (const trigger of triggers) {
    trigger.isConnected = true;
    trigger.focus = () => { trigger.focused = true; };
  }
  const closeButton = new EventTarget();
  const firstChoice = { focus() { this.focused = true; } };
  const dialog = Object.assign(new EventTarget(), {
    open: false,
    opens: 0,
    showModal() { this.open = true; this.opens++; },
    close() { this.open = false; this.dispatchEvent(new Event('close')); },
    querySelector(selector) { return selector === '.home-create-choice' ? firstChoice : closeButton; },
  });
  const dispose = mountHomeChoices({ querySelector: () => dialog, querySelectorAll: () => triggers });
  return { triggers, dialog, firstChoice, closeButton, dispose };
}

test('Hai CTA dùng chung dialog và trả focus về đúng nút mở', () => {
  const { triggers, dialog, firstChoice, closeButton, dispose } = fixture();
  triggers[0].dispatchEvent(new Event('click'));
  assert.equal(dialog.open, true);
  assert.equal(firstChoice.focused, true);
  closeButton.dispatchEvent(new Event('click'));
  assert.equal(triggers[0].focused, true);
  triggers[0].focused = false;
  triggers[1].dispatchEvent(new Event('click'));
  // Một click khác khi dialog mở không được thay đổi opener.
  triggers[0].dispatchEvent(new Event('click'));
  assert.equal(dialog.opens, 2);
  dialog.close();
  assert.equal(triggers[1].focused, true);
  assert.equal(triggers[0].focused, false);
  dispose();
});

test('Dispose đóng dialog và tháo listener của cả hai CTA', () => {
  const { triggers, dialog, dispose } = fixture();
  triggers[1].dispatchEvent(new Event('click'));
  dispose();
  assert.equal(dialog.open, false);
  triggers.forEach(trigger => trigger.dispatchEvent(new Event('click')));
  assert.equal(dialog.opens, 1);
  assert.equal(dialog.open, false);
});

test('CTA chỉ nằm trong vùng kết quả ẩn ban đầu và dùng nhãn VI/EN', () => {
  const html = createHomeViews({ state: { templates: [] }, buttonLink: (url, label) => `<a href="${url}">${label}</a>`, templateCard: () => '' }).home();
  assert.equal((html.match(/data-home-create-after-demo\b/g) || []).length, 1);
  assert.match(html, /data-mkt-gift-message hidden>\s*<p>[\s\S]*?<button type="button"[^>]*data-home-create-after-demo aria-haspopup="dialog">/);
  for (const lang of ['vi', 'en']) {
    const locale = JSON.parse(readFileSync(new URL(`../../web/assets/locales/${lang}.json`, import.meta.url), 'utf8'));
    assert(locale['home.journey.gift.create'].trim());
  }
});
