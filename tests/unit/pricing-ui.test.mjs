import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pricingPage } from '../../web/js/pages/pricing.js';
import { createLayout } from '../../web/js/ui/layout.js';

const css = readFileSync(new URL('../../web/css/ui-polish.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../web/js/app/main.js', import.meta.url), 'utf8');

test('Auth footnotes 12px, gift image smaller, and new CSS is last', () => {
  assert.match(css, /\.auth-page \.auth-switch,[\s\S]*?font-size: 12px/);
  assert.match(css, /\.auth-showcase__art > img \{ width: min\(260px, 69%\)/);
  assert.match(index, /<link rel="stylesheet" href="\/css\/ui-polish\.css"/);
  assert(index.lastIndexOf('ui-polish.css') > index.lastIndexOf('responsive.css'));
});

test('Pricing preview makes no active subscription or auto-renew promise', () => {
  const html = pricingPage();
  assert.match(html, /Mẫu miễn phí/);
  assert.match(html, /Mua theo mẫu/);
  assert.match(html, /Creator Pro/);
  assert.match(html, /Chưa mở bán|Chưa công bố/);
  assert.match(html, /không tự động tính phí/);
  assert.match(html, /biên nhận/i);
  assert.match(app, /route === 'pricing'/);
  assert(!html.includes('data-action="subscribe"'));
});


test('Pricing is reachable from desktop header and mobile menu with active state', () => {
  const originalLocation = globalThis.location;
  globalThis.location = { pathname: '/pricing', hash: '' };
  const header = { innerHTML: '' };
  const footer = { innerHTML: '' };
  try {
    const { refreshNav } = createLayout({ state: { user: null }, header, footer });
    refreshNav();
    const nav = header.innerHTML.match(/<nav class="nav-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
    const mobile = header.innerHTML.split('id="mobile-nav"')[1] || '';
    const visibleText = html => html.replace(/<!--[^]*?-->/g, '');
    assert.match(visibleText(nav), /href="\/pricing"[^>]*class="is-active"[^>]*aria-current="page"[^>]*>Bảng giá<\/a>/);
    assert.match(visibleText(mobile), /href="\/pricing"[^>]*>Bảng giá<\/a>/);
    assert.equal((nav.match(/href="\/pricing"/g) || []).length, 1);
    assert.equal((mobile.match(/href="\/pricing"/g) || []).length, 1);
  } finally {
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});

test('Compact menu remains available on narrow laptops', () => {
  assert.match(css, /@media \(min-width: 901px\) and \(max-width: 1020px\)/);
});
