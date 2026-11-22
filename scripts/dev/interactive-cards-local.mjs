// Explicit local-only disposable fixture. Never reads application .env or data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../../', import.meta.url));
const phase = process.argv[2] || 'final';
if (!['baseline','final'].includes(phase)) throw new Error('baseline or final only');
const directory = path.join(root, 'local/interactive-cards-20261122', phase);
fs.mkdirSync(directory, { recursive: true });
for (const item of ['src','web']) fs.cpSync(path.join(root,item),path.join(directory,item),{recursive:true});
fs.copyFileSync(path.join(root,'package.json'),path.join(directory,'package.json'));
if (!fs.existsSync(path.join(directory,'node_modules'))) fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),'junction');
Object.assign(process.env, { NODE_ENV:'test', IDENTITY_STORAGE:'json', CATALOG_STORAGE:'json', GIFTS_STORAGE:'json', CHECKOUT_STORAGE:'json', SUPPORT_STORAGE:'json', DESIGNS_STORAGE:'json', PAYMENT_ENABLED:'false', PAYMENT_LIVE_ENABLED:'false', CANVAS_READ_ENABLED:'true', CANVAS_EDIT_ENABLED:'true', CANVAS_PUBLISH_ENABLED:'true', TEST_ACCOUNT_ENABLED:'false' });
process.chdir(directory);
const { createHttpApp } = await import(pathToFileURL(path.join(directory,'src/server/app.mjs')));
const base = `http://127.0.0.1:${phase === 'baseline' ? 4118 : 4119}`;
const config = { baseUrl:base,jwtSecret:randomBytes(32).toString('hex'),internalKey:randomBytes(32).toString('hex'),demoEnabled:false,adminCode:'',giftTtlDays:365,googleId:'',googleSecret:'',zaloId:'',zaloSecret:'',testAccount:null };
const app = await createHttpApp(config);
await new Promise(resolve=>app.server.listen(Number(new URL(base).port),'127.0.0.1',resolve));
const email=`cards-${randomUUID()}@example.test`, password='LocalCardsFixture2026';
const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Momevia Cards QA',email,password,confirmPassword:password})});
if(response.status!==201)throw new Error(await response.text());
const cookie=response.headers.get('set-cookie').split(';')[0];
const request=async(route,body)=>{const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw new Error(JSON.stringify(v));return v;};
const catalog=(await request('/catalog/templates')).templates;
const inventory=[];
for(const t of catalog){
 const {design}=await request('/designs/designs',{source:{kind:'template',templateId:t.id},mutationId:randomUUID()});
 inventory.push({template:t,designId:design.id,hash:design.documentHash,version:design.source.templateVersionId,source:design.source,policy:design.policy,scenes:design.document.scenes.map(s=>s.id),assets:design.document.assets});
}
fs.writeFileSync(path.join(directory,'inventory.json'),JSON.stringify(inventory,null,2));
fs.writeFileSync(path.join(directory,'session.json'),JSON.stringify({base,email,password,cookie},null,2));
const { builtinLibraryItems }=await import(pathToFileURL(path.join(directory,'src/modules/designs/library.seed.mjs')));
const library=builtinLibraryItems();
fs.writeFileSync(path.join(directory,'library.json'),JSON.stringify(library,null,2));
console.log(JSON.stringify({base,storage:'isolated JSON',directory,templates:catalog.length,libraryItems:library.length,libraryHash:createHash('sha256').update(JSON.stringify(library)).digest('hex')}));
