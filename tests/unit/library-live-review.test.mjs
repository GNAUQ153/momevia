import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewLiveBaseline,libraryFingerprint} from '../../src/modules/designs/library-live-review.mjs';
const original=JSON.parse(fs.readFileSync(new URL('../fixtures/refresh-21-before.json',import.meta.url))),bundle=JSON.parse(fs.readFileSync(new URL('../../database/updates/template-refresh-natural-20261123-v2.json',import.meta.url)));
test('live review accepts generated seed IDs and preserves live ordering with exact CAS',()=>{
 const rows=structuredClone(original);for(const r of rows)r.sortOrder+=1000;
 for(const r of rows.filter(r=>r.kind==='element'&&['flowers','leaves','stars'].includes(r.id)))for(const [i,e]of r.definition.elements.entries())e.id='12345678-1234-4234-8234-'+String(i).padStart(12,'0');
 const next=reviewLiveBaseline(rows,bundle);assert.equal(next.changes.length,75);
 for(const c of next.changes.filter(c=>c.before)){const live=rows.find(r=>r.kind===c.next.kind&&r.id===c.next.id);assert.equal(c.expectedFingerprint,libraryFingerprint(live));assert.equal(c.next.sortOrder,live.sortOrder);assert.deepEqual(c.before,live);}
});
test('live review refuses Admin content, revision and status changes',()=>{
 for(const field of ['revision','status','content']){const rows=structuredClone(original),r=rows.find(r=>r.kind==='template'&&r.id==='afterglow');if(field==='revision')r.revision++;else if(field==='status')r.status='disabled';else r.definition.title.vi='Admin custom';assert.throws(()=>reviewLiveBaseline(rows,bundle),/customization/);}
});
test('live review refuses a preexisting new ID instead of silently overwriting it',()=>{
 const rows=structuredClone(original);rows.push(structuredClone(bundle.changes.find(c=>!c.before).next));assert.throws(()=>reviewLiveBaseline(rows,bundle),/already exists/);
});
