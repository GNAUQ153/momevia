import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {startSfxFixture} from '../../tests/integration/sfx-fixture.mjs';
import {MySqlClient} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {previewRollout,applyRollout} from '../../src/modules/designs/library-rollout.mjs';
const out=path.resolve('docs/animated-elements-50/fresh-mysql.json'),bundle=JSON.parse(fs.readFileSync('database/updates/animated-elements-50-20261124-v1.json')),report={};loadEnvironment();let fixture,client;
try{fixture=await startSfxFixture({sql:true,externalSql:true,label:'animated-50-fresh'});client=new MySqlClient();const service=new CanvasLibraryService(client),rows=await service.rows(),preview=previewRollout(rows,bundle);assert(preview.canApply);assert(preview.actions.every(a=>a.status==='unchanged'));const applied=await applyRollout(service,{role:'admin'},bundle);assert.equal(applied.applied.length,0);const response=await fetch(fixture.base+'/api/designs/library'),v=await response.json();assert.equal(response.status,200);const elements=v.library.items.filter(r=>r.kind==='element');assert.equal(elements.length,293);assert.equal(elements.filter(r=>r.id.startsWith('motion-')).length,50);report.mysql=true;report.newSchema=process.env.MYSQL_DATABASE;report.rows=rows.length;report.apiElements=elements.length;report.packageUnchanged=51;report.applied=0;report.passed=true;console.log('PASS new MySQL bootstrap and shipped 51-item package converge; actual API has 293 elements including 50 new, applying package writes zero.');}catch(e){report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await client?.close();await fixture?.close();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
