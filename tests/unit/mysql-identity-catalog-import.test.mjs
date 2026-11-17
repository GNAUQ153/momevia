import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepareIdentityCatalog, applyIdentityCatalog } from '../../database/scripts/import-identity-catalog.mjs';
const id=randomUUID();
const value={users:[{id,provider:'email',providerId:'u@example.test',name:'U',email:'u@example.test',
  passwordHash:'salt:hash',role:'sender',createdAt:'2026-11-01T00:00:00.000Z'}],
  templates:[{id:'seed-1',creatorId:'system',title:'Seed',style:'Fun',theme:'sky',price:0,status:'published',createdAt:'2026-11-01T00:00:00.000Z'}],
  favorites:[{userId:id,templateId:'seed-1',createdAt:'2026-11-03T00:00:00.000Z'}],
  sessions:[{id:'token1',userId:id,exp:1900000000},{id:'old',userId:id,exp:1}]};

test('Importer checks foreign keys, duplicate emails and expired sessions without changing snapshot', () => {
  const input=structuredClone(value);
  const plan=prepareIdentityCatalog(input,1750000000000);
  assert.equal(plan.sessions.length,1);
  assert.equal(plan.expiredSessionCount,1);
  assert.deepEqual(input,value);
  const invalid=structuredClone(value);
  invalid.favorites[0].templateId='missing';
  assert.throws(()=>prepareIdentityCatalog(invalid),/favorite template/);
  const duplicate=structuredClone(value);
  duplicate.users.push({...duplicate.users[0],id:randomUUID(),providerId:'U@EXAMPLE.TEST',email:'U@EXAMPLE.TEST'});
  assert.throws(()=>prepareIdentityCatalog(duplicate),/email đăng nhập/);
});

test('Importer performs writes inside one transaction and aborts if data already exists', async () => {
  const plan=prepareIdentityCatalog(value,1750000000000);
  const sql=[];
  const client={ async withTransaction(work) {
    return work({execute:async(text, params=[])=>{
      sql.push([text,params]);
      if (text.includes('COUNT(*)')) return [[{total:0}]];
      return [{affectedRows:1}];
    }});
  }};
  const counts=await applyIdentityCatalog(plan,client);
  assert.deepEqual(counts,{users:1,templates:1,favorites:1,sessions:1});
  assert(sql.some(([q])=>q.includes('INSERT INTO users')));
  assert(sql.every(([q,params])=>!q.includes('u@example.test')));
  const occupied={withTransaction:async work=>work({execute:async()=>[[{total:1}]]})};
  await assert.rejects(applyIdentityCatalog(plan,occupied),/đã có dữ liệu/);
});
