import fs from 'node:fs';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {validateRollout,previewRollout} from '../../src/modules/designs/library-rollout.mjs';
const selected=builtinLibraryItems().filter(r=>r.kind==='element'&&r.id.startsWith('natural-open-'));
if(selected.length!==12)throw new Error('Expected twelve reviewed open-source elements');
for(const r of selected)for(const [i,e]of r.definition.elements.entries())e.id=r.id+'-part-'+(i+1);
const bundle={formatVersion:1,id:'natural-open-elements-20261123-v1',sourceReview:'docs/THIRD_PARTY_NOTICES.md',changes:selected.map(next=>({before:null,expectedRevision:0,expectedFingerprint:null,next}))};
validateRollout(bundle);
const baseline=JSON.parse(fs.readFileSync('tests/fixtures/refresh-21-before.json'));for(const {next}of JSON.parse(fs.readFileSync('database/updates/template-refresh-natural-20261123-v2.json')).changes){const i=baseline.findIndex(r=>r.kind===next.kind&&r.id===next.id);if(i<0)baseline.push(next);else baseline[i]=next;}
if(!previewRollout(baseline,bundle).canApply)throw new Error('Open element dependencies failed');
fs.writeFileSync('database/updates/natural-open-elements-20261123-v1.json',JSON.stringify(bundle,null,2)+'\n');console.log('Built twelve reviewed open-source elements, CAS and rollback supported.');
