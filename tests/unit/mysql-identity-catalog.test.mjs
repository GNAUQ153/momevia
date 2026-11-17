import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MySqlUsersRepository, MySqlSessionStore, MySqlRoleService } from '../../src/modules/identity/mysql.repositories.mjs';
import { MySqlTemplatesRepository, MySqlFavoritesService } from '../../src/modules/catalog/mysql.repositories.mjs';

const id = randomUUID();
const user = {id,provider:'email',providerId:'foo@example.test',name:'Foo',email:'foo@example.test',
  passwordHash:'hash',role:'sender',createdAt:'2026-11-01T00:00:00.000Z',testAccount:{source:'env'}};

test('MySQL users insert uses parameters, retrieves sensitive payload without leaking in API, and role changes are transactional', async () => {
  let stored;
  let calls=[];
  const client = {
    async execute(sql, params=[]) {
      calls.push({sql, params});
      if (sql.includes('INSERT INTO users')) { stored = params; return [{affectedRows:1}]; }
      if (sql.includes('SELECT * FROM users')) return [[{id:stored[0], provider:stored[1],provider_id:stored[2],
        name:stored[3],email:stored[4],password_hash:stored[5],avatar:stored[6],role:stored[7],
        created_at:stored[8],legacy_payload:stored[9]}]];
      return [[]];
    },
    async withTransaction(work) { return work({execute:async(sql, params)=>{
      if (sql.includes('FOR UPDATE')) return this.execute('SELECT * FROM users');
      if (sql.includes('UPDATE users')) { stored[7]=params[6];stored[9]=params[7]; return [{affectedRows:1}]; }
      return [[]];
    }}); }
  };
  const repo = new MySqlUsersRepository(client);
  assert.equal((await repo.insert(user)).id, id);
  assert.equal((await repo.get(id)).testAccount.source, 'env');
  const updated=await repo.update(id, {role:'creator'});
  assert.equal(updated.role,'creator');
  assert.equal((await repo.get(id)).role,'creator');
  assert(calls[0].sql.includes('?'));
  assert(!calls[0].sql.includes(user.email));
});

test('MySQL sessions verify durable jti, revoke, and resolve current role from Users', async () => {
  const secret='test-only-secret-for-session-regression';
  let active;
  const client={ async execute(sql,params=[]) {
    if(sql.includes('INSERT INTO sessions')) {active=params;return [{}];}
    if(sql.includes('DELETE FROM sessions')) {active=null;return [{}];}
    if(sql.includes('SELECT id FROM sessions')) return [active?.[0]===params[0] ? [{id:params[0]}] : []];
    return [[]];
  }};
  const users={ get:async queried=>queried===id?{...user,role:'admin'}:null };
  const store=new MySqlSessionStore(client,users,secret);
  const token=await store.create(user);
  assert.equal((await store.find(token)).role,'admin');
  await store.revoke(token);
  assert.equal(await store.find(token),null);
});

test('MySQL roles reject unauthorized changes and return authoritative role', async () => {
  const all=[{...user,role:'sender'}];
  const users={get:async target=>all.find(u=>u.id===target), all:async()=>all,
    update:async(target,patch)=>Object.assign(all.find(u=>u.id===target),patch)};
  const roles=new MySqlRoleService(users);
  await assert.rejects(roles.change(id,id,'admin'),{status:403});
  all[0].role='admin';
  assert.equal((await roles.change(id,id,'creator')).role,'creator');
});

test('MySQL Catalog preserves template payload and guards Favorites before SQL', async () => {
  let stored;
  const queries=[];
  const client={async execute(sql, params=[]) {
    queries.push([sql,params]);
    if(sql.includes('INSERT INTO templates')) {stored=params;return [{}];}
    if(sql.includes('SELECT * FROM templates')) return [[{id:stored[0],creator_id:stored[1],title:stored[2],
      style:stored[3],theme:stored[4],price_vnd:stored[5],status:stored[6],created_at:stored[7],payload:stored[8]}]];
    if(sql.includes('SELECT template_id')) return [[{templateId:'seed-1'}]];
    return [[]];
  }};
  const repo=new MySqlTemplatesRepository(client);
  const template={id:'seed-1',creatorId:'system',title:'Mẫu 1',style:'Vui',theme:'mint',price:0,
    status:'published',createdAt:'2026-11-01T00:00:00.000Z',subtitle:'Một mẫu'};
  await repo.insert(template);
  assert.equal((await repo.get('seed-1')).subtitle,'Một mẫu');
  assert.equal(stored[1],null);
  const favorites=new MySqlFavoritesService(client);
  await assert.rejects(favorites.set(id,'missing',true,new Set(['seed-1'])),{status:404});
  assert.deepEqual(await favorites.list(id,new Set(['seed-1'])),['seed-1']);
  await favorites.set(id,'seed-1',true,new Set(['seed-1']));
  assert(queries.some(([sql])=>sql.includes('ON DUPLICATE KEY UPDATE')));
});
