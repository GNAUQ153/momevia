import test from 'node:test';
import assert from 'node:assert/strict';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { PRIORITY_TEMPLATE_IDS, prioritizeTemplates } from '../../web/js/shared/template-order.js';
import { createHomeViews } from '../../web/js/pages/home.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { filterTemplates, paginateTemplates } from '../../web/js/features/catalog/filter.js';

test('prioritize three system event cards without mutating records or changing the relative order of other templates', () => {
  const input=structuredClone(templates).reverse(),before=structuredClone(input);
  const sorted=prioritizeTemplates(input);
  assert.deepEqual(sorted.slice(0,3).map(t=>t.id),PRIORITY_TEMPLATE_IDS);
  assert.deepEqual(sorted.slice(3),input.filter(t=>!PRIORITY_TEMPLATE_IDS.includes(t.id)));
  assert.deepEqual(input,before);
  assert.equal(new Set(sorted.map(t=>t.id)).size,input.length);
  const creator={id:'birthday-radiance',creator:'Another creator',creatorId:'person'};
  const version={id:'hai-phong-bi',systemOwned:true,versionId:'creator-version'};
  assert.deepEqual(prioritizeTemplates([{id:'first'},creator,version]),[{id:'first'},creator,version]);
});

test('Catalog API applies priority to existing published records, preserving prices and hidden status', async () => {
  const records=structuredClone(templates).reverse();records.find(t=>t.id==='birthday-radiance').price=12345;
  const before=structuredClone(records),service=new CatalogService({all:async()=>records},{});
  const publicList=await service.publicList();
  assert.deepEqual(publicList.slice(0,3).map(t=>t.id),PRIORITY_TEMPLATE_IDS);
  assert.equal(publicList[0].price,12345);assert.deepEqual(records,before);
  records.find(t=>t.id==='hai-phong-bi').status='pending';
  const visible=await service.publicList();
  assert.deepEqual(visible.slice(0,2).map(t=>t.id),['birthday-radiance','proud-of-you']);
  assert(!visible.some(t=>t.id==='hai-phong-bi'));
});

test('priority works before pagination and respects search, free-only and photo-only filters', () => {
  const rows=templates.map(t=>({...t,systemOwned:true,personalization:{photoFrames:PRIORITY_TEMPLATE_IDS.includes(t.id)?3:0}}));
  const ordered=prioritizeTemplates(filterTemplates(rows,{freeOnly:true,photoOnly:true}));
  assert.deepEqual(paginateTemplates(ordered,1).items.map(t=>t.id),PRIORITY_TEMPLATE_IDS);
  const wedding=prioritizeTemplates(filterTemplates(rows,{search:'đám cưới'}));
  assert.deepEqual(wedding.map(t=>t.id),['hai-phong-bi', 'loi-moi-ben-hien', 'sealed-garden', 'polaroid-love', 'moonlit-promise', 'golden-blossom']);
  assert.deepEqual(prioritizeTemplates(filterTemplates(rows,{search:'no matching template'})),[]);
});

test('home recommendations and first catalog page show the three event cards before the seasonal collection', () => {
  const state={templates:templates.map(t=>({...t,systemOwned:true})),filter:'all',search:'',freeOnly:false,photoOnly:false,catalogPage:1,favorites:new Set()};
  const chosen=[];
  const home=createHomeViews({state,templateCard:t=>{chosen.push(t.id);return `<article>${t.id}</article>`;}});
  home.featuredGifts('ready');assert.equal(chosen.length,15);assert.equal(new Set(chosen).size,15);assert.deepEqual(chosen.slice(0,3),PRIORITY_TEMPLATE_IDS);
  const catalog=createCatalogViews({state,templateCard:t=>`<article data-template-id="${t.id}"></article>`,paginationMarkup:()=>'',buttonLink:()=>'',artwork:()=>'',favoriteButton:()=>''});
  const html=catalog.explore();
  assert.deepEqual([...html.matchAll(/data-template-id="([^"]+)"/g)].slice(0,3).map(m=>m[1]),PRIORITY_TEMPLATE_IDS);
  assert(html.indexOf('id="catalog-grid"')<html.indexOf('class="seasonal-shelf"'));
});
