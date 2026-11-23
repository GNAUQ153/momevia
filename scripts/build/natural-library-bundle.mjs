import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {REFRESH_21} from '../../web/js/shared/canvas/refresh-21-config.js';
import {NATURAL_ELEMENT_SPECS,NATURAL_COMPOSITION_IDS} from '../../web/js/shared/canvas/natural-elements.js';
import {canonicalStringify} from '../../web/js/shared/canvas/schema.js';
import {validateRollout,previewRollout} from '../../src/modules/designs/library-rollout.mjs';
const old=JSON.parse(fs.readFileSync('tests/fixtures/refresh-21-before.json')),vector=JSON.parse(fs.readFileSync('database/updates/template-refresh-21-20261123-v1.json'));
const rows=builtinLibraryItems(),key=r=>`${r.kind}:${r.id}`,hash=r=>createHash('sha256').update(canonicalStringify(r)).digest('hex');
const naturalIds=new Set([...NATURAL_ELEMENT_SPECS.map(s=>'natural-'+s[0]),...NATURAL_COMPOSITION_IDS].filter(id=>!id.startsWith('natural-open-')));
const selected=rows.filter(r=>r.kind==='template'&&REFRESH_21[r.id]||r.kind==='element'&&(['flowers','leaves','stars'].includes(r.id)||r.id.startsWith('object-')||naturalIds.has(r.id))||['animation','effect'].includes(r.kind)&&r.id==='paper-unfold-natural-v1').map(row=>{
 if(row.kind!=='element')return row;const next=structuredClone(row),ids=new Map(next.definition.elements.map((e,i)=>[e.id,`${row.id}-part-${i+1}`]));
 for(const e of next.definition.elements){e.id=ids.get(e.id);for(const action of e.actions||[])if(ids.has(action.targetSceneId))action.targetSceneId=ids.get(action.targetSceneId);}
 return next;
});
if(selected.length!==75)throw new Error(`Finish all natural artwork and library cards before building the release (${selected.length}/75)`);
for(const fromVector of [false,true]){
 const baseline=structuredClone(old);if(fromVector)for(const change of vector.changes){const i=baseline.findIndex(r=>key(r)===key(change.next));if(i<0)baseline.push(change.next);else baseline[i]=change.next;}
 const id='template-refresh-natural-20261123-v2'+(fromVector?'-from-vector-v1':'');
 const bundle={formatVersion:1,id,baselineCommit:'38c465d007687f54190adcb521dadfea04ad9d40',sourceBaseline:fromVector?'vector-v1':'original',changes:selected.map(row=>{
  const before=baseline.find(r=>key(r)===key(row))||null;return{before,expectedRevision:before?.revision||0,expectedFingerprint:before?hash(before):null,next:{...row,revision:(before?.revision||0)+1,sortOrder:before?.sortOrder??row.sortOrder}};
 })};
 validateRollout(bundle);const preview=previewRollout(baseline,bundle);if(!preview.canApply)throw new Error(preview.dependencyError||'Baseline conflict');
 fs.writeFileSync(`database/updates/${id}.json`,JSON.stringify(bundle,null,2)+'\n');console.log('Built',id,bundle.changes.length,'scoped CAS rows');
}
