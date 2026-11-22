import fs from 'node:fs';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { EVENT_CLUSTER_IDS } from '../../web/js/shared/canvas/event-clusters.js';
import { INTERACTIVE_TEMPLATE_IDS } from '../../web/js/shared/canvas/interactive-templates.js';
import { eventRecipes } from '../../web/js/shared/canvas/event-recipes.js';
const old=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/interactive-cards-v2-before.json',import.meta.url)));
const ids=[...old.map(r=>r.id),...INTERACTIVE_TEMPLATE_IDS,...EVENT_CLUSTER_IDS,...eventRecipes.map(r=>r.id)];
const changes=builtinLibraryItems().filter(r=>ids.includes(r.id)).map((r,index)=>{
 const before=old.find(b=>b.kind===r.kind&&b.id===r.id)||null;
 return {before,next:{...r,revision:(before?.revision||0)+1,sortOrder:before?.sortOrder??1000+index}};
});
const bundle={formatVersion:1,id:'interactive-cards-20261122-v1',baseCommit:'70f2be0',dependencies:['immutable artwork manifest','animation','effect','element','template'],changes};
fs.mkdirSync(new URL('../../database/updates/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../../database/updates/interactive-cards-20261122-v1.json',import.meta.url),JSON.stringify(bundle,null,2)+'\n');
console.log(`Built ${changes.length} CAS library changes (${changes.filter(c=>!c.before).length} additions, 3 template revisions).`);
