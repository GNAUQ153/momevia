import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {NATURAL_MEDIA,NATURAL_MEDIA_IDS} from '../../web/js/shared/canvas/natural-media.js';
import {validateRollout} from '../../src/modules/designs/library-rollout.mjs';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
const bundle=JSON.parse(fs.readFileSync(new URL('../../database/updates/natural-open-elements-20261123-v1.json',import.meta.url)));
test('reviewed natural media and optimized variants retain exact bytes and distribution metadata',()=>{
 assert.equal(Object.keys(NATURAL_MEDIA_IDS).length,56);
 for(const id of Object.values(NATURAL_MEDIA_IDS)){
  const media=NATURAL_MEDIA[id];assert(media.source&&media.rights&&media.sourceHash);
  for(const spec of [media,media.cover,media.thumbnail]){assert(spec);const bytes=fs.readFileSync(new URL('../../web/assets/event-cards/'+spec.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),spec.sha256);assert.equal(bytes.length,spec.bytes);}
  if(media.file.includes('element-open-'))assert.equal(media.license,'CC0-1.0');
 }
});
test('external rollout cannot change templates, prices or an unreviewed element',()=>{
 assert.equal(bundle.changes.length,12);validateRollout(bundle);
 for(const [kind,id]of [['template','afterglow'],['element','natural-arbitrary-code'],['element','heading']]){const bad=structuredClone(bundle);Object.assign(bad.changes[0].next,{kind,id});assert.throws(()=>validateRollout(bad),/Unreviewed/);}
 const bad=structuredClone(bundle);bad.changes[0].expectedRevision=9;assert.throws(()=>validateRollout(bad),/baseline/);
});
test('Canvix contributions are editable native path data with the MIT notice retained',()=>{
 const rows=builtinLibraryItems().filter(r=>r.id.startsWith('natural-open-canvix-'));assert.equal(rows.length,2);
 for(const row of rows){const e=row.definition.elements[0];assert.equal(e.type,'shape');assert(e.artwork.paths.some(p=>p.fill==='color'));assert.notEqual(e.locked,true);assert(!JSON.stringify(e).includes('<script'));}
 assert.match(fs.readFileSync(new URL('../../web/assets/event-cards/natural-v4/licenses/Canvix-MIT.txt',import.meta.url),'utf8'),/Copyright \(c\) 2026 Ashiq Hussain Mir/);
});

