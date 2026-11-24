import {createHash} from 'node:crypto';
import {builtinLibraryItems} from './library.seed.mjs';
import {ANIMATED_ELEMENTS} from '../../../web/js/shared/canvas/animated-elements.js';
import {canonicalStringify} from '../../../web/js/shared/canvas/schema.js';
export const MOTION_ROLLOUT_ID='animated-elements-50-20261124-v1';
export const MOTION_ROLLOUT_IDS=Object.freeze([...ANIMATED_ELEMENTS.map(e=>e.id),'natural-motion-heart']);
export function createMotionRollout(rows){
 const next=builtinLibraryItems().filter(r=>r.kind==='element'&&MOTION_ROLLOUT_IDS.includes(r.id));
 return {formatVersion:1,id:MOTION_ROLLOUT_ID,dependencies:[],changes:next.map(row=>{
  const before=rows.find(r=>r.kind===row.kind&&r.id===row.id)||null;
  return {before,expectedRevision:before?.revision||0,expectedFingerprint:before?createHash('sha256').update(canonicalStringify(before)).digest('hex'):null,next:{...row,revision:(before?.revision||0)+1,...(before?{sortOrder:before.sortOrder}:{})}};
 })};
}
