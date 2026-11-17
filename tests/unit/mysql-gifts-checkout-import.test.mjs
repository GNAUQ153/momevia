import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepareGiftsCheckout, applyGiftsCheckout } from '../../database/scripts/import-gifts-checkout.mjs';

const userId=randomUUID();
const giftId=randomUUID();
const orderId=randomUUID();
const templateId='template-paid';
const ref={users:[{id:userId}],templates:[{id:templateId,price:20000}]};
function example() {
  return {
    orders:[{id:orderId,userId,templateId,templateTitle:'Paid demo',grossAmount:20000,
      platformFee:4000,creatorAmount:16000,currency:'VND',status:'demo_paid',
      paymentProvider:'local_demo_only',createdAt:'2026-11-17T00:00:00.000Z'}],
    gifts:[{id:giftId,slug:'b'.repeat(24),userId,templateId,recipientName:'Mai',senderName:'An',message:'Hi',
      replyCount:1,createdAt:'2026-11-17T00:00:00.000Z',expiresAt:'2027-11-17T00:00:00.000Z'}],
    replies:[{id:randomUUID(),giftId,name:'Mai',message:'Thank you',createdAt:'2026-11-17T00:01:00.000Z'}],
  };
}

test('dry-run validates references, reply counts, balanced fees and duplicate demo keys', () => {
  const snapshot=example();
  assert.equal(prepareGiftsCheckout(snapshot,ref).orders.length,1);
  assert.throws(()=>prepareGiftsCheckout({...snapshot,replies:[]},ref),/replyCount/);
  assert.throws(()=>prepareGiftsCheckout({...snapshot,orders:[...snapshot.orders,{...snapshot.orders[0],id:randomUUID()}]},ref),/trùng/);
  assert.throws(()=>prepareGiftsCheckout({...snapshot,orders:[{...snapshot.orders[0],creatorAmount:15000}]},ref),/mất cân đối/);
  assert.throws(()=>prepareGiftsCheckout({...snapshot,gifts:[{...snapshot.gifts[0],userId:randomUUID()}]},ref),/userId/);
});

test('import is one transaction, checks destination empty and inserts orders -> rights -> gifts -> replies', async () => {
  const calls=[];
  const mock={async withTransaction(work) {
    return work({execute:async(sql,params=[])=>{
      calls.push({sql,params});
      if(sql.includes('SELECT COUNT')) return [[{total:0}]];
      if(sql.includes('SELECT id FROM users')) return [[{id:userId}]];
      if(sql.includes('SELECT id FROM templates')) return [[{id:templateId}]];
      return [{affectedRows:1}];
    }});
  }};
  const result=await applyGiftsCheckout(prepareGiftsCheckout(example(),ref),mock);
  assert.deepEqual(result,{orders:1,gifts:1,replies:1,demoEntitlements:1});
  const inserts=calls.filter(c=>c.sql.includes('INSERT INTO'));
  assert.deepEqual(inserts.map(c=>c.sql.match(/INSERT INTO (\w+)/)[1]),
    ['orders','demo_purchases','template_entitlements','gifts','gift_replies']);
  assert(inserts.every(c=>c.sql.includes('?')));
});

test('import refuses nonempty MySQL tables before any inserts', async () => {
  const calls=[];
  const mock={async withTransaction(work) {
    return work({execute:async(sql)=>{
      calls.push(sql);
      if(sql.includes('SELECT COUNT')) return [[{total:1}]];
      return [[]];
    }});
  }};
  await assert.rejects(applyGiftsCheckout(prepareGiftsCheckout(example(),ref),mock),/đã có dữ liệu/);
  assert(!calls.some(sql=>sql.includes('INSERT')));
});
