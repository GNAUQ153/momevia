// No application .env; only explicitly isolated loopback QA databases.
import fs from 'node:fs';
import {MySqlClient} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {previewRollout,applyRollout} from '../../src/modules/designs/library-rollout.mjs';
if(process.env.CANVAS_QA_MYSQL_ISOLATED!=='true'||!/^momevia_canvas_qa_/.test(process.env.MYSQL_DATABASE||'')||process.env.MYSQL_HOST!=='127.0.0.1')throw new Error('Explicit isolated loopback QA database required');
const suffix=process.argv.includes('--from-vector-v1')?'-from-vector-v1':'',file=process.argv.includes('--open-elements')?'natural-open-elements-20261123-v1':`template-refresh-natural-20261123-v2${suffix}`,bundle=JSON.parse(fs.readFileSync(new URL(`../updates/${file}.json`,import.meta.url)));
const client=new MySqlClient(),service=new CanvasLibraryService(client);
try{const rollback=process.argv.includes('--rollback'),result=process.argv.includes('--apply')?await applyRollout(service,{role:'admin'},bundle,{rollback}):previewRollout(await service.rows(),bundle,{rollback});console.log(JSON.stringify(result,null,2));if(!result.canApply||result.conflict)process.exitCode=1;}finally{await client.close();}
