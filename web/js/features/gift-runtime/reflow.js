import { NATURAL_ARTWORK_LABEL } from '../../shared/canvas/event-media.js';

// One measurement contract for the live scene and the scene beneath opening doors.
export function reflowSceneNodes(nodes, scale, stageTop) {
  const content = nodes.filter(({ model }) => !['shape', 'line', 'sticker'].includes(model.type)
    && !(model.type === 'image' && model.accessibility.decorative && model.accessibility.label === NATURAL_ARTWORK_LABEL))
    .sort((a, b) => a.model.layout.y - b.model.layout.y);
  const cohorts = [];
  for (const item of content) {
    const { y, height } = item.model.layout, previous = cohorts.at(-1);
    if (previous && y < previous.logicalEnd) {
      previous.items.push(item); previous.logicalEnd = Math.max(previous.logicalEnd, y + height);
    } else cohorts.push({ items: [item], logicalEnd: y + height });
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

// Reading paper grows with its contained text without changing authored data.
export function growReadingSurfaces(nodes,scale){
 for(const {model,node}of nodes){
  if(model.type!=='shape'||model.props.kind!=='rectangle'||model.layout.width<100||model.layout.height<100)continue;
  const r=model.layout,text=nodes.filter(({model:e})=>e.type==='text'&&!e.accessibility?.decorative&&e.layout.x+e.layout.width/2>=r.x&&e.layout.x+e.layout.width/2<=r.x+r.width&&e.layout.y+e.layout.height/2>=r.y&&e.layout.y+e.layout.height/2<=r.y+r.height);
  const end=Math.max(0,...text.map(({node:n})=>(parseFloat(n.style.top)||0)+n.offsetHeight)),top=parseFloat(node.style.top)||0,height=parseFloat(node.style.height)||0;
  if(end>top+height)node.style.height=String(end-top+16*scale)+'px';
 }
}
