import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthViews } from '../../web/js/pages/auth.js';

const css = readFileSync(new URL('../../web/css/auth-pages.css', import.meta.url), 'utf8');
const rule = selector => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)));
const views = createAuthViews({ state: { user: null, providers: { google: true, zalo: true } }, buttonLink: (href, label) => `<a href="${href}">${label}</a>` });

test('Login/Register dùng chung bố cục, tiêu đề, trường nhập và khối OAuth', () => {
  assert.match(rule('.auth-showcase'), /justify-content: flex-start/);
  assert.match(rule('.auth-panel'), /justify-content: flex-start/);
  assert.match(rule('.auth-page .auth-switch'), /border: 1px solid/);
  assert.doesNotMatch(css, /\.auth-page--(?:login|register)\s+\.(?:auth-panel|auth-lead|auth-field-icon|auth-required|auth-switch)\b/);
  assert.match(rule('.auth-panel .auth-input input'), /min-height: 52px/);
  assert.match(rule('.auth-panel .auth-social'), /min-height: 52px/);
  assert.match(rule('.auth-consent'), /min-height: 44px/);
});

test('Cả hai trang dùng nhãn OAuth tương ứng hành động, không mở quyền khi chưa đồng ý', () => {
  const login = views.authPage('login');
  const register = views.authPage('register');
  for (const [html, action] of [[login, 'signInWith'], [register, 'registerWith']]) {
    for (const id of ['google', 'zalo']) {
      const button = html.match(new RegExp(`<(?:(?:a)|(?:button))[^>]+data-auth-provider="${id}"[^>]*>[\\s\\S]*?</(?:a|button)>`))?.[0];
      assert.ok(button);
      assert.match(button, new RegExp(`auth\\.providers\\.${action}`));
    }
  }
  assert.equal((register.match(/required data-auth-consent/g) || []).length, 2);
  assert.doesNotMatch(login, /data-auth-consent/);
  assert.equal((register.match(/data-auth-provider-url="\/api\/auth\/(?:google|zalo)" disabled/g) || []).length, 2);
  assert.match(register, /class="btn btn--dark btn--wide auth-submit" type="submit">/);
  assert.match(login, /href="\/api\/auth\/google"/);
});
