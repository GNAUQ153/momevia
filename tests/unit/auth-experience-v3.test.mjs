import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthViews } from '../../web/js/pages/auth.js';
import { registrationErrors } from '../../web/js/features/auth/registration.js';

const valid = { name: 'Demo User', email: 'demo@example.test', password: 'Demo1234', confirmPassword: 'Demo1234', terms: true, privacy: true };
const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
test('Register có thể gửi kiểm tra ngay cả khi chưa điền; hai checkbox vẫn bắt buộc', () => {
  const views = createAuthViews({ state: { user: null, providers: { google: true, zalo: true } }, buttonLink: () => '' });
  const login = views.authPage('login'), register = views.authPage('register');
  assert.match(login, /auth-login\.svg/);
  assert.match(register, /auth-register\.svg/);
  assert.match(register, /id="register-form" class="auth-form" novalidate/);
  assert.match(register, /auth-submit" type="submit">/);
  assert.equal((register.match(/required data-auth-consent/g) || []).length, 2);
  assert.match(register, /data-auth-provider-url="\/api\/auth\/google" disabled/);
  assert.doesNotMatch(login, /novalidate/);
});
test('Kiểm tra toàn bộ dữ liệu trống và chỉ cho qua dữ liệu hợp lệ', () => {
  assert.deepEqual(Object.keys(registrationErrors()), ['name', 'email', 'password', 'confirmPassword', 'terms', 'privacy']);
  assert.deepEqual(registrationErrors(valid), {});
  for (const [field, value] of [['name', '  '], ['name', 'x'.repeat(51)], ['email', 'bad'], ['password', '12345678'], ['password', 'abcabcabc'], ['password', 'abc12345'], ['password', 'A1'.repeat(65)], ['confirmPassword', 'wrong'], ['terms', false], ['privacy', false]]) {
    assert.ok(registrationErrors({ ...valid, [field]: value })[field], field);
  }
});
test('Validation đặt trước loading/API, controller login vẫn độc lập', () => {
  const main = read('web/js/app/main.js');
  assert.match(main, /if \(route === "register"\) mountRegistration\(main\);\s*else mountAuthEntry\(main\);/);
  assert.match(main, /if \(form.id === "register-form" && !validateRegistrationForm\(form\)\) return;\s*if \(submit\) submit.disabled = true;/);
  assert.match(main, /if \(form.id === "register-form"\) setRegistrationPending\(form, false\)/);
});
test('Artwork cục bộ và nội dung dịch riêng cho hai form', () => {
  for (const mode of ['login','register']) {
    const svg = read(`web/assets/brand/auth-${mode}.svg`);
    assert.match(svg, /<svg/);
    assert.doesNotMatch(svg, /<script|<foreignObject|\bhref=/i);
    for (const locale of ['vi','en']) {
      const dictionary = JSON.parse(read(`web/assets/locales/${locale}.json`));
      for (const key of ['lineOne','lineTwo','description']) assert.ok(dictionary[`auth.showcase.${mode}.${key}`]);
    }
  }
});
