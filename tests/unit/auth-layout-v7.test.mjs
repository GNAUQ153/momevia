import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAuthViews } from "../../web/js/pages/auth.js";
import { auditCssStyle } from "../../scripts/quality/check-css-style.mjs";

const source = name => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
const views = (providers = {}) => createAuthViews({
  state: { user: null, providers: { google: false, zalo: false, ...providers } },
  buttonLink: (url, label) => `<a href="${url}">${label}</a>`,
});

test("Login/Registration chia sẻ đúng layout, heading duy nhất, mobile brand và tuyến URL", () => {
  for (const route of ["login", "register"]) {
    const html = views().authPage(route);
    assert.match(html, new RegExp(`class="auth-page auth-page--${route}" aria-labelledby="auth-page-title"`));
    assert.match(html, /class="container auth-layout"/);
    assert.match(html, /class="auth-showcase"/);
    assert.match(html, /class="auth-panel__brand" aria-label="Momevia"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /<h1 id="auth-page-title">/);
    assert.match(html, /href="\/" data-link class="auth-back"/);
  }
});

test("Login đặt CTA Đăng ký ngay cạnh form; Register có liên kết quay về Đăng nhập", () => {
  const login = views().authPage("login");
  const register = views().authPage("register");
  assert.match(login, /href="\/register" data-link/);
  assert.match(login, /auth-switch auth-switch--signup/);
  assert.ok(login.indexOf("auth-switch--signup") > login.indexOf('id="email-login-form"'));
  assert.match(register, /href="\/login" data-link/);
  assert.match(register, /name="name" autocomplete="name"/);
  assert.match(register, /name="confirmPassword" type="password" autocomplete="new-password"/);
  assert.match(register, /minlength="8"/);
  assert.match(login, /name="email" type="email" autocomplete="email" inputmode="email"/);
  assert.match(login, /autocomplete="current-password"/);
  assert.match(register, /autocomplete="new-password"/);
});

test("OAuth Google/Zalo chỉ xuất hiện ở Login, và chỉ có URL khi backend sẵn sàng", () => {
  const disabled = views().authPage("login");
  assert.equal((disabled.match(/class="auth-social auth-social--disabled"/g) || []).length, 2);
  assert.match(disabled, /data-auth-provider="google" disabled/);
  assert.match(disabled, /data-auth-provider="zalo" disabled/);
  assert.doesNotMatch(disabled, /href="\/api\/auth\/(google|zalo)"/);
  assert.match(disabled, /auth-provider-note" role="status"/);

  const one = views({ google: true }).authPage("login");
  assert.equal((one.match(/class="auth-social" href="\/api\/auth\/google"/g) || []).length, 1);
  assert.match(one, /data-auth-provider="zalo" disabled/);
  assert.doesNotMatch(one, /href="\/api\/auth\/zalo"/);

  const two = views({ google: true, zalo: true }).authPage("login");
  assert.match(two, /href="\/api\/auth\/google"/);
  assert.match(two, /href="\/api\/auth\/zalo"/);
  assert.equal((two.match(/class="auth-social" href=/g) || []).length, 2);
  assert.doesNotMatch(two, /auth-provider-note" role="status"/);

  const register = views({ google: true, zalo: true }).authPage("register");
  assert.doesNotMatch(register, /data-auth-provider="google"|data-auth-provider="zalo"/);
});

test("Form đủ label, toggle password và báo lỗi truy cập được", () => {
  for (const route of ["login", "register"]) {
    const html = views().authPage(route);
    assert.match(html, /class="auth-field__label"/);
    assert.match(html, /class="auth-inline-error" role="alert" hidden/);
    assert.match(html, /data-action="toggle-password"/);
    assert.match(html, /aria-pressed="false"/);
    assert.match(html, /class="btn btn--dark btn--wide auth-submit" type="submit"/);
    assert.match(html, /href="\/policies\/privacy" data-link/);
  }
});

test("Typography 16px và vùng thao tác >=44px, cân đối tại desktop và mobile", () => {
  const css = source("web/css/auth-pages.css");
  const input = css.match(/\.auth-panel \.auth-input input\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(input, /font-size:\s*16px;/);
  assert.match(input, /min-height:\s*52px;/);
  assert.match(css, /\.auth-panel \.auth-toggle-password\s*\{[^}]*min-height:\s*44px;/);
  assert.match(css, /\.auth-panel \.auth-submit\s*\{[^}]*min-height:\s*54px;/);
  assert.match(css, /@media \(max-width:\s*990px\)\s*\{/);
  assert.match(css, /@media \(max-width:\s*600px\)\s*\{/);
  assert.match(css, /\.auth-panel \.auth-form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.doesNotMatch(css, /auth-page--register \.auth-form\s*\{[^}]*repeat\(2/);
});

test("Không còn CSS auth ghi đè trong ui-polish; CSS được kiểm tra chống khai báo dồn", () => {
  const auth = source("web/css/auth-pages.css");
  const polish = source("web/css/ui-polish.css");
  assert.doesNotMatch(polish, /\.auth-page|\.auth-showcase|\.auth-panel/);
  for (const [path, value] of [["auth-pages.css", auth], ["ui-polish.css", polish]]) {
    const result = auditCssStyle(value, path);
    assert.deepEqual(result.errors, [], path);
  }
  assert.doesNotMatch(auth, /\.auth-switch a\s*,\s*\.is-auth \.site-tools\s*\{\s*display:\s*none;/);
});

test("CSS tôn trọng reduced-motion; cả ba font Momevia được giữ nguyên", () => {
  const css = source("web/css/auth-pages.css");
  const tokens = source("web/css/tokens.css");
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation:\s*none;/);
  assert.match(css, /font-family:\s*var\(--font-body\)/);
  assert.match(css, /font-family:\s*var\(--font-display\)/);
  assert.match(css, /font-family:\s*var\(--font-serif\)/);
  assert.match(tokens, /--font-display:\s*"Plus Jakarta Sans"/);
  assert.match(tokens, /--font-body:\s*"Inter"/);
  assert.match(tokens, /--font-serif:\s*"Lora"/);
});

test("Không thêm khóa dịch khác nhau giữa VI và EN, không hardcode bản dịch trong form", () => {
  const vi = JSON.parse(source("web/assets/locales/vi.json"));
  const en = JSON.parse(source("web/assets/locales/en.json"));
  assert.deepEqual(Object.keys(vi), Object.keys(en));
  for (const name of ["auth.login.title", "auth.register.title", "auth.register.switch", "auth.login.switch", "auth.login.lead", "auth.register.lead"]) {
    assert.ok(vi[name] && en[name]);
    assert.notEqual(vi[name], en[name]);
  }
  const script = source("web/js/pages/auth.js");
  assert.doesNotMatch(script, /Bạn chưa có tài khoản|Đăng ký ngay|Đăng nhập ngay/);
});
