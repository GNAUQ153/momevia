import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = relative => readFileSync(fileURLToPath(new URL(relative, root)), 'utf8');

test('One foreground cover has a fixed artboard and a bounded teaser stage', () => {
  const css = read('web/css/open-me-website.css');
  const block = css.match(/\.is-home \.open-me-stack\s*\{([^}]+)\}/);
  assert.ok(block, 'Artwork có vùng bố cục riêng');
  assert.match(block[1], /min-height:\s*0/);
  assert.match(read('web/js/features/marketing/hero-templates.js'), /width="390" height="844"/);
});

test('Browser regression measures the featured cover and all five layers without hiding page overflow', () => {
  const browserTest = read('tests/browser/home.mjs');
  assert.match(browserTest, /coverBox\.x >= frame\.x && coverBox\.x \+ coverBox\.width <= frame\.x \+ frame\.width/);
  assert.match(browserTest, /Exactly one featured sample/);
  assert.match(browserTest, /boundingBox\(\)/);
  assert.match(browserTest, /documentElement\.scrollWidth\), width/);
  assert.doesNotMatch(read('web/css/open-me-website.css'), /(?:html|body)\s*\{[^}]*overflow[^:]*:\s*(?:hidden|clip)/);
});
