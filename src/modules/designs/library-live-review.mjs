import {createHash} from 'node:crypto';
import {canonicalStringify} from '../../../web/js/shared/canvas/schema.js';
import {validateRollout,previewRollout} from './library-rollout.mjs';
export const libraryFingerprint=value=>createHash('sha256').update(canonicalStringify(value)).digest('hex');
const key=row=>row.kind+':'+row.id;
function seedMeaning(row){
 const copy=structuredClone(row);delete copy.sortOrder;
 if(copy.kind==='element')for(const element of copy.definition.elements){
  if(!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(element.id))throw new Error('Only generated UUID drift may be reviewed automatically');
  delete element.id;
 }
 return canonicalStringify(copy);
}
// Preserve live ordering and accept only audited seed UUID differences. Any
// changed content, status or revision remains an Admin conflict.
export function reviewLiveBaseline(rows,bundle){
 validateRollout(bundle);const next=structuredClone(bundle);
 let order=Math.max(-1,...rows.map(r=>r.sortOrder))+1;
 for(const change of next.changes){
  const actual=rows.find(r=>key(r)===key(change.next));
  if(!change.before){if(actual)throw new Error('New item already exists: '+key(actual));change.next.sortOrder=order++;continue;}
  if(!actual||seedMeaning(actual)!==seedMeaning(change.before))throw new Error('Unreviewed live customization: '+key(change.next));
  change.before=structuredClone(actual);change.expectedRevision=actual.revision;change.expectedFingerprint=libraryFingerprint(actual);
  change.next.revision=actual.revision+1;change.next.sortOrder=actual.sortOrder;
 }
 validateRollout(next);const plan=previewRollout(rows,next);if(!plan.canApply)throw new Error(plan.dependencyError||'Live rollout conflict');
 return next;
}
