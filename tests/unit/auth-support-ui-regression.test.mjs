import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAuthViews } from "../../web/js/pages/auth.js";

const project = new URL("../../", import.meta.url);
const file = name => readFileSync(new URL(name, project), "utf8");
const makeViews = (user = null) => createAuthViews({
  state: { user, providers: { google: false, zalo: false } },
  buttonLink: (href, label) => `<a href="${href}">${label}</a>`,
});

test("Login có một CTA Đăng ký ngay, dẫn đúng /register và nằm trước social login", () => {
  const html = makeViews().authPage("login");
  assert.match(html, /auth-switch auth-switch--signup/);
  assert.match(html, /href="\/register" data-link/);
  assert.match(html, /Bạn chưa có tài khoản\?/);
  assert.match(html, /Đăng ký ngay/);
  assert.equal((html.match(/href="\/register"/g) || []).length, 1);
  assert.ok(html.indexOf("auth-switch--signup") > html.indexOf("email-login-form"));
  assert.doesNotMatch(html, /class="auth-divider"/); // Không hiện lựa chọn SSO chưa được cấu hình.
  assert.match(html, /href="\/recover" data-link/);
});

test("Register vẫn hiển thị nút Đăng nhập và giữ các trường đăng ký", () => {
  const html = makeViews().authPage("register");
  assert.match(html, /id="register-form"/);
  assert.match(html, /name="confirmPassword"/);
  assert.match(html, /href="\/login" data-link/);
  assert.doesNotMatch(html, /auth-switch--signup/);
  assert.doesNotMatch(html, /href="\/register"/);
});

test("CSS không còn ẩn liên kết .auth-switch và có vùng bấm/focus rõ", () => {
  const css = file("web/css/auth-pages.css");
  assert.doesNotMatch(css, /\.auth-switch a\s*,\s*\.is-auth \.site-tools\s*\{\s*display:\s*none/);
  assert.match(css, /\.auth-page \.auth-switch\.auth-switch--signup\s*\{[^}]*border: 1px solid/);
  assert.match(css, /\.auth-switch a,\s*\.auth-recovery-link a\s*\{/);
  assert.match(css, /\.auth-switch a:focus-visible/);
});

test("Support form và màn thành công không chèn bộ chuyển ngôn ngữ riêng", () => {
  const main = file("web/js/app/main.js");
  assert.match(main, /function openModal\(content, \{ showLocaleControl = true \} = \{\}\)/);
  assert.match(main, /\$\{showLocaleControl \? localeControl\(\) : ""\}\$\{content\}/);
  const form = main.slice(main.indexOf("function openSupport(report)"), main.indexOf("function setAccountMenu("));
  assert.match(form, /<form id="support-form"/);
  assert.match(form, /showLocaleControl: false/);
  const success = main.slice(main.indexOf('form.id === "support-form"'), main.indexOf('form.id === "reply-form"'));
  assert.match(success, /support-success/);
  assert.match(success, /showLocaleControl: false/);
  assert.equal((main.match(/showLocaleControl: false/g) || []).length, 2);
});

test("Ngôn ngữ VI/EN vẫn lấy từ dictionary chung và không tạo khóa mới", () => {
  const vi = JSON.parse(file("web/assets/locales/vi.json"));
  const en = JSON.parse(file("web/assets/locales/en.json"));
  assert.deepEqual(Object.keys(vi), Object.keys(en));
  for (const key of ["auth.register.switch", "auth.login.noAccount", "support.title", "support.success.title"]) {
    assert.ok(vi[key]?.trim());
    assert.ok(en[key]?.trim());
    assert.notEqual(vi[key], en[key]);
  }
});
