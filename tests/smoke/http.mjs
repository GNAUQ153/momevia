import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const password = 'SyntheticSmoke2026';
const credentials = () => ({ name: 'Người dùng kiểm thử', email: `smoke-${randomUUID()}@example.test`, password, confirmPassword: password });
const session = headers => {
  const cookie = headers.get('set-cookie');
  assert.match(cookie || '', /^session=/);
  assert.match(cookie, /;\s*HttpOnly/i);
  return cookie.split(';')[0];
};

function client(base) {
  return async (route, { body, cookie, status = 200 } = {}) => {
    const response = await fetch(base + '/api' + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, `${route}: ${JSON.stringify(data)}`);
    return { data, headers: response.headers };
  };
}

async function auth(base) {
  const call = client(base);
  const account = credentials();
  const created = await call('/auth/register', { body: account, status: 201 });
  assert.equal(created.data.user.email, account.email);
  assert(!('passwordHash' in created.data.user));
  const { data } = await call('/auth/me', { cookie: session(created.headers) });
  assert.equal(data.user.email, account.email);
  assert(!('passwordHash' in data.user));
  await call('/auth/register', { body: { ...account, email: account.email.toUpperCase() }, status: 409 });
  await call('/auth/login', { body: { email: account.email, password: 'WrongSynthetic2026' }, status: 401 });
  await call('/auth/login', { body: { email: account.email.toUpperCase(), password } });
  console.log('PASS đăng ký, cookie HttpOnly, email chuẩn hóa và từ chối mật khẩu sai');
}

async function ui(base) {
  const routes = [
    '/login', '/register', '/explore', '/policies/general', '/policies/payment', '/policies/privacy', '/policies/content',
    '/js/catalog-filter.js', '/js/legal.js', '/css/auth-pages.css', '/css/catalog-filters.css', '/css/pagination.css', '/css/legal.css',
  ];
  for (const route of routes) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert((await response.text()).length > 50, route);
  }
  console.log(`PASS ${routes.length} route và tài nguyên giao diện`);
}

async function upgrade(base) {
  const call = client(base);
  const front = await fetch(base);
  assert.equal(front.status, 200);
  const html = await front.text();
  for (const marker of ['Momevia', '/css/upgrade.css', 'data-action="support"']) assert(html.includes(marker));
  const logo = await fetch(base + '/assets/momevia-logo-3d.png');
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /^image\/png/);

  const { data: { templates } } = await call('/catalog/templates');
  assert(templates.length >= 12);
  const { id: templateId } = templates[0];
  const account = credentials();
  await call('/catalog/favorites', { status: 401 });
  const first = session((await call('/auth/register', { body: account, status: 201 })).headers);
  const getFavorites = async cookie => (await call('/catalog/favorites', { cookie })).data.templateIds;
  assert.deepEqual(await getFavorites(first), []);
  for (let attempt = 0; attempt < 2; attempt++) {
    await call('/catalog/favorites', { cookie: first, body: { templateId, saved: true } });
    assert.deepEqual(await getFavorites(first), [templateId]);
  }
  const second = session((await call('/auth/register', { body: credentials(), status: 201 })).headers);
  assert.deepEqual(await getFavorites(second), []);
  await call('/catalog/favorites', { cookie: first, body: { templateId, saved: false } });
  assert.deepEqual(await getFavorites(first), []);

  const ticket = { name: account.name, email: account.email, topic: 'Tạo và chia sẻ quà', message: 'Mình cần hỗ trợ một vấn đề khi tạo quà trên điện thoại.' };
  const result = await call('/support/requests', { body: ticket, status: 201 });
  assert.match(result.data.ticket.code, /^HT-\d{4}-[A-F0-9]{8}$/);
  await call('/support/admin/requests', { cookie: second, status: 403 });
  await call('/support/requests', { body: { ...ticket, email: 'invalid' }, status: 400 });
  console.log('PASS trang chủ, logo cục bộ, danh mục, yêu thích và Support');
}

async function legacy(base, adminCode) {
  const call = client(base);
  assert.equal((await call('/auth/providers')).data.demo, true);
  const { data: { templates } } = await call('/catalog/templates');
  const free = templates.find(template => template.price === 0);
  const paid = templates.find(template => template.price > 0);
  assert(free && paid);
  const demo = await call('/auth/demo', { body: { name: 'Người kiểm thử', deviceId: randomUUID() } });
  const cookie = session(demo.headers);
  const gift = { recipientName: 'Mai', senderName: 'An', message: 'Chúc mừng sinh nhật!' };
  await call('/gifts/gifts', { cookie, body: { ...gift, templateId: paid.id }, status: 402 });
  const { data: { gift: { slug } } } = await call('/gifts/gifts', { cookie, body: { ...gift, templateId: free.id }, status: 201 });
  assert(slug.length > 18);
  const route = `/gifts/gifts/${slug}`;
  const { data: { gift: publicGift } } = await call(route);
  assert.equal(publicGift.message, gift.message);
  assert(!('userId' in publicGift));
  await call(route + '/replies', { body: { name: 'Mai', message: 'Cảm ơn bạn!' }, status: 201 });
  assert.equal((await call(route + '/replies')).data.replies.length, 1);
  const purchase = await call('/checkout/orders/demo-purchase', { cookie, body: { templateId: paid.id }, status: 201 });
  assert.equal(purchase.data.order.status, 'demo_paid');
  await call('/gifts/gifts', { cookie, body: { ...gift, templateId: paid.id }, status: 201 });

  await call('/auth/creator', { cookie, body: {}, status: 403 });
  assert(adminCode, 'Cần DEMO_ADMIN_CODE riêng của fixture.');
  const admin = session((await call('/auth/demo-admin', { body: { code: adminCode } })).headers);
  const userId = (await call('/auth/me', { cookie })).data.user.id;
  const role = await call(`/auth/admin/users/${encodeURIComponent(userId)}/role`, { cookie: admin, body: { role: 'creator' } });
  assert.equal(role.headers.get('set-cookie'), null);
  assert.equal(role.data.user.role, 'creator');
  const { data: { template } } = await call('/catalog/creator/templates', {
    cookie, status: 201,
    body: { title: `Mẫu cũ ${randomUUID().slice(0, 6)}`, subtitle: 'Mẫu mô phỏng do Creator đăng.', theme: 'rose', price: 39000 },
  });
  assert.equal(template.status, 'pending');
  await call(`/catalog/templates/${template.id}`, { status: 404 });
  await call(`/catalog/admin/templates/${template.id}/approve`, { cookie: admin, body: {} });
  await call(`/catalog/templates/${template.id}`);
  console.log('PASS hợp đồng legacy cho quà miễn phí, quyền mẫu có giá, phản hồi và duyệt mẫu');
}

const suites = { auth, upgrade, legacy, ui };
export async function runHttpSmoke(base, { group = 'all', adminCode } = {}) {
  if (group !== 'all' && !Object.hasOwn(suites, group)) throw new Error(`Không có nhóm smoke ${group}.`);
  const selected = group === 'all' ? Object.values(suites) : [suites[group]];
  for (const run of selected) await run(base, adminCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runHttpSmoke(process.env.PUBLIC_BASE_URL || 'http://localhost:4100', {
    group: process.argv[2] || 'upgrade', adminCode: process.env.DEMO_ADMIN_CODE,
  });
