import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews, selectHomeDemos } from '../../web/js/pages/home.js';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const source = read('../../web/js/features/marketing/hero-templates.js');
const styles = read('../../web/css/open-me-website.css');
const vi = JSON.parse(read('../../web/assets/locales/vi.json'));
const en = JSON.parse(read('../../web/assets/locales/en.json'));
const html = createHomeViews({state:{templates:[]},buttonLink:(url,label)=>`<a href="${url}">${label}</a>`,templateCard:()=>''}).home();

test('Hero has one featured card and five unique rotating samples without a pause button', () => {
  assert.equal((html.match(/data-template-preview/g)||[]).length, 1);
  assert.equal((html.match(/data-hero-image=/g)||[]).length, 5);
  assert.equal((html.match(/data-hero-progress/g)||[]).length,5);
  assert.equal((html.match(/data-active="true"/g)||[]).length,1);
  assert.doesNotMatch(html,/data-hero-playback|mkt-hero__playback/);
  assert.match(html, /data-i18n-aria-label/);
});

test('Create choices keep invitation/greeting routes and blank-card entry', () => {
  assert.match(html, /data-home-create aria-haspopup="dialog"/);
  assert.match(html, /aria-labelledby="home-create-title"/);
  for (const path of ['/explore?cardType=invitation','/explore?cardType=greeting','/design/new']) assert(html.includes(path));
  for (const key of ['home.openMe.create','home.openMe.browse','home.openMe.choose','home.openMe.invitation','home.openMe.greeting']) {
    assert(vi[key]?.trim());assert(en[key]?.trim());assert.notEqual(vi[key],en[key]);
  }
});

test('Catalog selection preserves server identity, type, price and Creator version', () => {
  const invitation={id:'approved-invitation',cardType:'invitation',versionId:'v7',price:12001};
  const greeting={id:'approved-greeting',cardType:'greeting',versionId:'v3',price:0};
  const unclassified={id:'creator-unclassified',cardType:'unspecified',price:0};
  assert.deepEqual(selectHomeDemos([unclassified,greeting,invitation]),[invitation,unclassified,greeting]);
  assert.equal(selectHomeDemos([unclassified,greeting,invitation])[0],invitation);
  const five=selectHomeDemos(Array.from({length:8},(_,i)=>({...greeting,id:'record-'+i})));
  assert.equal(five.length,5);assert.equal(new Set(five.map(t=>t.id)).size,5);
});

test('Classic rotating hero keeps teaser handoff, lifecycle and read-only preview contracts', () => {
  assert.doesNotMatch(source, /localStorage\.setItem|fetch\(|setInterval|setTimeout/);
  assert.match(source,/\.animate\(/);
  assert.match(source,/!dataPaused && !document\.hidden && visible && !dialog\.open/);
  assert.match(source,/preparePeek\(animation\)/);
  assert.match(source,/peek\.commitStyles\(\)/);
  assert.match(source,/observer\.disconnect\(\)/);
  assert.match(source, /get template\(\)/);
  assert.match(source, /updateTemplates/);
  assert.match(source, /opener\?\.isConnected/);
  assert.match(source, /lifetime\.abort/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /prefers-reduced-motion: no-preference/);
  assert.doesNotMatch(styles, /@import|fonts\.googleapis|cdn\./);
  assert.deepEqual(styles.split('\n').filter(line=>/;\s*[\w-]+\s*:/.test(line)),[]);
});
