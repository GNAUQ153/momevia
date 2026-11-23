import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { randomBytes,randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { resolveMysqlConfig } from '../../src/infrastructure/mysql/client.mjs';

export async function startSfxFixture({sql=false,externalSql=false,port=0,label='run',baseline=false,baselineCommit='34f4e52930231dfbff9e2d9dda9f65b99cbb11ed'}={}){
 const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'local/sfx-qa',`${label}-${Date.now()}`),previousCwd=process.cwd(),previousEnv={...process.env};
 fs.mkdirSync(directory,{recursive:true});
 for(const item of ['src','web','services'])fs.cpSync(path.join(root,item),path.join(directory,item),{recursive:true,filter:p=>path.basename(p)!=='data'});
 fs.copyFileSync(path.join(root,'package.json'),path.join(directory,'package.json'));fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),'junction');
 if(baseline){
  // Reconstruct tracked owning sources from the verified optimization commit.
  assertBaseline(baselineCommit);
  const originalFiles=new Set(execFileSync('git',['ls-tree','-r','--name-only',baselineCommit,'--','src','web'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean));
  const changed=execFileSync('git',['diff','--name-only',baselineCommit,'--','src','web'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  for(const file of changed){
   const target=path.resolve(directory,file);if(!target.startsWith(directory+path.sep))throw new Error('Baseline path escapes its fixture.');
   if(!originalFiles.has(file)){if(fs.existsSync(target))fs.unlinkSync(target);continue;}
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,execFileSync('git',['show',`${baselineCommit}:${file}`],{cwd:root,maxBuffer:16*1024*1024}));
  }
  fs.mkdirSync(path.join(directory,'scripts/build'),{recursive:true});fs.copyFileSync(path.join(root,'scripts/build/client-bundles.mjs'),path.join(directory,'scripts/build/client-bundles.mjs'));
  const {buildClientBundles}=await import(pathToFileURL(path.join(directory,'scripts/build/client-bundles.mjs')));await buildClientBundles();
 }
 const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
 let container,connection,app,externalDatabase;
 try{
  Object.assign(process.env,{NODE_ENV:'test',IDENTITY_STORAGE:sql?'mysql':'json',CATALOG_STORAGE:sql?'mysql':'json',GIFTS_STORAGE:sql?'mysql':'json',CHECKOUT_STORAGE:sql?'mysql':'json',SUPPORT_STORAGE:sql?'mysql':'json',DESIGNS_STORAGE:sql?'mysql':'json',PAYMENT_ENABLED:'false',PAYMENT_LIVE_ENABLED:'false',TEST_ACCOUNT_ENABLED:'false',CANVAS_READ_ENABLED:'true',CANVAS_EDIT_ENABLED:'true',CANVAS_PUBLISH_ENABLED:'true',SFX_CREATE_ENABLED:'true'});
  if(sql&&externalSql){
   const config=resolveMysqlConfig(previousEnv);
   if(!['127.0.0.1','localhost','::1'].includes(config.host))throw new Error('External QA only permits an existing local MySQL server.');
   connection=await mysql.createConnection({...config,multipleStatements:true,dateStrings:true,timezone:'Z'});
   externalDatabase='momevia_canvas_qa_music_'+randomBytes(6).toString('hex');
   await connection.query(`CREATE DATABASE \`${externalDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
   await connection.changeUser({database:externalDatabase});
   for(const name of fs.readdirSync(path.join(root,'database/migrations')).filter(n=>n.endsWith('.sql')).sort())await connection.query(fs.readFileSync(path.join(root,'database/migrations',name),'utf8'));
   Object.assign(process.env,{MYSQL_DATABASE:externalDatabase});
   fs.writeFileSync(path.join(directory,'mysql-isolation.json'),JSON.stringify({database:externalDatabase,localServer:true,docker:false}));
  }else if(sql){
   const password=randomBytes(24).toString('hex');container='momevia-canvas-qa-sfx-'+randomBytes(5).toString('hex');
   docker(['run','-d','--rm','--name',container,'--label','momevia.qa=canvas-20261117','-p','127.0.0.1::3306','-e','MYSQL_ROOT_PASSWORD='+password,'mysql:8.4']);
   const mysqlPort=Number(docker(['port',container,'3306/tcp']).split(':').at(-1));
   for(let i=0;i<60;i++){try{connection=await mysql.createConnection({host:'127.0.0.1',port:mysqlPort,user:'root',password,multipleStatements:true,dateStrings:true,timezone:'Z'});break;}catch{await new Promise(r=>setTimeout(r,1000));}}
   if(!connection)throw new Error('Isolated MySQL startup failed');
   const database='momevia_canvas_qa_sfx_'+randomBytes(5).toString('hex');await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);await connection.changeUser({database});
   for(const name of fs.readdirSync(path.join(root,'database/migrations')).filter(n=>n.endsWith('.sql')).sort())await connection.query(fs.readFileSync(path.join(root,'database/migrations',name),'utf8'));
   Object.assign(process.env,{MYSQL_HOST:'127.0.0.1',MYSQL_PORT:String(mysqlPort),MYSQL_DATABASE:database,MYSQL_USER:'root',MYSQL_PASSWORD:password});
   fs.writeFileSync(path.join(directory,'mysql-private.json'),JSON.stringify({container,database,password,mysqlPort}));
  }
  process.chdir(directory);
  const {createHttpApp}=await import(pathToFileURL(path.join(directory,'src/server/app.mjs')));
  const config={baseUrl:'http://127.0.0.1',jwtSecret:randomBytes(32).toString('hex'),internalKey:randomBytes(32).toString('hex'),demoEnabled:false,adminCode:'',giftTtlDays:365,testAccount:null,googleId:'',googleSecret:'',zaloId:'',zaloSecret:''};
  app=await createHttpApp(config);await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${app.server.address().port}`;config.baseUrl=base;
  async function request(route,{cookie,body,bytes,method,headers={}}={}){
   const res=await fetch(base+'/api'+route,{method:method||(body||bytes?'POST':'GET'),headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...headers},body:bytes||(body?JSON.stringify(body):undefined)});
   const dataBytes=Buffer.from(await res.arrayBuffer());let data;try{data=JSON.parse(dataBytes);}catch{/* media */}return {status:res.status,data,bytes:dataBytes,headers:res.headers};
  }
  async function register(name){const email=`${randomUUID()}@example.test`,password='SfxLocalFixture2026',r=await request('/auth/register',{body:{name,email,password,confirmPassword:password}});if(r.status!==201)throw new Error(JSON.stringify(r.data));return {user:r.data.user,cookie:r.headers.get('set-cookie').split(';')[0],email,password};}
  const dropExternal=async()=>{if(externalDatabase){if(!/^momevia_canvas_qa_music_[a-f0-9]{12}$/.test(externalDatabase))throw new Error('Unsafe QA database name.');await connection.query(`DROP DATABASE \`${externalDatabase}\``);}};
  return {app,base,directory,request,register,connection,container,async close(){await new Promise(resolve=>app.server.close(resolve));await app.close();await dropExternal();await connection?.end();if(container)docker(['stop',container]);process.chdir(previousCwd);for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];Object.assign(process.env,previousEnv);}};
 }catch(error){if(app){app.server.close();await app.close();}if(externalDatabase&&/^momevia_canvas_qa_music_[a-f0-9]{12}$/.test(externalDatabase)&&connection)await connection.query(`DROP DATABASE \`${externalDatabase}\``).catch(()=>{});await connection?.end();if(container)docker(['stop',container]);process.chdir(previousCwd);throw error;}
}
function assertBaseline(value){if(!/^[a-f0-9]{40}$/.test(value))throw new Error('Verified full baseline commit required.');}
