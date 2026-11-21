import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGiftViews } from '../../web/js/pages/gifts.js';
import { advanceRecipientStage, recipientJourneyMarkup, RECIPIENT_STAGES } from '../../web/js/features/gifts/recipient-journey.js';
import { translate, vi } from '../../web/js/shared/locale.js';
import en from '../../web/assets/locales/en.json' with { type: 'json' };

const translated = (dictionary, locale, key) => translate(dictionary, locale, key);

function legacyGift(message = 'Chúc <mừng>') {
  return {
    slug: 'sample-gift', theme: 'violet', senderName: 'Người gửi',
    recipientName: 'Bạn', message,
    replyPermissions: { canSend: false, canRead: false, repliesDisabled: true },
    replyCount: 0,
  };
}

function views() {
  return createGiftViews({ state: { user: null, favorites: new Set() }, buttonLink: (url, label) => `<a href="${url}">${label}</a>` });
}

function fakeCard() {
  const classes = new Set();
  const steps = RECIPIENT_STAGES.map(recipientStage => ({
    dataset: { recipientStage },
    attrs: recipientStage === 'sealed' ? { 'aria-current': 'step' } : {},
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
  }));
  const status = { textContent: '' };
  const wrapper = {
    querySelectorAll(selector) { assert.equal(selector, '[data-recipient-stage]'); return steps; },
    querySelector(selector) { return selector === '[data-recipient-status]' ? status : null; },
  };
  const card = {
    classList: {
      contains(key) { return classes.has(key); },
      toggle(key, active) { if (active) classes.add(key); else classes.delete(key); },
    },
    closest(selector) { assert.equal(selector, '.recipient-wrapper'); return wrapper; },
    // Trường hợp node đã rời DOM: không ép focus vào giao diện đã đóng.
    querySelector(selector) { assert.match(selector, /^\.recipient-(surprise h2|opened h1)$/); return { isConnected: false }; },
  };
  return { card, steps, status, classes };
}

test('Sender share guide displays three localized steps without replacing invite privacy rules', () => {
  const source = fs.readFileSync(new URL('../../web/js/pages/gifts.js', import.meta.url), 'utf8');
  assert.match(source, /gift\.share\.guide\.label/);
  const enSteps = ['preview', 'copy', 'send'].map(key => translated(en, 'en', `gift.share.guide.${key}`));
  assert.deepEqual(enSteps, ['Preview your gift', 'Copy the right link', 'Send it personally']);
  assert.match(translated(en, 'en', 'gift.share.guide.hint'), /invitation link/);
  assert.match(source, /primaryInvited \? gift\.inviteUrl : gift\.url/);
});

test('Legacy recipient renders three announced steps, and private message remains escaped', () => {
  const html = views().giftPage(legacyGift());
  assert.equal((html.match(/data-recipient-stage=/g) ?? []).length, 3);
  assert.match(html, /data-recipient-stage="sealed" aria-current="step"/);
  assert.match(html, /data-recipient-status role="status" aria-live="polite"/);
  assert.match(html, /Chúc &lt;mừng&gt;/);
  assert.doesNotMatch(html, /Chúc <mừng>/);
  assert.equal((recipientJourneyMarkup().match(/aria-current="step"/g) ?? []).length, 1);
});

test('Recipient advances only sealed → surprise → opened; repeated clicks do nothing', () => {
  const { card, steps, status, classes } = fakeCard();
  assert.equal(advanceRecipientStage(card, 'opened'), false);
  assert.equal(advanceRecipientStage(card, 'surprise'), true);
  assert(classes.has('is-surprise'));
  assert.equal(steps[1].attrs['aria-current'], 'step');
  assert.equal(steps[0].attrs['aria-current'], undefined);
  assert.equal(status.textContent, translated(vi, 'vi', 'gift.legacy.journey.surpriseStatus'));
  assert.equal(advanceRecipientStage(card, 'surprise'), false);
  assert.equal(advanceRecipientStage(card, 'opened'), true);
  assert(!classes.has('is-surprise'));
  assert(classes.has('is-open'));
  assert.equal(steps[2].attrs['aria-current'], 'step');
  assert.equal(advanceRecipientStage(card, 'surprise'), false);
  assert.equal(advanceRecipientStage(null, 'surprise'), false);
});

test('All recipient and share guide messages have equivalent Vietnamese/English keys', () => {
  for (const key of Object.keys(en).filter(key => key.startsWith('gift.legacy.journey.') || key.startsWith('gift.share.guide.'))) {
    assert(Object.hasOwn(vi, key), `Missing Vietnamese locale: ${key}`);
    assert.notEqual(translated(en, 'en', key), key);
    assert.notEqual(translated(vi, 'vi', key), key);
  }
  assert.equal(RECIPIENT_STAGES.length, 3);
});

test('No transaction, API route, Canvas document schema or stored names are changed', () => {
  const runtime = fs.readFileSync(new URL('../../web/js/features/gifts/recipient-journey.js', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /\bfetch\s*\(|\bapi\.|sessionStorage|localStorage|innerHTML|\.message\s*=/);
  assert.match(runtime, /focusVisibleTarget/);
  const css = fs.readFileSync(new URL('../../web/css/gift.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /recipient-journey__steps/);
});


test('Sender Studio quick navigation reuses role design system and points to real sections', () => {
  const studio = createGiftViews({
    state: { user: { name: 'Tester' }, favorites: new Set() },
    buttonLink: (url, label) => `<a href="${url}">${label}</a>`,
  }).dashboard();
  for (const section of ['sender-drafts', 'sender-gifts', 'sender-orders']) {
    assert.match(studio, new RegExp(`href="#${section}"`));
    assert.match(studio, new RegExp(`id="${section}" aria-labelledby="${section}-heading"`));
  }
  assert.match(studio, /role-workspace--sender/);
  assert.match(studio, /role\.workspace\.nav/);
  assert.doesNotMatch(studio, /<script>/);
});

test('Sender share screen renders a three-step guide and preserves invitation-first URL', () => {
  const html = views().successPage({
    slug: 'gift-private', status: 'active',
    access: { open: 'invite' },
    url: 'http://127.0.0.1:4100/g/gift-private',
    inviteUrl: 'http://127.0.0.1:4100/g/gift-private?invite=test-token',
  });
  assert.match(html, /class="sender-share-guide" role="group"/);
  assert.equal((html.match(/<li><span aria-hidden="true">0[1-3]<\/span>/g) || []).length, 3);
  assert.match(html, /gift\.share\.guide\.hint/);
  assert.match(html, /id="share-link" data-copy-value readonly value="http:\/\/127\.0\.0\.1:4100\/g\/gift-private\?invite=test-token"/);
  assert.match(html, /gift\.share\.inviteNotice/);
});
