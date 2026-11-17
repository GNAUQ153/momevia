import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { PaymentService, paymentMethods } from '../../src/modules/payments/payment.service.mjs';
import { createMomoProvider } from '../../src/modules/payments/providers.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';

const env = {
  PAYMENT_ENABLED:'true', PAYMENT_ENV:'sandbox', PUBLIC_BASE_URL:'https://testing.example.com',
  CHECKOUT_STORAGE:'mysql', IDENTITY_STORAGE:'mysql', CATALOG_STORAGE:'mysql',
  MOMO_PARTNER_CODE:'MOMOX', MOMO_ACCESS_KEY:'accesskey', MOMO_SECRET_KEY:'secretkey',
};
const buyer={sub:'user-123'};
const providers={momo:{async create(){return {checkoutUrl:'https://test-payment.momo.vn/gateway/abc',qrPayload:'',providerPaymentId:'some-id'};}}};
function fixture(repo, cfg=env, checkout={hasLicense:async()=>false}){
  return new PaymentService({repository:repo, env:cfg, providers, checkout,
    catalog:{getTemplate:async()=>({id:'template-1',title:'Mẫu sinh nhật',price:25000})}});
}

test('disabled payments never expose online payment methods',()=>{
  assert.deepEqual(paymentMethods({...env,PAYMENT_ENABLED:'false'}),[]);
  assert.deepEqual(paymentMethods({...env, NODE_ENV:'production'}),[]);
});

test('v1.1 enforces MySQL mode, HTTPS public callbacks and license ownership', async()=>{
  const svc=fixture({});
  assert.deepEqual(svc.methods(),[{id:'momo',label:'Ví MoMo'}]);
  await assert.rejects(fixture({}, {...env,PUBLIC_BASE_URL:'http://localhost:4100'}).create(buyer,'template-1','momo'),{status:503});
  await assert.rejects(fixture({}, {...env,CHECKOUT_STORAGE:'json'}).create(buyer,'template-1','momo'),{status:503});
  await assert.rejects(fixture({},env,{hasLicense:async()=>true}).create(buyer,'template-1','momo'),{status:409});
  await assert.rejects(fixture({},env).create(buyer,'template-1','payos'),{status:503});
});

test('create returns PENDING link without giving access before a verified webhook', async()=>{
  let granted=false;
  const calls=[];
  const repo={
    async createPending(q){calls.push(q);return {id:'intent',orderId:'ord',code:'1000012345',provider:q.provider,amount:q.amount,status:'pending'};},
    async setLink(id,link){ calls.push({id,link}); },
  };
  const result=await fixture(repo).create(buyer,'template-1','momo');
  assert.equal(result.status,'pending');
  assert.equal(result.orderId,'ord');
  assert.equal(result.checkoutUrl,'https://test-payment.momo.vn/gateway/abc');
  assert.equal(calls[0].userId,buyer.sub);
  assert.equal(calls[0].amount,25000);
  assert.equal(granted,false);
});

test('MoMo provider produces valid request signature and checks signed IPN; rejects forgery', async()=>{
  let captured;
  const provider=createMomoProvider(env, async(url,options)=>{
    captured={url,body:JSON.parse(options.body)};
    return {ok:true,async json(){return {resultCode:0,payUrl:'https://test-payment.momo.vn/gateway/abc'};}};
  });
  const start=await provider.create({code:'1000012345',amount:25000,description:'MOMEVIA 1000012345',
    returnUrl:'https://testing.example.com/result',ipnUrl:'https://testing.example.com/ipn'});
  assert.match(start.checkoutUrl,/^https:/);
  assert.equal(captured.body.requestType,'captureWallet');
  assert.equal(captured.body.amount,25000);
  assert.equal(captured.url,'https://test-payment.momo.vn/v2/gateway/api/create');

  const body={partnerCode:'MOMOX',orderId:'1000012345',requestId:'1000012345',amount:25000,
    extraData:'',message:'Successful.',orderInfo:'MOMEVIA 1000012345',orderType:'momo_wallet',
    payType:'qr',responseTime:1700000000000,resultCode:0,transId:123456789};
  const raw=['accessKey=accesskey','amount=25000','extraData=','message=Successful.',
    'orderId=1000012345','orderInfo=MOMEVIA 1000012345','orderType=momo_wallet',
    'partnerCode=MOMOX','payType=qr','requestId=1000012345','responseTime=1700000000000',
    'resultCode=0','transId=123456789'].join('&');
  const signed={...body,signature:createHmac('sha256','secretkey').update(raw).digest('hex')};
  assert.deepEqual(await provider.verifyWebhook(signed),{
    provider:'momo',code:'1000012345',amount:25000,reference:'123456789',currency:'VND',success:true,
  });
  await assert.rejects(provider.verifyWebhook({...signed,amount:2000}),{status:400});
  await assert.rejects(provider.verifyWebhook({...signed,signature:'0'.repeat(64)}),{status:400});
});

