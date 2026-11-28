import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthViews } from '../../web/js/pages/auth.js';

const read = location => readFileSync(new URL(`../../${location}`, import.meta.url), 'utf8');
const view = (route, providers) => createAuthViews({
  state: { user: null, providers }, buttonLink: (href, label) => `<a href="${href}">${label}</a>`,
}).authPage(route);

test('Logo Zalo là asset thật trên site, không phải chữ Z đơn giản', () => {
  const svg = read('web/assets/brand/zalo.svg');
  assert.match(svg, /viewBox="0 0 50 50"/);
  assert.match(svg, /#0068FF/);
  assert.match(svg, /<path /);
  assert.equal((svg.match(/<path /g) || []).length, 5);
  assert.doesNotMatch(svg, /<script|onload=|foreignObject|(?:href|src)=\"https?:/i);
});

test('Login dùng logo Zalo nội bộ cho cả hai trạng thái OAuth', () => {
  for (const enabled of [true, false]) {
    const login = view('login', { zalo: enabled, google: true });
    assert.match(login, /src="\/assets\/brand\/zalo\.svg"/);
    assert.match(login, /data-auth-provider="zalo"/);
    if (enabled) assert.match(login, /href="\/api\/auth\/zalo"/);
    else assert.doesNotMatch(login, /href="\/api\/auth\/zalo"/);
  }
});

test('Register dùng logo Zalo nội bộ và chờ xác nhận trước khi cho phép chuyển trang', () => {
  const register = view('register', { google: true, zalo: true });
  assert.match(register, /data-auth-provider="zalo" data-auth-provider-url="\/api\/auth\/zalo" disabled/);
  assert.match(register, /src="\/assets\/brand\/zalo\.svg"/);
});

test('Kích thước logo tối thiểu vừa ô xã hội, không đè lên nội dung', () => {
  const css = read('web/css/auth-pages.css');
  assert.match(css, /\.auth-provider-logo img\s*\{[^}]*object-fit: contain;/s);
  assert.match(css, /\.auth-provider-logo--zalo\s*\{[^}]*width: 28px;[^}]*height: 28px;/s);
});
