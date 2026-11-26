import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthViews } from '../../web/js/pages/auth.js';
import { auditCssStyle } from '../../scripts/quality/check-css-style.mjs';

const src = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const auth = (mode, providers = {}) => createAuthViews({
  state: { user: null, providers: { google: false, zalo: false, ...providers } },
  buttonLink: (url, value) => `<a href="${url}">${value}</a>`,
}).authPage(mode);

test('Hai trang Auth dùng cùng layout hai cột marketing và card xác thực', () => {
  for (const mode of ['login', 'register']) {
    const page = auth(mode);
    assert.match(page, new RegExp(`auth-page auth-page--${mode}`));
    assert.match(page, /class="container auth-layout"/);
    assert.match(page, /class="auth-showcase__story"/);
    assert.match(page, /class="auth-panel"/);
    assert.match(page, /class="auth-showcase__explore" href="\/explore" data-link/);
    assert.equal((page.match(/<h1\b/g) || []).length, 1);
  }
});

test('Login giữ OAuth sau form, Register bỏ khối social để tập trung biểu mẫu', () => {
  const login = auth('login', { google: true, zalo: true });
  assert.ok(login.indexOf('class="auth-form"') < login.indexOf('class="auth-buttons"'));
  assert.ok(login.indexOf('class="auth-buttons"') < login.indexOf('class="auth-switch'));
  assert.match(login, /href="\/api\/auth\/google" data-auth-provider="google"/);
  assert.match(login, /href="\/api\/auth\/zalo" data-auth-provider="zalo"/);
  assert.match(login, /class="auth-divider auth-divider--social"/);

  const register = auth('register', { google: true, zalo: true });
  assert.doesNotMatch(register, /class="auth-buttons"/);
  assert.doesNotMatch(register, /data-auth-provider="google"/);
  assert.doesNotMatch(register, /data-auth-provider="zalo"/);
});

test('OAuth chưa cấu hình chỉ hiển thị ở Login và không dẫn tới endpoint lỗi', () => {
  const page = auth('login');
  assert.equal((page.match(/auth-social--disabled/g) || []).length, 2);
  assert.doesNotMatch(page, /href="\/api\/auth\//);
  assert.match(page, /auth-provider-note/);
  assert.match(page, /role="status"/);
  assert.match(page, /auth.providers.orSocialLogin|Hoặc tiếp tục với|Or continue with/);
  assert.doesNotMatch(auth('register'), /auth-provider-note|auth-social--disabled/);
});

test('Login giữ email, password, recovery và CTA đăng ký', () => {
  const page = auth('login');
  for (const part of ['id="email-login-form"', 'autocomplete="email"', 'autocomplete="current-password"', 'href="/recover"', 'href="/register"', 'data-action="toggle-password"']) assert.ok(page.includes(part), part);
});

test('Register giữ tên, email, mật khẩu tối thiểu 8 ký tự, xác nhận và link login', () => {
  const page = auth('register');
  for (const part of ['id="register-form"', 'autocomplete="name"', 'autocomplete="email"', 'name="confirmPassword"', 'href="/login"', 'minlength="8"']) assert.ok(page.includes(part), part);
});

test('Nền tối gradient, glass card và grid có thể kiểm toán CSS', () => {
  const css = src('web/css/auth-pages.css');
  assert.match(css, /\.auth-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 0\.94fr\) minmax\(0, 1\.06fr\)/s);
  assert.match(css, /\.auth-panel\s*\{[^}]*backdrop-filter:\s*blur\(20px\)/s);
  assert.match(css, /\.auth-showcase__story\s*\{[^}]*border-radius:\s*27px/s);
  assert.match(css, /\.auth-page::before\s*\{[^}]*background-image/s);
  assert.deepEqual(auditCssStyle(css, 'auth-pages.css').errors, []);
});

test('Header auth tối giản nhưng giữ locale chung, không thêm locale trong form', () => {
  const script = src('web/js/app/main.js');
  const css = src('web/css/auth-pages.css');
  assert.match(script, /classList\.toggle\("is-auth-entry",\s*\/\^\\\/\(login\|register\)/);
  assert.match(css, /body\.is-auth-entry \.site-header \.nav-links/);
  assert.match(css, /body\.is-auth-entry \.site-header \.nav-actions > \.locale-control/);
  assert.match(css, /body\.is-auth-entry #site-footer/);
  assert.doesNotMatch(src('web/js/pages/auth.js'), /localeControl\(/);
});

test('Có breakpoint tablet/mobile và reduced motion, input 16px và nút mạng xã hội đủ cao', () => {
  const css = src('web/css/auth-pages.css');
  for (const size of ['990px', '600px', '460px', '360px']) assert.ok(css.includes(`@media (max-width: ${size})`));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.auth-panel \.auth-input input\s*\{[^}]*font-size: 16px/s);
  assert.match(css, /\.auth-panel \.auth-submit\s*\{[^}]*min-height: 54px/s);
  assert.match(css, /\.auth-panel \.auth-social\s*\{[^}]*min-height: 52px/s);
});

test('Giữ bảng dịch VI/EN tương ứng cho heading, CTA và lựa chọn OAuth', () => {
  const vi = JSON.parse(src('web/assets/locales/vi.json'));
  const en = JSON.parse(src('web/assets/locales/en.json'));
  assert.deepEqual(Object.keys(vi), Object.keys(en));
  for (const key of ['shell.nav.explore', 'auth.providers.orSocialLogin', 'auth.login.title', 'auth.register.title']) {
    assert.ok(vi[key] && en[key], key);
    assert.notEqual(vi[key], en[key]);
  }
});

test('Auth CSS có version để tránh cache cũ sau khi deploy', () => {
  const html = src('web/index.html');
  assert.match(html, /href="\/css\/auth-pages\.css\?v=20261126-dark-v11"/);
});
