// Source-only generation is safe without a DB. Writes require a dedicated QA DB.
import fs from 'node:fs';
import {MySqlClient} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {createMotionRollout} from '../../src/modules/designs/motion-rollout.mjs';
import {previewRollout,applyRollout} from '../../src/modules/designs/library-rollout.mjs';
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
if(args.includes('--from-export')){
 const input=JSON.parse(fs.readFileSync(value('--from-export'))),rows=Array.isArray(input)?input:input.items;
 const bundle=createMotionRollout(rows);fs.writeFileSync(value('--output'),JSON.stringify(bundle,null,2)+'\n');console.log('Created scoped 51-item bundle.');
}else{
 if(process.env.CANVAS_QA_MYSQL_ISOLATED!=='true'||process.env.MYSQL_HOST!=='127.0.0.1'||!/^momevia_canvas_qa_/.test(process.env.MYSQL_DATABASE||''))throw new Error('Explicit isolated loopback QA database required.');
 const client=new MySqlClient(),service=new CanvasLibraryService(client);
 try{const bundle=JSON.parse(fs.readFileSync(value('--bundle'))),options={rollback:args.includes('--rollback')};const result=args.includes('--apply')?await applyRollout(service,{role:'admin'},bundle,options):previewRollout(await service.rows(),bundle,options);
  console.log(JSON.stringify({canApply:result.canApply,dependencyError:result.dependencyError,actions:result.actions.map(a=>({key:a.key,status:a.status})),applied:result.applied,conflict:result.conflict},null,2));if(!result.canApply||result.conflict)process.exitCode=1;
 }finally{await client.close();}
}
