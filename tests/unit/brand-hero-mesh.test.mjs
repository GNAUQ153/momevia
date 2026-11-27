import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const css = read('web/css/open-me-website.css');
const ambient = read('web/js/features/marketing/hero-templates.js');

test('Mesh trang trí dùng token màu, không chặn thao tác và không tải tài nguyên ngoài', () => {
  const layer = css.match(/\.is-home \.open-me-stack \.mkt-stage__atmosphere::before \{([^}]+)\}/)?.[1];
  assert(layer);
  assert.equal((layer.match(/radial-gradient\(/g) || []).length, 3);
  for (const name of ['peach', 'pink', 'primary-light']) assert(layer.includes(`var(--color-${name})`));
  assert.match(layer, /position: absolute;/);
  assert.match(layer, /pointer-events: none;/);
  assert.doesNotMatch(layer, /url\(|@import/);
});

test('Mesh chỉ chuyển động một lượt ngắn trên màn hình lớn có con trỏ chính xác', () => {
  assert.match(css, /@media \(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\) \{\s*\.is-home \.open-me-stack \.mkt-stage__atmosphere::before \{\s*animation: momevia-hero-mesh 4400ms ease-in-out both;\s*animation-play-state: paused;/);
  assert.equal((css.match(/animation: momevia-hero-mesh/g) || []).length, 1);
  assert.match(css, /@keyframes momevia-hero-mesh \{\s*0%, 100% \{\s*transform: none;\s*opacity: \.48;/);
});

test('Mesh dùng chung vòng đời ambient thay vì tạo bộ hẹn giờ riêng', () => {
  assert.match(css, /\.open-me-hero\[data-mkt-ambient-running\] \.open-me-stack \.mkt-stage__atmosphere::before \{\s*animation-play-state: running;/);
  assert.match(ambient, /!dataPaused && !document\.hidden && visible && !dialog\.open/);
  assert.match(ambient, /root\.toggleAttribute\('data-mkt-ambient-running', running\)/);
  assert.match(ambient, /root\.removeAttribute\('data-mkt-ambient-running'\)/);
});
