import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.PUBLIC_BASE_URL || 'http://localhost:4100';
let cookie = '';
let adminCookie = '';
async function request(path, method='GET', body, admin=false) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(body ? {'content-type':'application/json'} : {}),
      ...(admin ? {cookie:adminCookie} : cookie ? {cookie} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return {response, data};
}
const log = name => console.log(`PASS  ${name}`);
try {
  let result = await request('/auth/providers');
  assert.equal(result.response.status,200);
  assert.equal(result.data.demo,true, 'Bật DEMO_AUTH_ENABLED để chạy kiểm thử');
  log('API & khả năng đăng nhập demo');

  result = await request('/catalog/templates');
  assert.equal(result.response.status,200);
  assert(result.data.templates.length >= 12);
  const free = result.data.templates.find(t=>t.price===0);
  const paid = result.data.templates.find(t=>t.price>0);
  assert(free && paid);
  log('Kho mẫu có mẫu miễn phí và trả phí');

  result = await request('/auth/demo','POST',{name:'Người kiểm thử',deviceId:randomUUID()});
  assert.equal(result.response.status,200);
  cookie = result.response.headers.get('set-cookie').split(';')[0];
  assert(cookie.startsWith('session='));
  log('Đăng nhập local và nhận session HttpOnly');

  result = await request('/gifts/gifts','POST',{templateId:paid.id, recipientName:'Mai',senderName:'An',message:'Một năm thật đẹp.'});
  assert.equal(result.response.status,402);
  log('Chặn xuất bản mẫu có phí trước khi mua');

  result = await request('/gifts/gifts','POST',{templateId:free.id, recipientName:'Mai',senderName:'An',message:'Chúc mừng sinh nhật!'});
  assert.equal(result.response.status,201,JSON.stringify(result.data));
  const slug = result.data.gift.slug;
  assert(slug.length > 18);
  log('Xuất bản món quà miễn phí');

  result = await request(`/gifts/gifts/${slug}`);
  assert.equal(result.response.status,200);
  assert.equal(result.data.gift.message,'Chúc mừng sinh nhật!');
  assert(!('userId' in result.data.gift));
  log('Người nhận xem qua link không cần đăng nhập');

  result = await request(`/gifts/gifts/${slug}/replies`,'POST',{name:'Mai',message:'Mình rất thích món quà này!'});
  assert.equal(result.response.status,201);
  result = await request(`/gifts/gifts/${slug}/replies`);
  assert.equal(result.data.replies.length,1);
  log('Người nhận phản hồi và lưu lời nhắn');

  result = await request('/checkout/orders/demo-purchase','POST',{templateId:paid.id});
  assert.equal(result.response.status,201);
  assert.equal(result.data.order.status,'demo_paid');
  log('Đơn hàng mô phỏng không thu tiền');

  result = await request('/gifts/gifts','POST',{templateId:paid.id, recipientName:'Vy',senderName:'An',message:'Mong mọi điều tốt lành.'});
  assert.equal(result.response.status,201);
  log('Cấp quyền mẫu sau khi mua demo');

  result = await request('/auth/creator','POST',{});
  assert.equal(result.response.status,200);
  cookie = result.response.headers.get('set-cookie').split(';')[0];
  assert.equal(result.data.user.role,'creator');
  log('Nâng vai trò thành Creator');

  const createdTitle = `Mẫu kiểm thử ${randomUUID().slice(0,6)}`;
  result = await request('/catalog/creator/templates','POST',{title:createdTitle,subtitle:'Mẫu mô phỏng do Creator đăng.',theme:'rose',price:39000});
  assert.equal(result.response.status,201);
  const newTemplate = result.data.template;
  assert.equal(newTemplate.status,'pending');
  log('Creator gửi mẫu chờ duyệt');

  result = await request(`/catalog/templates/${newTemplate.id}`);
  assert.equal(result.response.status,404);
  log('Không công khai mẫu chưa được duyệt');

  const adminCode = process.env.DEMO_ADMIN_CODE || 'local-admin-2026';
  result = await request('/auth/demo-admin','POST',{code:adminCode});
  assert.equal(result.response.status,200);
  adminCookie = result.response.headers.get('set-cookie').split(';')[0];
  result = await request(`/catalog/admin/templates/${newTemplate.id}/approve`,'POST',{},true);
  assert.equal(result.response.status,200);
  log('Admin duyệt mẫu qua quyền riêng');

  result = await request(`/catalog/templates/${newTemplate.id}`);
  assert.equal(result.response.status,200);
  log('Mẫu được công khai sau kiểm duyệt');

  console.log('\nĐÃ HOÀN THÀNH: 14 bước kiểm thử luồng đầu-cuối.');
} catch(error) {
  console.error('\nFAILED', error);
  process.exitCode = 1;
}
