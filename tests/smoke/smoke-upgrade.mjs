import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.PUBLIC_BASE_URL || 'http://localhost:4100';
let session = '';
async function api(path, method = 'GET', data, customCookie = session) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(data ? {'content-type':'application/json'} : {}),
      ...(customCookie ? {cookie: customCookie} : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}
function check(name) { console.log(`PASS  ${name}`); }

const suffix = randomUUID().replace(/-/g,'').slice(0,12);
const email = `momevia-test-${suffix}@example.test`;
const otherEmail = `momevia-second-${suffix}@example.test`;
const password = 'SecureTest2026!';
try {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert(html.includes('Momevia'));
  assert(html.includes('/css/upgrade.css'));
  assert(html.includes('data-action="support"'));
  check('Trang chủ tải nhận diện Momevia và nút hỗ trợ');

  const logo = await fetch(`${base}/assets/momevia-logo-3d.png`);
  assert.equal(logo.status, 200);
  assert((logo.headers.get('content-type') || '').startsWith('image/png'));
  check('Logo 3D tự host tải thành công');

  const templates = (await api('/catalog/templates')).payload.templates;
  assert(templates.length >= 12);
  const sample = templates[0];
  check('Catalog trả danh sách mẫu đã xuất bản');

  let result = await api('/catalog/favorites');
  assert.equal(result.response.status,401);
  check('Yêu thích từ chối truy cập chưa đăng nhập');

  result = await api('/auth/register','POST', {name:'Kiểm thử Momevia',email,password,confirmPassword:password},'');
  assert.equal(result.response.status,201,JSON.stringify(result.payload));
  session = result.response.headers.get('set-cookie')?.split(';')[0];
  assert(session?.startsWith('session='));
  check('Tạo tài khoản email và nhận cookie phiên');

  result = await api('/catalog/favorites');
  assert.deepEqual(result.payload.templateIds, []);
  check('Tài khoản mới chưa lưu mẫu');

  result = await api('/catalog/favorites','POST',{templateId: sample.id, saved:true});
  assert.equal(result.response.status,200,JSON.stringify(result.payload));
  result = await api('/catalog/favorites');
  assert.deepEqual(result.payload.templateIds, [sample.id]);
  check('Lưu mẫu yêu thích theo tài khoản');

  result = await api('/catalog/favorites','POST',{templateId: sample.id, saved:true});
  result = await api('/catalog/favorites');
  assert.deepEqual(result.payload.templateIds, [sample.id]);
  check('Lưu lặp không tạo bản ghi trùng');

  const firstSession = session;
  result = await api('/auth/register','POST',{name:'Người thứ hai',email:otherEmail,password,confirmPassword:password},'');
  assert.equal(result.response.status,201);
  session = result.response.headers.get('set-cookie')?.split(';')[0];
  result = await api('/catalog/favorites');
  assert.deepEqual(result.payload.templateIds, []);
  check('Yêu thích được cô lập giữa hai tài khoản');

  result = await api('/catalog/favorites', 'POST', {templateId: sample.id, saved:false}, firstSession);
  assert.equal(result.response.status,200);
  result = await api('/catalog/favorites','GET',undefined,firstSession);
  assert.deepEqual(result.payload.templateIds, []);
  check('Bỏ yêu thích tồn tại bền vững');

  result = await api('/support/requests','POST',{
    name:'Khách kiểm thử',email,topic:'Tạo và chia sẻ quà',message:'Mình cần hỗ trợ một vấn đề khi tạo quà trên điện thoại.'
  },'');
  assert.equal(result.response.status,201,JSON.stringify(result.payload));
  assert.match(result.payload.ticket.code,/^HT-\d{4}-[A-F0-9]{8}$/);
  check('Biểu mẫu liên hệ tạo phiếu hỗ trợ có mã tra cứu');

  result = await api('/support/admin/requests');
  assert.equal(result.response.status,403);
  check('Danh sách liên hệ chỉ dành cho quản trị viên');

  result = await api('/support/requests','POST',{
    name:'Khách kiểm thử',email:'invalid',topic:'Khác',message:'Nội dung yêu cầu liên hệ hợp lệ'
  },'');
  assert.equal(result.response.status,400);
  check('Từ chối email liên hệ không hợp lệ');

  console.log('\n13/13 kiểm thử mở rộng hoàn tất.');
} catch (error) {
  console.error('FAILED', error);
  process.exitCode = 1;
}
