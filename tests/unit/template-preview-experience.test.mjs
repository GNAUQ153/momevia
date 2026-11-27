import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { templatePreviewDialog } from '../../web/js/features/catalog/template-preview.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = read('web/js/features/catalog/template-preview.js');
const css = read('web/css/template-preview.css');

test('Preview có trạng thái ban đầu và giữ cảnh báo nội dung mô phỏng', () => {
  const markup = templatePreviewDialog({ id: 'demo', title: '<script>', versionId: 'v2' });
  assert.match(markup, /data-preview-state="idle"/);
  assert.match(markup, /class="template-preview-note">/);
  assert.match(markup, /&lt;script&gt;/);
  assert.doesNotMatch(markup, /<script>/);
  assert.doesNotMatch(source, /note\.hidden\s*=/);
  assert.match(markup, /version=v2/);
});

test('Preview đồng bộ loading, error, replay và aria-busy qua cùng trạng thái', () => {
  for (const state of ['idle', 'loading', 'ready', 'error']) {
    assert(source.includes(`setPreviewState('${state}')`));
  }
  assert.match(source, /loading\.hidden = state !== 'loading'/);
  assert.match(source, /errorPanel\.hidden = state !== 'error'/);
  assert.match(source, /reset\.hidden = state !== 'ready'/);
  assert.match(source, /playerHost\.removeAttribute\('aria-busy'\)/);
  assert.match(source, /attempt\?\.abort\(\);\s*attempt = null;/);
  assert.match(source, /dialog\.scrollTop = 0;\s*close\.focus\(\{ preventScroll: true \}\)/);
});

test('CSS preview dùng token và không bật animation riêng cho runtime', () => {
  assert.match(css, /var\(--color-gradient-action\)/);
  assert.match(css, /@media \(max-height: 500px\)[\s\S]*position: static;/);
  assert.doesNotMatch(css, /@keyframes|animation:|:lang\(/);
  assert.match(css, /\[data-template-reset\]\[hidden\][^}]*display: none/);
});

test('CSS preview được đưa vào HTML nguồn và gói Catalog', () => {
  assert.match(read('web/index.html'), /template-preview\.css\?v=20261127-preview/);
  assert.match(read('scripts/build/client-bundles.mjs'), /catalogSheets[^\n]*'template-preview'/);
});
