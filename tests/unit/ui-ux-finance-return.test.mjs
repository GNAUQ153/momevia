import test from 'node:test';
import assert from 'node:assert/strict';
import {moneyText, priceText} from '../../web/js/core/i18n.js';
import {creatorFinancePanel} from '../../web/js/pages/creator.js';
import {adminFinancePanel, paymentReviewRows, adminReconciliationPanel} from '../../web/js/pages/admin-payments.js';
import {authDestination, rememberAuthReturn, takeAuthReturn} from '../../web/js/core/auth-return.js';
import {createPaymentActions} from '../../web/js/app/payment-actions.js';

test('Financial amounts distinguish zero, finite amounts and unavailable data without changing product pricing',()=>{
  for(const value of [0,'0',59000,-1200]){
    assert.doesNotMatch(moneyText(value),/Miễn phí|NaN/);
    assert.match(moneyText(value),/₫/);
  }
  for(const value of [null,undefined,'',' ',NaN,Infinity,{},false,'invalid']){
    assert.match(moneyText(value),/Chưa có dữ liệu/);
    assert.doesNotMatch(moneyText(value),/₫|Miễn phí|NaN/);
  }
  assert.match(priceText(0),/Miễn phí/);
  const group={orders:0,grossVnd:0,platformFeeVnd:0,creatorVnd:0};
  for(const render of [creatorFinancePanel,adminFinancePanel]){
    assert.doesNotMatch(render({summary:{live:group,sandbox:group},recent:[{creatorVnd:0}]}),/Miễn phí/);
    assert.match(render({summary:{live:{...group,grossVnd:null},sandbox:group}}),/Chưa có dữ liệu/);
    assert.match(render(null),/role="status"/);
  }
  assert.doesNotMatch(paymentReviewRows([{orderId:'order',amountVnd:0}]),/Miễn phí/);
  assert.match(paymentReviewRows([{orderId:'order',amountVnd:null}]),/Chưa có dữ liệu/);
  assert.match(adminReconciliationPanel({scanLimit:100,records:[{orderId:'order',amountVnd:null}]}),/Chưa có dữ liệu/);
});

test('Payment auth return accepts only the existing local order route and retains old destinations',()=>{
  const previous=globalThis.location;
  globalThis.location=new URL('https://momevia.example/payment-result/order-1');
  try{
    for(const route of ['/payment-result/order-1','/create/birthday-radiance?mode=quick&version=v2','/design/draft_1?mode=layout','/favorites','/explore?q=Birthday&page=2','/success/gift-1']){
      assert.equal(authDestination(route),route);
      rememberAuthReturn(route);assert.deepEqual(takeAuthReturn(),{path:route,favoriteId:null});assert.equal(takeAuthReturn(),null);
    }
    for(const route of ['https://evil.test/payment-result/order-1','//evil.test/payment-result/order-1','/\\evil.test/payment-result/order-1','/payment-result','/payment-result/','/payment-result/a/b','/payment-result/%2e%2e','/payment-result/a?context=x','/payment-result/a?x=1&x=2','/payment-result/a?mode=quick','/payment-result/a#paid','/payment-result/a\n'])assert.equal(authDestination(route),null,route);
  }finally{globalThis.location=previous;}
});

test('Payment sign-in remembers the actual route through the shared guarded login action',async()=>{
  const previous=globalThis.location,calls=[];
  globalThis.location=new URL('https://momevia.example/payment-result/order-1');
  try{
    const actions=createPaymentActions({requireLogin:path=>{calls.push(path);return false;}});
    await actions.find(([names])=>names.includes('payment-login'))[1]();
    assert.deepEqual(calls,['/payment-result/order-1']);
  }finally{globalThis.location=previous;}
});
