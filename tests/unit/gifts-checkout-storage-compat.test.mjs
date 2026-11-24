import test from 'node:test';
import assert from 'node:assert/strict';
import { GiftService } from '../../src/modules/gifts/gifts.service.mjs';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';

const user={sub:'user-test-1'};
const template={id:'free', title:'Free card', theme:'rose', price:0};
const paid={id:'paid',title:'Paid demo',theme:'sky',price:59000};
const catalog={async getTemplate(id){ return id==='paid' ? paid : template; }};

function jsonStore() {
  const gifts=[],replies=[];
  return {
    gifts:{all:()=>gifts,insert(item){gifts.push(item);return item;},update(id,patch){
      return Object.assign(gifts.find(item=>item.id===id),patch);
    }},
    replies:{all:()=>replies,insert(item){replies.push(item);return item;}},
  };
}

test('JSON Gifts remains compatible after asynchronous MySQL adapter conversion', async () => {
  const {gifts,replies}=jsonStore();
  const service=new GiftService({giftsRepo:gifts,repliesRepo:replies,
    media:{store(){throw Error('unexpected photo write');}},
    repliesLimit:{consume(){return true;}},catalog,checkout:{async hasLicense(){return false;}},
    config:{giftTtlDays:365}});
  const created=await service.create(user,{templateId:'free',recipientName:'Mai',senderName:'An',message:'A card',access:{open:'link',send:'link',read:'link'}});
  assert.equal(created.userId,user.sub);
  assert.equal((await service.mine(user)).length,1);
  assert.equal((await service.publicGift(created.slug)).userId,undefined);
  assert.equal((await service.replies(created.slug)).length,0);
  await service.reply(created.slug,{message:'Thanks'},'127.0.0.1');
  assert.equal((await service.replies(created.slug)).length,1);
  assert.equal((await service.publicGift(created.slug)).replyCount,1);
  await assert.rejects(service.create(user,{templateId:'paid',recipientName:'Mai',senderName:'An',message:'Paid'}),{status:402});
});

test('JSON Checkout preserves free templates and duplicate demo purchase idempotency', async () => {
  const orders=[];
  const repo={all:()=>orders,insert(item){orders.push(item);return item;}};
  const service=new CheckoutService({repository:repo,config:{demoEnabled:true,demoTemplateCheckout:true},env:{NODE_ENV:"test"},catalog});
  assert.equal((await service.purchase(user,'free')).status,'free');
  const first=await service.purchase(user,'paid');
  const second=await service.purchase(user,'paid');
  assert.equal(first.id,second.id);
  assert.equal((await service.orders(user)).length,1);
  assert.equal(await service.hasLicense(user.sub,'paid'),true);
});
