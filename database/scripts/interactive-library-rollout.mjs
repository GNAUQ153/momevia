// Explicit QA guard; never reads .env. Product rollout requires a separate task.
import fs from 'node:fs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { CanvasLibraryService } from '../../src/modules/designs/library.service.mjs';
import { previewRollout, applyRollout } from '../../src/modules/designs/library-rollout.mjs';
if(process.env.CANVAS_QA_MYSQL_ISOLATED!=='true'||!/^momevia_canvas_qa_/.test(process.env.MYSQL_DATABASE||'')||process.env.MYSQL_HOST!=='127.0.0.1')throw new Error('An explicit isolated loopback QA database is required');
const client=new MySqlClient(),service=new CanvasLibraryService(client);
const bundle=JSON.parse(fs.readFileSync(new URL('../updates/interactive-cards-20261122-v1.json',import.meta.url)));
try{
 const rollback=process.argv.includes('--rollback'),preview=previewRollout(await service.rows(),bundle,{rollback});
 const result=process.argv.includes('--apply')?await applyRollout(service,{role:'admin'},bundle,{rollback}):preview;
 console.log(JSON.stringify(result,null,2));if(!result.canApply||result.conflict)process.exitCode=1;
}finally{await client.close();}
