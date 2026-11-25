import {createHash} from 'node:crypto';
import {builtinLibraryItems} from './library.seed.mjs';
import {canonicalStringify} from '../../../web/js/shared/canvas/schema.js';
import {ANIMATED_ELEMENTS} from '../../../web/js/shared/canvas/animated-elements.js';
export const MOTION_REPAIR_ROLLOUT_ID='motion-repair-56-20261125-v2';
export const MOTION_REPAIR_IDS=Object.freeze([...ANIMATED_ELEMENTS.map(e=>e.id),...['heart','star','gift','leaf','ribbon','paper'].map(id=>'natural-motion-'+id)]);
export function createMotionRepairRollout(rows){
 return{formatVersion:1,id:MOTION_REPAIR_ROLLOUT_ID,dependencies:[],changes:builtinLibraryItems().filter(r=>r.kind==='element'&&MOTION_REPAIR_IDS.includes(r.id)).map(row=>{
  const before=rows.find(r=>r.kind===row.kind&&r.id===row.id);if(!before)throw new Error('Existing icon required: '+row.id);
  return{before:structuredClone(before),expectedRevision:before.revision,expectedFingerprint:createHash('sha256').update(canonicalStringify(before)).digest('hex'),next:{...row,status:before.status,sortOrder:before.sortOrder,revision:before.revision+1}};
 })};
}
