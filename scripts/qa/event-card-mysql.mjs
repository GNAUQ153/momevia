import { spawnSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { setTimeout as delay } from 'node:timers/promises';
const name = 'momevia-event-cards-qa-' + randomBytes(4).toString('hex');
const password = randomBytes(24).toString('hex');
const database = 'momevia_canvas_qa_event_cards';
const docker = args => {
  const r = spawnSync('docker', args, { encoding:'utf8',windowsHide:true });
  if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim();
};
try {
  docker(['run','-d','--rm','--name',name,'-p','127.0.0.1::3306','-e','MYSQL_ROOT_PASSWORD='+password,'-e','MYSQL_DATABASE='+database,'mysql:8.4']);
  const port = Number(docker(['port',name,'3306/tcp']).split(':').at(-1));
  let ready=false;
  for(let i=0;i<90;i++) { try {const c=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password,database});await c.end();ready=true;break;}catch{await delay(1000);} }
  if(!ready) throw new Error('Isolated MySQL did not become ready.');
  const child=spawn(process.execPath,['tests/integration/canvas-mysql.mjs'],{stdio:'inherit',windowsHide:true,env:{...process.env,
    CANVAS_QA_MYSQL_ISOLATED:'true',CANVAS_QA_MYSQL_DATABASE:database,CANVAS_QA_MYSQL_PORT:String(port),CANVAS_QA_MYSQL_USER:'root',CANVAS_QA_MYSQL_PASSWORD:password}});
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  if(code) throw new Error('MySQL checks failed: '+code);
  // Check the actual MySQL repository projection without rewriting old Catalog rows.
  const { MySqlTemplatesRepository }=await import('../../src/modules/catalog/mysql.repositories.mjs');
  const { CatalogService }=await import('../../src/modules/catalog/catalog.service.mjs');
  const fs=await import('node:fs');
  const baseline=JSON.parse(fs.readFileSync('tests/fixtures/event-cards-before.json'));
  const connection=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password,database});
  try {
    const repo=new MySqlTemplatesRepository({execute:(...args)=>connection.execute(...args)});
    const records=baseline.templates.filter(t=>['birthday-radiance','hai-phong-bi','proud-of-you'].includes(t.id));
    for(const record of records) await repo.insert(record);
    const before=JSON.stringify(await repo.all());
    const service=new CatalogService(repo,{});
    for(const [id,vi,en] of [['birthday-radiance','sinh nhật','birthday'],['hai-phong-bi','đám cưới','wedding'],['proud-of-you','tốt nghiệp','graduation']])
      for(const [locale,q] of [['vi',vi],['en',en]]) if(!(await service.search({q,locale})).some(t=>t.id===id)) throw new Error('MySQL occasion search: '+id+' '+locale);
    if(JSON.stringify(await repo.all())!==before) throw new Error('Projection wrote to MySQL');
    console.log('PASS Existing MySQL Catalog: VI/EN occasion search, exact stored rows unchanged.');
    const {MySqlClient}=await import('../../src/infrastructure/mysql/client.mjs');
    const {MySqlDesignsRepository}=await import('../../src/modules/designs/mysql.repository.mjs');
    const {MySqlPublicationUnitOfWork}=await import('../../src/modules/designs/mysql-publication.mjs');
    const {DesignsService}=await import('../../src/modules/designs/designs.service.mjs');
    const path=await import('node:path'),os=await import('node:os');
    const mediaRoot=fs.mkdtempSync(path.join(os.tmpdir(),'momevia-event-media-qa-'));
    const options={host:'127.0.0.1',port,user:'root',password,database,timezone:'Z',dateStrings:true};
    const client=new MySqlClient({env:{MYSQL_HOST:'127.0.0.1',MYSQL_PORT:String(port),MYSQL_DATABASE:database,MYSQL_USER:'root',MYSQL_PASSWORD:password},createPool:()=>mysql.createPool(options)});
    try {
      const user={sub:randomUUID(),role:'sender'};
      await connection.execute('INSERT INTO users(id,provider,provider_id,name,role,created_at,legacy_payload) VALUES (?,?,?,?,?,NOW(3),?)',[user.sub,'demo',user.sub,'Event media QA','sender','{}']);
      const repository=new MySqlDesignsRepository(client);await repository.ready();
      const designs=new DesignsService({repository,publication:new MySqlPublicationUnitOfWork(client),catalog:{getTemplate:id=>service.publicOne(id),reusableVersion:async()=>null},checkout:{hasLicense:async()=>false},orders:async()=>[],mediaRoot,config:{giftTtlDays:365},flags:{edit:true,publish:true,read:true},profile:{mode:'mysql',supported:true}});
      for(const record of records) {
        let {design}=await designs.create(user,{source:{kind:'template',templateId:record.id},mutationId:randomUUID()},{locale:'en'});
        if(design.document.assets.length!==1)throw new Error('Missing owned media');
        const asset=await repository.getAsset(user.sub,design.document.assets[0].assetId);
        if(!asset||!designs.assetExists(asset))throw new Error('Missing immutable photo bytes');
        for(const binding of Object.values(design.document.bindings))binding.value='Synthetic English event card';
        await designs.save(user,design.id,{title:design.title,expectedRevision:design.revision,mutationId:randomUUID(),document:design.document});
        design=await designs.get(user,design.id);
        const {gift}=await designs.publish(user,{designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()});
        const clean=(await designs.regift(user,gift,{mutationId:randomUUID()})).design;
        const cloned=await repository.getAsset(user.sub,clean.document.assets[0].assetId);
        if(cloned.contentHash!==asset.contentHash||cloned.id===asset.id)throw new Error('Regift did not own its artwork');
      }
      console.log('PASS MySQL: all 3 photographic templates create/save/publish/pin and regift known artwork through real transactions.');
    }finally{await client.close();fs.rmSync(mediaRoot,{recursive:true,force:true});}
  } finally {await connection.end();}
} finally { docker(['stop',name]); }
