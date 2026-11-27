import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {rememberCatalogMetadata} from '../../web/js/core/catalog-bootstrap.js';
import {templateCover} from '../../web/js/features/catalog/template-copy.js';
import {installLibrary,librarySnapshot} from '../../web/js/shared/canvas/library-state.js';

test('responsive covers defer all candidates, keep locale/revision in every URL and preserve SVG detail',()=>{
 const prior=librarySnapshot();
 try{
  rememberCatalogMetadata({templates:[]});installLibrary(null);
  for(const template of [{id:'afterglow',coverRevision:'revision-2'},{id:'birthday-radiance'}]){
   const html=templateCover(template,{responsive:true,defer:true});
   assert.match(html,/data-srcset=/);assert.doesNotMatch(html,/(?:^|\s)srcset=/);
   const sources=html.match(/data-srcset="([^"]+)"/)[1].replaceAll('&amp;','&').split(', ');
   assert.equal(sources.length,5);
   for(const source of sources){const[url,width]=source.split(' '),parsed=new URL(url,'http://localhost');
    assert.equal(parsed.searchParams.get('locale'),'vi');assert.equal(parsed.searchParams.get('variant'),'catalog');
    assert.equal(parsed.searchParams.get('width')+'w',width);assert.equal(parsed.searchParams.get('v'),template.coverRevision||'10');
   }
  }
  assert.doesNotMatch(templateCover({id:'afterglow',coverRevision:'revision-2'},{variant:'portrait'}),/srcset|width=/);
 }finally{rememberCatalogMetadata({templates:[]});installLibrary(prior);}
});
test('public cover metadata retains DB revisions without an editor library snapshot',()=>{
 try{rememberCatalogMetadata({templates:[{id:'birthday-radiance',coverRevision:'revision-123'}]});assert.match(templateCover('birthday-radiance'),/library\/templates\/birthday-radiance\/cover/);assert.match(templateCover('birthday-radiance'),/revision-123/);
 const deferred=templateCover({id:'birthday-radiance'},{defer:true});assert(deferred.startsWith('data-src='));assert.match(deferred,/data-cover-lazy/);rememberCatalogMetadata({templates:[]});assert.match(templateCover('birthday-radiance'),/assets\/basic-templates/);
 }finally{rememberCatalogMetadata({templates:[]});}
});
test('DB cover variant belongs to the image URL and survives localized attribute binding',()=>{
 const prior=librarySnapshot(),url=html=>new URL(html.match(/^(?:src|data-src)="([^"]+)"/)[1].replaceAll('&amp;','&'),'http://localhost');
 try{
  for(const variant of ['catalog','seasonal','portrait'])for(const defer of [false,true]){
   const html=templateCover({id:'afterglow',coverRevision:'revision-2'},{variant,defer}),u=url(html);
   assert.equal(u.searchParams.get('variant'),variant==='portrait'?null:variant);assert.equal(u.searchParams.get('v'),'revision-2');
   assert.match(html,variant==='portrait'?/templates.assets.databaseCover[^V]/:/templates.assets.databaseCoverVariant/);
  }
  rememberCatalogMetadata({templates:[{id:'afterglow',coverRevision:'from-catalog'}]});assert.equal(url(templateCover('afterglow')).searchParams.get('variant'),'catalog');
  rememberCatalogMetadata({templates:[]});installLibrary({revision:'from-library',items:[{kind:'template',id:'afterglow',status:'active'}]});assert.equal(url(templateCover('afterglow',{variant:'seasonal'})).searchParams.get('variant'),'seasonal');
 }finally{rememberCatalogMetadata({templates:[]});installLibrary(prior);}
});
test('self-hosted variable fonts retain exact approved binaries and all script fallbacks',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../web/assets/fonts/app/manifest.json',import.meta.url))),css=fs.readFileSync(new URL('../../web/css/app-fonts.css',import.meta.url),'utf8');const legacy=manifest.fonts.filter(font=>['Inter','Plus Jakarta Sans'].includes(font.family));assert.equal(legacy.length,11);
 for(const font of legacy){const bytes=fs.readFileSync(new URL('../../web/assets/fonts/app/'+font.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),font.sha256);assert.equal(font.weight,'400 800');assert(css.includes(font.file));}
 for(const family of ['Inter','Plus Jakarta Sans']){assert(css.indexOf(`/* ${family} / vietnamese */`)>css.indexOf(`/* ${family} / latin-ext */`));assert(css.includes(`/* ${family} / latin */`));}
});

function preloadFixture(t, { saveData = false, reducedData = false, locale = 'vi', search = '' } = {}) {
 const keys = ['navigator', 'matchMedia', 'location', 'localStorage', 'document'];
 const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 t.after(() => {
  for (const key of keys) {
   if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
   else delete globalThis[key];
  }
 });
 const links = [];
 const value = { endpoint: '/catalog/templates', data: { templates: [
  { id: 'birthday-radiance', systemOwned: true, coverRevision: 'rev-1' },
  { id: 'hai-phong-bi', systemOwned: true }
 ] } };
 const globals = {
  navigator: { connection: { saveData } },
  matchMedia: query => ({ matches: query === '(prefers-reduced-data: reduce)' && reducedData }),
  location: { pathname: '/explore', search },
  localStorage: { getItem: () => locale },
  document: {
   getElementById: () => ({ textContent: JSON.stringify(value) }),
   createElement: () => ({}), head: { append: link => links.push(link) },
  },
 };
 for (const [key, val] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: val });
 return links;
}

test('Không preload Catalog khi bật Save-Data', async t => {
 const links = preloadFixture(t, { saveData: true });
 const { startCatalogBootstrap } = await import('../../web/js/core/catalog-bootstrap.js');
 startCatalogBootstrap();
 assert.deepEqual(links, []);
});

test('Không preload Catalog khi bật reduced-data', async t => {
 const links = preloadFixture(t, { reducedData: true });
 const { startCatalogBootstrap } = await import('../../web/js/core/catalog-bootstrap.js');
 startCatalogBootstrap();
 assert.deepEqual(links, []);
});

test('Preload thông thường giữ hai ảnh responsive và locale tiếng Anh', async t => {
 const links = preloadFixture(t, { locale: 'en' });
 const { startCatalogBootstrap } = await import('../../web/js/core/catalog-bootstrap.js');
 startCatalogBootstrap();
 assert.equal(links.length, 2);
 for (const link of links) {
  assert.equal(link.rel, 'preload');
  assert.equal(link.as, 'image');
  assert.equal(link.fetchPriority, 'high');
  assert.match(link.href, /locale=en/);
  assert.equal(link.imageSrcset.split(', ').length, 5);
 }
});
