import { NATURAL_ARTWORK_LABEL } from '../../shared/canvas/event-media.js';
import {ANCHORED_GROUP_LABEL,ANCHORED_SURFACE_LABEL} from '../../shared/canvas/element-groups.js';

// A reading surface follows the text it originally contains, without rewriting
// the sender's shape or moving deliberately overlapping authored layers.
export function growReadingSurfaces(nodes,scale){
 const anchored=new Set(nodes.filter(({model})=>model.groupId&&model.groupId===model.id&&model.accessibility?.label===ANCHORED_GROUP_LABEL).map(({model})=>model.id));
 for(const {model,node}of nodes){
  const composition=anchored.has(model.groupId);
  if(model.type!=='shape'||model.props.kind!=='rectangle'||(composition?model.accessibility?.label!==ANCHORED_SURFACE_LABEL:model.layout.width<100||model.layout.height<100))continue;
  const r=model.layout;
  const text=nodes.filter(({model:e})=>e.type==='text'&&!e.accessibility?.decorative&&(!composition||e.groupId===model.groupId)&&e.layout.x+e.layout.width/2>=r.x&&e.layout.x+e.layout.width/2<=r.x+r.width&&e.layout.y+e.layout.height/2>=r.y&&e.layout.y+e.layout.height/2<=r.y+r.height);
  const end=Math.max(0,...text.map(({node:n})=>(parseFloat(n.style.top)||0)+n.offsetHeight));
  const top=parseFloat(node.style.top)||0,height=parseFloat(node.style.height)||0;
  if(end>top+height){const grown=end-top+16*scale;node.style.height=`${grown}px`;
   if(composition){const shadow=nodes.find(({model:e})=>e.id===model.groupId&&e.type==='shape'&&Math.abs(e.layout.width-r.width)<4&&Math.abs(e.layout.height-r.height)<4);if(shadow)shadow.node.style.height=`${grown}px`;}
  }
 }
}

// One measurement contract for the live scene and the scene beneath opening doors.
export function reflowSceneNodes(nodes, scale, stageTop) {
  const anchored=new Set(nodes.filter(({model})=>model.groupId&&model.groupId===model.id&&model.accessibility?.label===ANCHORED_GROUP_LABEL).map(({model})=>model.id)),seen=new Set(),content=[];
  for(const item of nodes){
    const {model}=item;if(['shape','line','sticker'].includes(model.type)||(model.type==='image'&&model.accessibility.decorative&&model.accessibility.label===NATURAL_ARTWORK_LABEL))continue;
    if(anchored.has(model.groupId)){
      if(seen.has(model.groupId))continue;seen.add(model.groupId);const members=nodes.filter(({model:e})=>e.groupId===model.groupId),y=Math.min(...members.map(({model:e})=>e.layout.y)),end=Math.max(...members.map(({model:e})=>e.layout.y+e.layout.height));content.push({items:members,y,end});
    }else content.push({items:[item],y:model.layout.y,end:model.layout.y+model.layout.height});
  }
  content.sort((a,b)=>a.y-b.y);
  const cohorts = [];
  for (const item of content) {
    const {y,end,items}=item,previous = cohorts.at(-1);
    if (previous && y < previous.logicalEnd) {
      previous.items.push(...items); previous.logicalEnd = Math.max(previous.logicalEnd,end);
    } else cohorts.push({items:[...items],logicalEnd:end});
  }
  let shift = 0, actualEnd = 0, intrinsicReply = false;
  for (const cohort of cohorts) {
    let bottom = -Infinity;
    for (const { model, node } of cohort.items) {
      node.style.top = `${model.layout.y * scale + shift}px`;
      bottom = Math.max(bottom, node.getBoundingClientRect().bottom - stageTop);
    }
    const intrinsic = cohort.items.some(({ model }) => model.type === 'reply' && model.props.replyMode === 'attendance');
    intrinsicReply ||= intrinsic;
    const delta = bottom - (cohort.logicalEnd * scale + shift);
    actualEnd = Math.max(actualEnd, bottom);
    shift += intrinsic ? delta : Math.max(0, delta);
  }
  return { actualEnd, intrinsicReply };
}