test('repository issues a single verified entitlement + receipt inside ONE transaction', async()=>{
  const events=[]; let paid=false;
  const client={
    async withTransaction(work){
      const operations=[];
      const tx={execute:async(sql,params=[])=>{
        operations.push([sql,params]);
        if(sql.includes('FROM payment_intents p JOIN orders o'))
          return [[{id:'intent',order_id:'order',provider:'momo',provider_order_code:'x',
            amount_vnd:25000,status:paid?'paid':'pending',order_status:paid?'paid':'pending_payment',
            user_id:'user',template_id:'template',is_test:1}]];
        return [{affectedRows:1}];
      }};
      const outcome=await work(tx);
      if(!outcome.replay) {events.push(...operations);paid=true;}
      return outcome;
    },
  };
  const repo=new MySqlPaymentRepository(client);
  const event={provider:'momo',code:'x',reference:'provider-txn-42',amount:25000,currency:'VND',success:true};
  const first=await repo.settleVerified(event);
  const replay=await repo.settleVerified(event);
  assert.equal(first.replay,false);
  assert.equal(replay.replay,true);
  assert.equal(events.filter(([sql])=>sql.includes('INSERT INTO template_entitlements')).length,1);
  assert.equal(events.filter(([sql])=>sql.includes('INSERT INTO payment_receipts')).length,1);
  assert.equal(events.filter(([sql])=>sql.includes('INSERT INTO payment_events')).length,1);
  assert.equal(events.filter(([sql])=>sql.includes('UPDATE orders SET status')).length,1);
});

test('amount mismatch rejects BEFORE any payment state or entitlement change',async()=>{
  const statements=[];
  const client={async withTransaction(work){return work({execute:async(sql)=>{
    statements.push(sql);
    if(sql.includes('FROM payment_intents p JOIN orders o')) return [[{id:'x',amount_vnd:25000,status:'pending',order_status:'pending_payment'}]];
    throw Error('must not write');
  }});}};
  await assert.rejects(new MySqlPaymentRepository(client).settleVerified({
    provider:'momo',code:'123',reference:'ref',amount:23000,currency:'VND',success:true,
  }),{status:400});
  assert.equal(statements.length,1);
});

test('only owner can read receipt and source never accepts client-paid flag', async()=>{
  const queries=[];
  const client={async execute(sql,params){queries.push({sql,params});return [[]];}};
  const repo=new MySqlPaymentRepository(client);
  assert.equal(await repo.receipt('order','owner'),null);
  assert.match(queries[0].sql,/o\.user_id=\?/);
  const code=fs.readFileSync(new URL('../../src/modules/payments/routes.mjs',import.meta.url),'utf8');
  assert.match(code,/verifyWebhook|service\.webhook/);
  assert.doesNotMatch(code,/body\.status\s*===\s*['"]paid/);
});

test('migration adds unique checkout key and receipt, without altering demo payment ledger',()=>{
  const schema=fs.readFileSync(new URL('../../database/migrations/005_payment_receipts.sql',import.meta.url),'utf8');
  for(const name of ['payment_intents','payment_checkout_keys','payment_receipts','ENGINE=InnoDB'])
    assert(schema.includes(name),name);
  assert.match(schema,/PRIMARY KEY \(user_id, template_id\)/);
  assert.match(schema,/UNIQUE KEY payment_intents_order_uk/);
});
