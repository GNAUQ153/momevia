import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFeaturedTemplates} from '../../web/js/features/marketing/featured-carousel.js';

test('Featured pool caps 15 unique real records and preserves Creator version and server price',()=>{
  const records=Array.from({length:24},(_,i)=>({id:`sample-${i}`,title:`Thiệp ${i}`,price:i*1000,versionId:`approved-v${i}`,featured:i===7}));
  const before=structuredClone(records),result=selectFeaturedTemplates([...records,records[0]],'2026-11-26');
  assert.equal(result.length,15);assert.equal(new Set(result.map(t=>t.id)).size,15);
  assert(result.every(t=>records.includes(t)));assert(result.includes(records[7]));
  assert.equal(result.find(t=>t.id==='sample-7').versionId,'approved-v7');assert.equal(result.find(t=>t.id==='sample-7').price,7000);
  assert.deepEqual(records,before);
});

test('Existing system showcase order remains first, with seasonal recommendations filling the pool',()=>{
  const system=id=>({id,systemOwned:true,creator:'Momevia Originals'});
  const season={id:'season',isSeasonal:true,availableFrom:'2026-11-01',availableTo:'2026-12-31'};
  const result=selectFeaturedTemplates([season,system('proud-of-you'),system('hai-phong-bi'),system('birthday-radiance')],'2026-11-26');
  assert.deepEqual(result.map(t=>t.id),['birthday-radiance','hai-phong-bi','proud-of-you','season']);
});

test('Empty and small catalogs never invent or duplicate cards to reach fifteen',()=>{
  assert.deepEqual(selectFeaturedTemplates([]),[]);
  const one={id:'only-card',price:0};assert.deepEqual(selectFeaturedTemplates([one,one]),[one]);
});
