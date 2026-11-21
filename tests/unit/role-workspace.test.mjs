import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAdminViews } from '../../web/js/pages/admin.js';
import { createCreatorViews } from '../../web/js/pages/creator.js';
import { roleQuickLinks, roleMetric } from '../../web/js/ui/role-workspace.js';
import { translate, vi } from '../../web/js/shared/locale.js';
import en from '../../web/assets/locales/en.json' with { type: 'json' };

const roleKeys = Object.keys(en).filter(key => key.startsWith('role.'));

const creatorState = { user: { id: 'creator-1', name: 'QA', role: 'creator' } };

test('Admin workspace has semantic navigation, section anchors and accurate loaded-only counts', () => {
  const html = createAdminViews().adminPage([], [], { id: 'admin-1' }, []);
  assert.match(html, /id="admin-moderation"/);
  assert.match(html, /id="admin-support"/);
  assert.match(html, /href="\/admin\/payments" data-link/);
  assert.match(html, /href="#admin-moderation"/);
  assert.match(html, /role-workspace__metrics/);
  assert.match(html, /role\.workspace\.loadedDisclaimer/);
  assert.match(html, /aria-labelledby="admin-support-heading"/);
});

test('Unavailable queues are not reported as zero loaded records', () => {
  const html = createAdminViews().adminPage(null, null, { id: 'admin-1' }, null);
  assert.match(html, /role\.workspace\.notLoaded/);
  assert.match(html, /retry-admin-queues/);
});

test('Creator quick navigation points at sections available to its role', () => {
  const html = createCreatorViews({ state: creatorState }).creatorPage([], [], null);
  assert.match(html, /href="#creator-form"/);
  assert.match(html, /href="#creator-list"/);
  assert.match(html, /href="#creator-finance"/);
  assert.match(html, /id="creator-finance"/);
  assert.match(html, /role\.creator\.templateLoaded/);
});

test('Sender cannot see Creator dashboard shortcuts or authoring form', () => {
  const html = createCreatorViews({ state: { user: { id: 'sender', role: 'sender' } } }).creatorPage([], [], null);
  assert.doesNotMatch(html, /href="#creator-finance"/);
  assert.doesNotMatch(html, /id="creator-template-form"/);
});

test('Quick navigation rejects external URL or attribute injection', () => {
  assert.throws(() => roleQuickLinks([{ href: 'javascript:alert(1)', labelKey: 'role.creator.createLink', iconName: 'pencil' }]), TypeError);
  assert.throws(() => roleQuickLinks([{ href: '#item" onclick="bad()', labelKey: 'role.creator.createLink', iconName: 'pencil' }]), TypeError);
});

test('Role metric rejects invalid counts and never displays them as real totals', () => {
  assert.match(roleMetric('role.admin.reviewLoaded', null), /role\.workspace\.notLoaded/);
  assert.match(roleMetric('role.admin.reviewLoaded', Number.POSITIVE_INFINITY), /role\.workspace\.notLoaded/);
  assert.match(roleMetric('role.admin.reviewLoaded', -1), /role\.workspace\.notLoaded/);
  assert.match(roleMetric('role.admin.reviewLoaded', 12), /<strong>12<\/strong>/);
});

test('Role-workspace dictionary has English labels and preserves matching keys', () => {
  assert.equal(roleKeys.length, 17);
  for (const key of roleKeys) {
    assert.equal(typeof vi[key], 'string', key);
    assert.equal(typeof en[key], 'string', key);
    assert.equal(translate(en, 'en', key), en[key], key);
    assert(!/[À-ỹđĐ]/u.test(en[key]), key);
  }
});

test('Dashboard stylesheet includes focus, mobile layout and reduced-motion support', () => {
  const css = fs.readFileSync(new URL('../../web/css/role-workspace.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
  assert.match(html, /href="\/css\/role-workspace\.css"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: var\(--ui-control-min-height/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 640px/);
});
