import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { createMomoProvider, parsePayOsInquiry } from '../../src/modules/payments/providers.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';

const env = { PAYMENT_ENV: 'sandbox', NODE_ENV: 'development' };
const owner = { sub: 'buyer-1' };
const sample = { id: 'intent-1', orderId: 'order-1', code: '1001234567', amount: 25000,
  provider: 'momo', providerPaymentId: 'provider-1', checkoutUrl: 'https://test-payment.momo.vn/x',
  status: 'pending', isTest: true, createdAt: new Date().toISOString() };
const limiter = { calls: [], consume(key) { this.calls.push(key); return this.calls.length === 1; } };
const build = (partial = {}) => {
  const calls = [];
  const repository = {
    async forUser(id, user) { calls.push(['lookup', id, user]); return user === owner.sub ? { ...sample } : null; },
    async settleVerified(event) { calls.push(['settle', event]); return { settled: true }; },
    ...partial.repository,
  };
  const provider = { async queryStatus(){ return { state: 'pending' }; }, ...partial.provider };
  const service = new PaymentService({ repository, env: { ...env, ...partial.env },
    providers: { momo: provider }, reconcileLimiter: partial.limiter || limiter });
  return { service, repository, provider, calls };
};

test('reconcile checks owner before querying provider or consuming quota', async () => {
  const quota = { calls: 0, consume() { this.calls++; return true; } };
  const { service } = build({ limiter: quota, provider: { async queryStatus() { throw Error('must not call'); } } });
  await assert.rejects(service.reconcile({ sub: 'attacker' }, sample.orderId), { status: 404 });
  assert.equal(quota.calls, 0);
});

test('pending provider state leaves DB untouched and never releases checkout key', async () => {
  const { service, calls } = build({ limiter: { consume: () => true } });
  const result = await service.reconcile(owner, sample.orderId);
  assert.equal(result.payment.status, 'pending');
  assert.equal(result.providerState, 'pending');
  assert.equal(calls.some(x => x[0] === 'settle'), false);
  assert.equal(calls.some(x => x[0] === 'release'), false);
});

test('terminal provider state remains pending for manual review, no retry/unlock', async () => {
  const { service, calls } = build({ limiter: { consume: () => true },
    provider: { queryStatus: async () => ({ state: 'terminal_review' }) } });
  const result = await service.reconcile(owner, sample.orderId);
  assert.equal(result.payment.status, 'pending');
  assert.equal(result.providerState, 'terminal_review');
  assert.match(result.notice, /hỗ trợ/);
  assert.equal(calls.some(x => x[0] === 'settle'), false);
});

test('paid provider result is validated and settled through transactional repository', async () => {
  const { service, calls } = build({ limiter: { consume: () => true },
    provider: { queryStatus: async () => ({ state:'paid', provider:'momo',
      code: sample.code, amount:25000, currency:'VND', reference:'987654321' }) } });
  const result = await service.reconcile(owner, sample.orderId);
  assert.equal(result.providerState, 'paid');
  assert.deepEqual(calls.find(x => x[0] === 'settle')[1], {
    state:'paid', provider:'momo', code:sample.code, amount:25000,
    currency:'VND', reference:'987654321', success:true,
  });
});

test('mismatched amount/order/provider cannot grant any entitlement', async () => {
  for (const variation of [{ amount:24999 },{ code:'another' },{provider:'payos'}, { currency:'USD' },{ reference:'' }]) {
    const { service, calls } = build({ limiter: { consume: () => true },
      provider: { queryStatus: async () => ({ state:'paid', provider:'momo',
        code:sample.code, amount:25000, currency:'VND', reference:'987654321', ...variation }) } });
    await assert.rejects(service.reconcile(owner, sample.orderId), { status:502 });
    assert.equal(calls.some(x => x[0] === 'settle'), false);
  }
});

test('sandbox/live mismatch rejected even if provider credentials are present', async () => {
  const {service, calls}=build({env:{PAYMENT_ENV:'production'}, limiter:{consume:()=>true}});
  await assert.rejects(service.reconcile(owner, sample.orderId), {status:503});
  assert.equal(calls.some(x=>x[0]==='settle'), false);
});

test('reconciliation is throttled per buyer/order after ownership check', async () => {
  const quota = { count:0, consume(){return ++this.count === 1;} };
  const { service } = build({limiter:quota});
  await service.reconcile(owner, sample.orderId);
  await assert.rejects(service.reconcile(owner, sample.orderId),{status:429});
});

test('payOS check never treats partial/cancelled as paid or accepts wrong link ID', () => {
  const params = {code:'1001234567', amount:25000, providerPaymentId:'link-123'};
  const base = {id:'link-123',orderCode:1001234567, amount:25000, amountPaid:25000,status:'PAID'};
  assert.deepEqual(parsePayOsInquiry(base, params), {
    state:'paid',provider:'payos',code:params.code,amount:25000,currency:'VND',reference:'link-123',
  });
  assert.deepEqual(parsePayOsInquiry({...base, status:'CANCELLED'},params),{state:'terminal_review'});
  assert.deepEqual(parsePayOsInquiry({...base, status:'PENDING',amountPaid:5000},params),{state:'pending'});
  for (const mutation of [{amountPaid:1000},{amount:24000},{orderCode:999},{id:'wrong'}])
    assert.throws(() => parsePayOsInquiry({...base,...mutation}, params),{status:502});
});

test('MoMo signed query uses official request format and checks response correlation', async () => {
  let expectedCode=0, amount=25000;
  const fakeFetch = async(url, opts) => {
    const body=JSON.parse(opts.body);
    assert.equal(url,'https://test-payment.momo.vn/v2/gateway/api/query');
    const raw=`accessKey=accesskey&orderId=1001234567&partnerCode=MOMO_TEST&requestId=${body.requestId}`;
    assert.equal(body.signature, createHmac('sha256','secretkey').update(raw).digest('hex'));
    return {ok:true,json:async()=>({partnerCode:'MOMO_TEST',requestId:body.requestId,
      orderId:'1001234567',amount,transId:1122334455,resultCode:expectedCode})};
  };
  const momo=createMomoProvider({PAYMENT_ENV:'sandbox',MOMO_PARTNER_CODE:'MOMO_TEST',
    MOMO_ACCESS_KEY:'accesskey',MOMO_SECRET_KEY:'secretkey'},fakeFetch);
  const args={code:'1001234567',amount:25000};
  assert.equal((await momo.queryStatus(args)).state,'paid');
  expectedCode=9000;
  assert.deepEqual(await momo.queryStatus(args),{state:'pending'});
  expectedCode=1006;
  assert.deepEqual(await momo.queryStatus(args),{state:'terminal_review'});
  expectedCode=0;amount=24000;
  await assert.rejects(momo.queryStatus(args),{status:502});
});

test('repository lookup remains scoped to order owner and exposes original test mode',async()=>{
  const sqls=[];
  const repo = new MySqlPaymentRepository({execute:async(sql,params)=>{
    sqls.push([sql,params]);
    return [[{id:'intent-1',order_id:'order-1',provider_order_code:'123',provider:'momo',
      amount_vnd:25000,status:'pending',is_test:1}]];
  }});
  const item=await repo.forUser('order-1','buyer-1');
  assert.equal(item.isTest,true);
  assert.match(sqls[0][0],/o\.user_id=\?/);
  assert.deepEqual(sqls[0][1],['order-1','buyer-1']);
});
