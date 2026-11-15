import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Kiểm thử thực tế qua API Gateway; tạo email mới để tránh trùng dữ liệu local.
const base = process.env.PUBLIC_BASE_URL || 'http://localhost:4100';
const email = `smoke.${randomUUID().slice(0, 12)}@example.com`;
const password = 'MiraSecure2026';

async function send(path, body, cookie = '') {
  const response = await fetch(`${base}/api/auth${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() };
}

try {
  const signup = await send('/register', {
    name: 'Người dùng kiểm thử',
    email,
    password,
    confirmPassword: password,
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.data.user.email, email);
  assert.equal('passwordHash' in signup.data.user, false);
  console.log('PASS  Đăng ký email và không lộ mật khẩu băm');

  const session = signup.response.headers.get('set-cookie')?.split(';')[0];
  assert(session?.startsWith('session='));
  const meResponse = await fetch(`${base}/api/auth/me`, { headers: { cookie: session } });
  const me = await meResponse.json();
  assert.equal(me.user.email, email);
  assert.equal('passwordHash' in me.user, false);
  console.log('PASS  Cookie HttpOnly và hồ sơ người dùng');

  const duplicated = await send('/register', {
    name: 'Trùng email',
    email: email.toUpperCase(),
    password,
    confirmPassword: password,
  });
  assert.equal(duplicated.response.status, 409);
  console.log('PASS  Chặn email trùng');

  const wrong = await send('/login', { email, password: 'PasswordWrong2026' });
  assert.equal(wrong.response.status, 401);
  console.log('PASS  Từ chối mật khẩu sai');

  const login = await send('/login', { email: email.toUpperCase(), password });
  assert.equal(login.response.status, 200);
  console.log('PASS  Đăng nhập bằng email không phân biệt chữ hoa');
  console.log('\n5/5 bài kiểm thử đăng ký và đăng nhập API thành công.');
} catch (error) {
  console.error('FAILED', error);
  process.exitCode = 1;
}
