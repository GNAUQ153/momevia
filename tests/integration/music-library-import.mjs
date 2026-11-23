import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { loadEnvironment } from '../../src/shared/config.mjs';
import { resolveMysqlConfig } from '../../src/infrastructure/mysql/client.mjs';
import { readCanvasSnapshot, planCanvasImport, applyCanvasImport, verifyCanvasImport } from '../../database/scripts/import-canvas-json.mjs';
import { MusicLibraryService } from '../../src/modules/designs/music-library.service.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),source=path.resolve(process.argv[2]||'');
assert(source.startsWith(path.join(root,'local/sfx-qa/music-json-')),'An isolated Music Library JSON fixture must be explicitly supplied.');
loadEnvironment();const config=resolveMysqlConfig();assert(['localhost','127.0.0.1','::1'].includes(config.host));
const connection=await mysql.createConnection({...config,multipleStatements:true});
const database='momevia_canvas_qa_music_'+randomBytes(6).toString('hex');
let created=false;
try {
 await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;await connection.changeUser({database});
 for(const name of fs.readdirSync(path.join(root,'database/migrations')).filter(name=>name.endsWith('.sql')).sort())await connection.query(fs.readFileSync(path.join(root,'database/migrations',name),'utf8'));
 const execute=(sql,params=[])=>connection.execute(sql,params);
 const client={execute,async withTransaction(work){await connection.beginTransaction();try{const result=await work({execute});await connection.commit();return result;}catch(error){await connection.rollback();throw error;}}};
 const plan=planCanvasImport(readCanvasSnapshot(source));assert(plan.snapshot.audioLibrary.items.length>0);assert(plan.snapshot.audioLibrary.history.length>0);
 await applyCanvasImport(plan,client,{label:'Isolated music curation import regression'});await verifyCanvasImport(plan,client);
 const library=new MusicLibraryService(client);await library.ready();const actual=await library.list();
 for(const expected of plan.snapshot.audioLibrary.items){const row=actual.items.find(item=>item.key===expected.key);assert.equal(row.revision,expected.revision);assert.deepEqual(row.title,expected.title);assert.equal(row.status,expected.status);}
 await assert.rejects(applyCanvasImport(plan,client,{label:'Retry must refuse nonempty target'}),/not empty/);
 fs.writeFileSync(path.join(source,'music-import-results.json'),JSON.stringify({result:'PASS',curations:plan.counts.musicCurations,history:plan.counts.musicHistory,sourceHash:plan.sourceHash,exactReadback:true,refusesOverwrite:true,docker:false,isolatedDatabase:database},null,2));
 console.log('PASS JSON to MySQL retains curation revision/history exactly; reimport refuses overwriting existing Admin data.');
}finally{if(created){assert.match(database,/^momevia_canvas_qa_music_[a-f0-9]{12}$/);await connection.query(`DROP DATABASE \`${database}\``);}await connection.end();}
