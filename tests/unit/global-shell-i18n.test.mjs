import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLatestRequest } from '../../web/js/features/refund/latest-request.js';
import { refundAdminPanel } from '../../web/js/pages/refund-review.js';
import { checkAppShellCopy } from '../../scripts/quality/check-ui-i18n.mjs';
import { translate, vi } from '../../web/js/shared/locale.js';
import en from '../../web/assets/locales/en.json' with { type: 'json' };

const source = fs.readFileSync(new URL('../../web/js/app/main.js', import.meta.url), 'utf8');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('Only the latest refund-queue request may update the UI', async () => {
  const loader = createLatestRequest();
  const slow = deferred();
  const fast = deferred();
  const applied = [];
  const first = loader.run(() => slow.promise, { onSuccess: data => applied.push(data) });
  const second = loader.run(() => fast.promise, { onSuccess: data => applied.push(data) });
  fast.resolve('new-filter');
  assert.equal(await second, true);
  slow.resolve('old-filter');
  assert.equal(await first, false);
  assert.deepEqual(applied, ['new-filter']);
});

test('Failed requests return a false outcome without clearing an existing queue', async () => {
  const loader = createLatestRequest();
  let visible = 'saved-page';
  const errors = [];
  const finalized = [];
  const success = await loader.run(async () => { throw new Error('network offline'); }, {
    onSuccess: value => { visible = value; },
    onError: error => errors.push(error.message),
    onFinally: () => finalized.push('done'),
  });
  assert.equal(success, false);
  assert.equal(visible, 'saved-page');
  assert.deepEqual(errors, ['network offline']);
  assert.deepEqual(finalized, ['done']);
});

test('Stale failures and invalidated requests never report errors or overwrite the route', async () => {
  const loader = createLatestRequest();
  const pending = deferred();
  const notifications = [];
  const request = loader.run(() => pending.promise, {
    onError: () => notifications.push('failed'),
    onFinally: () => notifications.push('finished'),
  });
  loader.invalidate();
  pending.reject(new Error('old request'));
  assert.equal(await request, false);
  assert.deepEqual(notifications, []);
});

test('Admin Refund panel exposes a localized, accessible load status', () => {
  const html = refundAdminPanel([], { filter: 'active' });
  assert.match(html, /data-refund-queue-feedback/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /id="admin-refund-filter"/); // placeholder below uses the actual select ID
});

test('Payment reconciliation notice and photo preview are bound to the active locale', () => {
  const payment = fs.readFileSync(new URL('../../web/js/app/payment-actions.js', import.meta.url), 'utf8');
  assert.deepEqual(checkAppShellCopy(payment), []);
  assert.match(payment, /toast\(message\('payment\.status\.manualReview'\)\)/);
  assert.match(source, /setAttr\(img, 'alt', message\('gift\.builder\.photoPreview'\)\)/);
  assert.deepEqual(checkAppShellCopy(source), []);
  for (const key of ['payment.status.manualReview', 'gift.builder.photoPreview', 'refund.queue.loading', 'refund.queue.loadFailed']) {
    assert.equal(typeof en[key], 'string');
    assert.equal(typeof vi[key], 'string');
    assert.notEqual(en[key], vi[key]);
    assert.equal(translate(en, 'en', key), en[key]);
    assert(!/[À-ỹđĐ]/u.test(en[key]), key);
  }
});

test('App Shell audit rejects newly introduced hardcoded Vietnamese UI strings', () => {
  assert.deepEqual(checkAppShellCopy('const filter = "Lễ hội";'), []);
  assert.deepEqual(checkAppShellCopy('const button = "Hoàn tiền ngay";').map(item => item.value), ['Hoàn tiền ngay']);
});
