import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {canonicalStringify} from '../../web/js/shared/canvas/schema.js';
import {validateRollout} from '../../src/modules/designs/library-rollout.mjs';
const original=JSON.parse(fs.readFileSync('database/updates/template-refresh-natural-20261123-v2.json')),rows=builtinLibraryItems();
const changes=original.changes.filter(c=>c.next.kind==='element'&&c.next.id.startsWith('natural-motion-')).map(({next:before})=>{
 const next=structuredClone(rows.find(r=>r.kind===before.kind&&r.id===before.id));next.revision=before.revision+1;next.sortOrder=before.sortOrder;
 for(const [i,e]of next.definition.elements.entries())e.id=before.definition.elements[i].id;
 return{before,expectedRevision:before.revision,expectedFingerprint:createHash('sha256').update(canonicalStringify(before)).digest('hex'),next};
});
if(changes.length!==6)throw new Error('Expected six motion cards');const bundle={formatVersion:1,id:'natural-motion-loop-20261123-v1',changes};validateRollout(bundle);fs.writeFileSync('database/updates/natural-motion-loop-20261123-v1.json',JSON.stringify(bundle,null,2)+'\n');console.log('Built six motion updates; previous documents and release bundles unchanged.');
