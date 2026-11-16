import test from 'node:test';
import assert from 'node:assert/strict';
import { RoleService } from '../services/identity/roles.mjs';

function fixture() {
  const users = [{id:'a',role:'admin',name:'Admin'}, {id:'s',role:'sender',name:'Sender'}, {id:'c',role:'creator',name:'Creator'}];
  const repository = {get:id=>users.find(user=>user.id===id),all:()=>users,
    update:(id,patch)=>Object.assign(users.find(user=>user.id===id),patch)};
  return {service:new RoleService(repository),users};
}

test('Sender và Creator không tự đổi role hoặc đổi role người khác', () => {
  const {service,users}=fixture();
  const before=structuredClone(users);
  for(const actor of ['s','c','missing']) {
    for(const target of ['s','c','a']) for(const role of ['sender','creator','admin']) {
      assert.throws(()=>service.change(actor,target,role),{status:403});
    }
    assert.throws(()=>service.list(actor),{status:403});
  }
  assert.deepEqual(users,before);
});

test('Admin đổi một role hợp lệ, không thay thuộc tính tài khoản khác', () => {
  const {service,users}=fixture();
  assert.equal(service.change('a','s','creator').role,'creator');
  assert.equal(users[1].name,'Sender');
  assert.equal(service.change('a','c','sender').role,'sender');
  assert.throws(()=>service.change('a','s','owner'),{status:400});
  assert.throws(()=>service.change('a',null,'creator'),{status:400});
  assert.throws(()=>service.change('a','missing','creator'),{status:404});
  assert.equal(service.list('a').length,3);
});

test('Admin bị hạ quyền không thể dùng role cũ để đổi quyền tiếp', () => {
  const {service}=fixture();
  service.change('a','a','sender');
  assert.throws(()=>service.change('a','s','admin'),{status:403});
});
