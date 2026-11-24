import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { translate, vi } from '../../web/js/shared/locale.js';
import { BASIC_TEMPLATES } from '../../web/js/shared/canvas/basic-templates.js';
import { legalPages } from '../../web/js/pages/policies.js';
import { reviewStates } from '../../web/js/pages/admin-payments.js';
import { CARD_TYPES } from '../../web/js/shared/card-type.js';
import { supportTopics } from '../../web/js/features/support/topics.js';

const placeholders = value => [...new Set(Array.from(value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g), match => match[1]))].sort();
const root = fileURLToPath(new URL('../../', import.meta.url));

export function checkLocales() {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(vi).sort(), 'Vietnamese and English must use the same translation keys');
  for (const key of Object.keys(vi)) {
    const entry = value => typeof value === 'string' ? { other: value } : value;
    const local = entry(vi[key]), english = entry(en[key]);
    assert.equal(typeof vi[key], typeof en[key], key);
    assert.equal(typeof local?.other, 'string', `${key} VI must include a default message`);
    assert.equal(typeof english?.other, 'string', `${key} EN must include a default message`);
    for (const [locale, variants] of [['vi', local], ['en', english]]) {
      for (const [category, value] of Object.entries(variants)) {
        assert(typeof value === 'string' && value.trim(), `${key} ${locale} ${category} is empty`);
        assert.deepEqual(placeholders(value), placeholders(local.other), `${key} has mismatched parameters`);
      }
    }
  }
  const verify = (key, source) => assert(Object.hasOwn(vi, key), `Missing translation ${key} in ${source}`);
  for (const status of ['clean', 'dirty', 'saving', 'offline', 'conflict', 'session-expired', 'error', 'asset-pending', 'publishing'])
    verify(`editor.status.${status}`, 'save session');
  for (const status of ['active', 'expired', 'revoked']) verify(`studio.gifts.${status}`, 'gift card');
  for (const provider of ['momo', 'payos']) verify(`payment.methods.${provider}`, 'checkout');
  for (const status of reviewStates) verify(`admin.payments.state.${status}`, 'payment review');
  for (const status of ['pending', 'approved', 'changes_requested']) verify(`creator.status.${status}`, 'Creator review');
  for (const topic of [...supportTopics, 'report']) verify(`support.topic.${topic}`, 'support form');
  for (const type of CARD_TYPES) verify(`catalog.cardType.${type}`, 'card type');
  for (const binding of ['recipientName', 'senderName', 'message']) verify(`catalog.personalization.${binding}`, 'personalization');
  for (const [id, definition] of Object.entries(BASIC_TEMPLATES))
    for (const field of ['name', 'title', 'subtitle', 'headline', ...(definition.note ? ['note'] : [])])
      verify(`templates.${id}.${field}`, 'built-in template');
  for (const [id, policy] of Object.entries(legalPages)) {
    for (const field of ['title', 'description']) verify(`policies.${id}.${field}`, 'policy page');
    for (const index of policy.sections.keys())
      for (const field of ['title', 'text']) verify(`policies.${id}.sections.${index + 1}.${field}`, 'policy section');
  }
  assert.deepEqual([0, 1, 2].map(count => translate(en, 'en', 'catalog.results.count', { count })),
    ['0 matching templates', '1 matching template', '2 matching templates']);
  assert.deepEqual([0, 1, 2].map(count => translate(vi, 'vi', 'catalog.results.count', { count })),
    ['0 mẫu phù hợp', '1 mẫu phù hợp', '2 mẫu phù hợp']);
  function checkReferences(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory() && !['data', 'vendor'].includes(entry.name)) checkReferences(filename);
      if (!entry.isFile() || !/\.[m]?js$/.test(entry.name)) continue;
      const source = fs.readFileSync(filename, 'utf8');
      const call = /\b(?:canonicalText|label|message|t|text)\(\s*["']([a-z][\w-]*(?:\.[\w-]+)+)["']|\b(?:localizedError|serverText|attr)\([^,]+,\s*["']([a-z][\w-]*(?:\.[\w-]+)+)["']/g;
      for (const [, direct, withArgument] of source.matchAll(call)) verify(direct || withArgument, path.relative(root, filename));
    }
  }
  checkReferences(path.join(root, 'web/js'));
  checkReferences(path.join(root, 'src'));
  const shell = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
  for (const [, key] of shell.matchAll(/\bdata-i18n(?:-[a-z-]+)?="([^"]+)"/g)) verify(key, 'web/index.html');
  const localizedViews = [
    'pages/admin-payments.js', 'pages/admin.js', 'pages/auth.js', 'pages/catalog.js',
    'pages/creator.js', 'pages/home.js', 'pages/payment-status.js', 'pages/policies.js',
    'pages/pricing.js', 'pages/refund-review.js', 'pages/system.js', 'ui/layout.js', 'ui/recipient-viral.js',
  ];
  const brands = new Set(['momevia', 'Momevia', 'MoMo', 'payOS / VietQR']);
  const literal = /<(?:h[1-6]|p|button|a|label|span|summary|strong|small|option)\b[^>]*>\s*([^<${>]+?)\s*<\/|\b(?:aria-label|title|placeholder|alt)="([^"${}]+)"/g;
  for (const view of localizedViews) {
    const source = fs.readFileSync(path.join(root, 'web/js', view), 'utf8');
    for (const [, content, attribute] of source.matchAll(literal)) {
      const copy = (content ?? attribute).trim();
      assert(!/\p{L}/u.test(copy) || brands.has(copy), `Direct interface copy in ${view}: ${copy}`);
    }
  }
  console.log(`PASS ${Object.keys(vi).length} VI/EN keys, parameter parity, tracked dynamic keys and plural counts 0/1/2.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkLocales();
