import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword } from '../../src/shared/credential-policy.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { registrationErrors } from '../../web/js/features/auth/registration.js';

const form = { name: 'Demo User', email: 'demo@example.test', terms: true, privacy: true };

test('Frontend và backend dùng cùng quy tắc mật khẩu mới', () => {
  for (const [password, key] of [
    ['', 'errors.auth.passwordLength'],
    ['Abc1234', 'errors.auth.passwordLength'],
    ['abc12345', 'errors.auth.passwordComposition'],
    ['ABCDEFGH', 'errors.auth.passwordComposition'],
    ['12345678', 'errors.auth.passwordComposition'],
    ['Abc12345', undefined],
    ['AAAAAAA1', undefined],
    ['A1'.repeat(64), undefined],
    ['A1'.repeat(64) + 'A', 'errors.auth.passwordTooLong'],
  ]) {
    const errors = registrationErrors({ ...form, password, confirmPassword: password });
    assert.equal(errors.password, key, password.length);
    if (key) assert.throws(() => validatePassword(password), { status: 400, messageKey: key });
    else assert.equal(validatePassword(password), undefined);
  }
});

test('Tài khoản cũ có mật khẩu không chứa chữ hoa vẫn đăng nhập được', async () => {
  const rows = [];
  const service = new CredentialsService({ all: () => rows });
  const password = 'legacy123';
  rows.push({ id: 'legacy', provider: 'email', email: form.email, passwordHash: await service.hashPassword(password) });
  assert.throws(() => service.validatePassword(password), { status: 400, messageKey: 'errors.auth.passwordComposition' });
  assert.equal((await service.login({ email: form.email, password })).id, 'legacy');
});
