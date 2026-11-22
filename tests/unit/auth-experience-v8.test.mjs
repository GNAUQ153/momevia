import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthViews } from '../../web/js/pages/auth.js';
import { auditCssStyle } from '../../scripts/quality/check-css-style.mjs';

const file = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const views = providers => createAuthViews({
  state: { user: null, providers },
  buttonLink: (url, label) => `<a href="${url}">${label}</a>`,
});
const auth = (route, providers) => views(providers).authPage(route);

test('Login luôn có hai lựa chọn Google/Zalo; Register không hiển thị social login', () => {
  const login = auth('login', { google: false, zalo: false });
  assert.equal((login.match(/data-auth-provider="google"/g) || []).length, 1);
  assert.equal((login.match(/data-auth-provider="zalo"/g) || []).length, 1);
  assert.equal((login.match(/class="auth-social auth-social--disabled"/g) || []).length, 2);
  assert.match(login, /role="status"/);
  assert.match(login, /class="auth-divider auth-divider--social"/);

  const register = auth('register', { google: true, zalo: true });
  assert.doesNotMatch(register, /data-auth-provider="google"|data-auth-provider="zalo"/);
  assert.doesNotMatch(register, /class="auth-divider auth-divider--social"/);
});

test('OAuth chưa kích hoạt ở Login không có href hay sự kiện đăng nhập giả', () => {
  const html = auth('login', { google: false, zalo: false });
  assert.doesNotMatch(html, /href="\/api\/auth\/(google|zalo)"/);
  assert.match(html, /type="button" class="auth-social auth-social--disabled"/);
  assert.equal((html.match(/ disabled aria-label=/g) || []).length, 2);
});

test('Google/Zalo đã cấu hình dùng đúng OAuth server endpoint, không qua SPA', () => {
  const html = auth('login', { google: true, zalo: true });
  assert.match(html, /href="\/api\/auth\/google" data-auth-provider="google"/);
  assert.match(html, /href="\/api\/auth\/zalo" data-auth-provider="zalo"/);
  assert.equal((html.match(/class="auth-social" href=/g) || []).length, 2);
  assert.doesNotMatch(html, /auth-provider-note/);
});

test('Chỉ bật một phương thức thì chỉ có một liên kết thật', () => {
  const html = auth('login', { google: false, zalo: true });
  assert.match(html, /href="\/api\/auth\/zalo"/);
  assert.doesNotMatch(html, /href="\/api\/auth\/google"/);
  assert.match(html, /data-auth-provider="google" disabled/);
  assert.match(html, /auth-provider-note/);
});

test('Khi chưa tải được trạng thái provider, Login không điều hướng sai', () => {
  const html = auth('login', undefined);
  assert.equal((html.match(/auth-social--disabled/g) || []).length, 2);
  assert.doesNotMatch(html, /href="\/api\/auth\//);
});

test('Luồng Login/Register giữ form, quên mật khẩu, tối thiểu 8 ký tự và chuyển route', () => {
  const login = auth('login', { google: true, zalo: true });
  const register = auth('register', { google: true, zalo: true });
  assert.match(login, /id="email-login-form"/);
  assert.match(register, /id="register-form"/);
  assert.match(login, /name="password" type="password" autocomplete="current-password"/);
  assert.match(register, /name="confirmPassword" type="password" autocomplete="new-password"/);
  assert.match(register, /minlength="8"/);
  assert.match(login, /href="\/recover" data-link/);
  assert.match(login, /href="\/register" data-link/);
  assert.match(register, /href="\/login" data-link/);
  assert.equal((login.match(/<h1\b/g) || []).length, 1);
  assert.equal((register.match(/<h1\b/g) || []).length, 1);
  assert.ok(login.indexOf('class="auth-buttons"') > login.indexOf('id="email-login-form"'));
});

test('CSS Auth tập trung vào form một cột, input 16px và điều khiển đủ rộng', () => {
  const css = file('web/css/auth-pages.css');
  assert.match(css, /\.auth-panel \.auth-form\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.doesNotMatch(css, /auth-page--register \.auth-form\s*\{[^}]*repeat\(2/);
  assert.match(css, /\.auth-panel \.auth-input input\s*\{[^}]*font-size: 16px;/);
  assert.match(css, /\.auth-panel \.auth-submit\s*\{[^}]*min-height: 54px;/);
  assert.match(css, /\.auth-panel \.auth-social\s*\{[^}]*min-height: 52px;/);
  assert.match(css, /@media \(max-width: 990px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(max-width: 460px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.deepEqual(auditCssStyle(css, 'auth-pages.css').errors, []);
  assert.doesNotMatch(file('web/css/gift.css'), /\.auth-page\b/);
});

test('Logo Google inline SVG và Zalo dùng asset vector cục bộ, không gọi CDN', () => {
  const source = file('web/js/pages/auth.js');
  assert.doesNotMatch(source, /upload\.wikimedia\.org|gstatic\.com\/firebasejs/);
  assert.match(source, /auth-provider-logo--google/);
  assert.match(source, /auth-provider-logo--zalo/);
  assert.match(source, /src=\"\/assets\/brand\/zalo\.svg\"/);
  assert.doesNotMatch(source, /onclick=/);
});

test('VI/EN đồng nhất khóa, mô tả rõ phương thức chưa cấu hình', () => {
  const vi = JSON.parse(file('web/assets/locales/vi.json'));
  const en = JSON.parse(file('web/assets/locales/en.json'));
  assert.deepEqual(Object.keys(vi), Object.keys(en));
  for (const key of ['auth.providers.title', 'auth.providers.unavailableHint', 'auth.providers.signInWith', 'auth.providers.orSocialLogin']) {
    assert.ok(vi[key]?.trim());
    assert.ok(en[key]?.trim());
    assert.notEqual(vi[key], en[key]);
  }
});

test('Backend provider flags dựa vào App ID/Secret, không trả secret cho frontend', () => {
  const routes = file('src/modules/identity/routes.mjs');
  const area = routes.slice(routes.indexOf("router.on('GET', '/providers'"), routes.indexOf("router.on('GET', '/me'"));
  assert.match(area, /google: Boolean\(config\.googleId && config\.googleSecret\)/);
  assert.match(area, /zalo: Boolean\(config\.zaloId && config\.zaloSecret\)/);
  assert.doesNotMatch(area, /clientSecret:|zaloSecret:/);
});
