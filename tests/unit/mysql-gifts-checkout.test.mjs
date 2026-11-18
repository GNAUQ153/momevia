import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MySqlCheckoutRepository } from '../../src/modules/checkout/mysql.repository.mjs';
import { MySqlGiftsRepository, MySqlRepliesRepository } from '../../src/modules/gifts/mysql.repositories.mjs';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';

const userId = randomUUID();
const templateId = 'demo_paid_template';
const rowFor = o => ({id:o.id, user_id:o.userId, template_id:o.templateId,
  gross_vnd:o.grossAmount,platform_fee_vnd:o.platformFee,creator_amount_vnd:o.creatorAmount,
  currency:o.currency,status:o.status,payment_provider:o.paymentProvider,
  created_at:o.createdAt.replace('T',' ').replace('Z',''),payload:JSON.stringify(o)});

function checkoutFixture() {
  const operations = [];
  const orders = [];
  const keys = new Set();
  const entitlements = [];
  const client = {
    async execute(sql, params=[]) {
      operations.push([sql, params]);
      if (sql.includes('INNER JOIN orders o ON o.id=d.order_id')) {
        const order = orders.find(o=>o.userId === params[0] && o.templateId === params[1]);
        return [order ? [rowFor(order)] : []];
      }
      if (sql.includes('FROM template_entitlements')) return [entitlements.length ? [{licensed:1}] : []];
      if (sql.includes('FROM orders WHERE user_id')) return [orders.map(rowFor)];
      return [[]];
    },
    async withTransaction(fn) {
      const pending = {orders:[],keys:[],entitlements:[]};
      const tx={ execute: async(sql,params=[])=>{
        operations.push([sql,params]);
        if(sql.includes('INSERT INTO orders')) {
          pending.orders.push({ id:params[0], userId:params[1], templateId:params[2],
            grossAmount:params[3],platformFee:params[4],creatorAmount:params[5],
            status:'demo_paid',currency:'VND',paymentProvider:'local_demo_only',
            createdAt:`${params[6].replace(' ','T')}Z` });
        } else if (sql.includes('INSERT INTO demo_purchases')) {
          const key=`${params[0]}:${params[1]}`;
          if(keys.has(key)) { const e=new Error('Duplicate key');e.code='ER_DUP_ENTRY';throw e; }
          pending.keys.push(key);
        } else if(sql.includes('INSERT INTO template_entitlements')) pending.entitlements.push(params);
        return [{affectedRows:1}];
      }};
      const result=await fn(tx);
      orders.push(...pending.orders);
      for(const key of pending.keys) keys.add(key);
      entitlements.push(...pending.entitlements);
      return result;
    }
  };
  return {client,operations,orders,keys,entitlements};
}

test('purchaseDemo creates one order + unique key + entitlement atomically; retries return same order', async () => {
  const f=checkoutFixture();
  const repo=new MySqlCheckoutRepository(f.client);
  const first=await repo.purchaseDemo({userId,templateId,templateTitle:'Demo',grossAmount:100000});
  const again=await repo.purchaseDemo({userId,templateId,templateTitle:'Demo',grossAmount:100000});
  assert.equal(first.id,again.id);
  assert.equal(first.platformFee,20000);
  assert.equal(f.orders.length,1);
  assert.equal(f.entitlements.length,1);
  assert.equal(f.keys.size,1);
  assert.equal(await repo.hasLicense(userId,templateId),true);
  assert.equal((await repo.allForUser(userId)).length,1);
  assert(f.operations.some(([sql]) => sql.includes('INNER JOIN orders o ON o.id=e.order_id')));
  assert(f.operations.some(([sql]) => sql.includes('INSERT INTO demo_purchases')));
});

test('checkout service never grants paid rights when demo mode is disabled', async () => {
  const service=new CheckoutService({repository:{},config:{demoEnabled:false},catalog:{getTemplate(){throw Error('unreachable');}}});
  await assert.rejects(service.purchase({sub:userId},templateId),{status:503});
});

test('gift reply uses one SQL transaction and atomic increment, and rejects expired gifts', async () => {
  const giftId=randomUUID();
  let count=0, inserted=0, transactions=0;
  const client={async withTransaction(work){ transactions++;
    return work({execute:async(sql)=>{
      if(sql.includes('SELECT expires_at')) return [[{expires_at:'2030-01-01 00:00:00.000'}]];
      if(sql.includes('INSERT INTO gift_replies')) inserted++;
      if(sql.includes('reply_count=reply_count+1')) count++;
      return [{affectedRows:1}];
    }});
  }};
  const gifts=new MySqlGiftsRepository(client);
  const reply={id:randomUUID(),giftId,name:'Bạn',message:'Lời đáp',createdAt:'2026-11-17T00:00:00.000Z'};
  assert.deepEqual(await gifts.addReply(giftId,reply),reply);
  assert.equal(transactions,1);
  assert.equal(inserted,1);
  assert.equal(count,1);

  const expired = new MySqlGiftsRepository({async withTransaction(work) {
    return work({execute:async() => [[{expires_at:'2020-01-01 00:00:00.000'}]]});
  }});
  await assert.rejects(expired.addReply(giftId,reply),{status:410});
});

test('MySQL gifts/replies query by owner and gift with parameters, never load all users', async () => {
  const calls=[];
  const client={ async execute(sql,params=[]) {
    calls.push({sql,params});
    if(sql.includes('FROM gifts g WHERE g.user_id=?')) return [[{id:randomUUID(),slug:'a'.repeat(24),user_id:userId,
      template_id:'template',recipient_name:'Mai',sender_name:'An',message:'Hello',
      reply_count:0,created_at:'2026-11-17 00:00:00.000',expires_at:'2027-11-17 00:00:00.000',payload:'{}'}]];
    return [[]];
  }};
  const gifts=new MySqlGiftsRepository(client);
  const replies=new MySqlRepliesRepository(client);
  assert.equal((await gifts.allForUser(userId)).length,1);
  assert.deepEqual(await replies.allForGift('gift-id'),[]);
  assert(calls.every(c=>c.sql.includes('?')));
  assert.deepEqual(calls.map(call => call.params), [[userId], ['gift-id']]);
});
