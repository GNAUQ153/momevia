import test from 'node:test';
import assert from 'node:assert/strict';
import { authDestination, rememberAuthReturn, takeAuthReturn } from '../../web/js/core/auth-return.js';
import { createCreatorViews } from '../../web/js/pages/creator.js';

test('Creator sign-in retains a safe return destination', () => {
  const previous = globalThis.location;
  globalThis.location = new URL('https://momevia.example/creator');
  try {
    rememberAuthReturn('/creator');
    assert.deepEqual(takeAuthReturn(), { path: '/creator', favoriteId: null });
    for (const path of ['//other.example/creator', '/creator?next=https://other.example', '/creator/admin', '/creator#unexpected'])
      assert.equal(authDestination(path), null);
  } finally { globalThis.location = previous; }
});

test('Creator summaries use the latest revision and exclude withdrawn templates', () => {
  const template = (id, versions = [], withdrawn = false) => ({ id, title: id, subtitle: '', creatorDesignId: id, versions, withdrawn });
  const html = createCreatorViews({ state: { user: { role: 'creator' } } }).creatorPage([
    template('draft'),
    template('pending', [{ revision: 2, status: 'pending' }, { revision: 1, status: 'approved' }]),
    template('approved', [{ revision: 1, status: 'approved' }]),
    template('removed', [{ revision: 1, status: 'approved' }], true),
    template('revision', [{ revision: 3, status: 'changes_requested', reason: 'Update cover' }]),
  ]);
  const summary = html.match(/class="creator-list__summary">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual([...summary.matchAll(/<strong>(\d+)<\/strong>/g)].map(match => Number(match[1])), [1, 1, 1]);
  assert.match(html, /creator-template__status--withdrawn/);
  assert.match(html, /creator-template__status--changes_requested/);
  assert.match(html, /data-creator-review-notice/);
});
