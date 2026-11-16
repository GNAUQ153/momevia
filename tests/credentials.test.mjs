import test from 'node:test';
import assert from 'node:assert/strict';
import { CredentialsService, publicUser } from '../services/identity/credentials.mjs';

function repository() {
  const rows = [];
  return {
    all() { return [...rows]; },
    insert(user) { rows.push(user); return user; },
  };
}

test('Đăng ký mới tạo hash và không trả hash cho frontend', async () => {
  const service = new CredentialsService(repository());
  const user = await service.register({name:'Nguyễn Minh', email:'User@Example.com', password:'StrongPass123'});
  assert.equal(user.email, 'user@example.com');
  assert.notEqual(user.passwordHash, 'StrongPass123');
  assert.equal(await service.verifyPassword('StrongPass123', user.passwordHash), true);
  assert.equal(await service.verifyPassword('wrong-password', user.passwordHash), false);
  assert.equal('passwordHash' in publicUser(user), false);
});

test('Từ chối tài khoản trùng, đăng nhập bằng email không phân biệt hoa/thường', async () => {
  const service = new CredentialsService(repository());
  await service.register({name:'Lan Anh', email:'lan@example.com', password:'Password2026'});
  await assert.rejects(() => service.register({name:'Lan Anh', email:'LAN@example.com', password:'Password2026'}), {status:409});
  const user = await service.login({email:'LAN@example.com', password:'Password2026'});
  assert.equal(user.name,'Lan Anh');
  await assert.rejects(() => service.login({email:'lan@example.com', password:'123wrong'}), {status:401});
});

test('Kiểm tra dữ liệu đầu vào', async () => {
  const service = new CredentialsService(repository());
  await assert.rejects(() => service.register({name:'A', email:'test@example.com', password:'Password2026'}), {status:400});
  await assert.rejects(() => service.register({name:'Nguyen', email:'sai-email', password:'Password2026'}), {status:400});
  await assert.rejects(() => service.register({name:'Nguyen', email:'test@example.com', password:'passwordonly'}), {status:400});
});

test('Đăng ký đồng thời cùng email chỉ tạo một tài khoản', async () => {
  const repo = repository();
  const service = new CredentialsService(repo);
  const data = {name:'Kiểm thử đồng thời',email:'race@example.test',password:'ConcurrentPass123'};
  const results = await Promise.allSettled([
    service.register(data),
    service.register({...data,email:'RACE@example.test'}),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 1);
  assert.equal(repo.all().length, 1);
  const user = await service.login({email:data.email,password:data.password});
  assert.equal(user.id, repo.all()[0].id);
});

test('Quá bốn scrypt đồng thời trả 503, không xếp hàng hash không giới hạn', async () => {
  const repo=repository();
  const service=new CredentialsService(repo);
  const results=await Promise.allSettled(Array.from({length:8},(_,i)=>service.register({
    name:'Concurrent QA',email:`capacity-${i}@example.test`,password:'CapacityTest123',
  })));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,4);
  assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===503).length,4);
  assert.equal(repo.all().length,4);
  assert.equal(service.activeHashes,0);
});
