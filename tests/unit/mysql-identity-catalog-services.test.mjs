import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IdentityService } from '../../src/modules/identity/identity.service.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';

const id=randomUUID();

test('IdentityService works with async MySQL repositories, issues session and checks current user', async () => {
  const rows=[];
  const users={
    findByProvider:async(provider,providerId)=>rows.find(u=>u.provider===provider && u.providerId===providerId),
    insert:async user=>{rows.push(user);return user;},
    update:async(userId,patch)=>Object.assign(rows.find(u=>u.id===userId),patch),
    get:async userId=>rows.find(u=>u.id===userId),
  };
  const session={
    create:async user=>`token-${user.id}`,
    find:async token=>token.startsWith('token-')?{sub:token.slice(6)}:null,
  };
  const service=new IdentityService({users,sessions:session,config:{}});
  const user=await service.findOrCreate('google','caseSensitive-G2',{name:'Tester',email:'tester@example.test'});
  const repeat=await service.findOrCreate('google','caseSensitive-G2',{name:'Updated'});
  assert.equal(user.id,repeat.id);
  assert.equal(rows.length,1);
  const res={headers:{},setHeader(name,value){this.headers[name]=value;}};
  await service.issueSession(res,user);
  const token=res.headers['set-cookie'][0].match(/^session=([^;]+)/)[1];
  assert.equal((await service.findCurrent({headers:{authorization:`Bearer ${token}`}})).id,user.id);
});

test('CatalogService handles async search, favorites and moderation without returning unresolved Promise',async()=>{
  const rows=[{id:'seed',title:'Bình minh',subtitle:'Cỏ xanh',creator:'Momevia',creatorId:'system',
    style:'Thiên nhiên',theme:'sage',price:0,status:'published',createdAt:'2026-11-01T00:00:00.000Z'},
  {id:'draft',title:'Draft',subtitle:'Waiting',creator:'Maker',creatorId:id,
    style:'Độc quyền',theme:'sage',price:1000,status:'pending',createdAt:'2026-11-02T00:00:00.000Z'}];
  const repo={all:async()=>rows, get:async key=>rows.find(x=>x.id===key),
    update:async(key,patch)=>Object.assign(rows.find(x=>x.id===key),patch),
    insert:async item=>{rows.push(item);return item;}};
  const favorites={list:async(userId,ids)=>ids.has('seed')?['seed']:[],set:async(userId,templateId,saved)=>({templateId,saved})};
  const catalog=new CatalogService(repo,favorites);
  assert.equal((await catalog.search({q:'BÌNH'})).length,1);
  assert.equal((await catalog.favoriteIds({sub:id}))[0],'seed');
  await assert.rejects(catalog.approve({role:'sender'},'draft'),{status:403});
  assert.equal((await catalog.pending({role:'admin'})).length,1);
  await catalog.approve({role:'admin'},'draft');
  assert.equal((await catalog.publicOne('draft')).status,'published');
});
