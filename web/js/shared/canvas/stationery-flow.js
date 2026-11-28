// Opt-in layout for newly authored stationery. Measurements use logical canvas units.
export function stationeryFlow(scene, elements, measuredHeights = new Map()) {
  const layouts = new Map();
  const surfaces = new Set();
  if (!scene.flow) return { layouts, surfaces, growth: 0 };
  const region = scene.flow.region;
  const bottom = region.y + region.height;
  const members = elements.filter(e => scene.elementIds.includes(e.id) && e.visible !== false && !e.hidden);
  const groupTops = new Map();
  for (const member of members) if (member.groupId)
    groupTops.set(member.groupId, Math.min(groupTops.get(member.groupId) ?? Infinity, member.layout.y));
  const text = members.filter(e => !e.groupId && e.type === 'text' && e.layout.y >= region.y && e.layout.y < bottom &&
    e.layout.x < region.x + region.width && e.layout.x + e.layout.width > region.x)
    .sort((a, b) => a.layout.y - b.layout.y);
  let offset = 0, previousEnd = region.y, previousOriginalEnd = region.y;
  for (const model of text) {
    const box = model.layout;
    const gap = Math.max(0, box.y - previousOriginalEnd);
    const y = Math.max(box.y + offset, previousEnd + gap);
    const measured = measuredHeights.get(model.id);
    const height = Math.max(box.height, Number.isFinite(measured) ? measured : 0);
    layouts.set(model.id, { ...box, y, height });
    offset = y + height - (box.y + box.height);
    previousEnd = y + height;
    previousOriginalEnd = box.y + box.height;
  }
  const growth = Math.max(0, offset);
  for (const model of members) {
    if (layouts.has(model.id)) continue;
    const box = model.layout;
    if (model.groupId) {
      if (groupTops.get(model.groupId) >= bottom) layouts.set(model.id, { ...box, y: box.y + growth });
      continue;
    }
    const encloses = ['shape', 'image'].includes(model.type) && model.accessibility.decorative &&
      box.x <= region.x && box.x + box.width >= region.x + region.width &&
      box.y <= region.y && box.y + box.height >= bottom;
    if (encloses) {
      layouts.set(model.id, { ...box, height: box.height + growth });
      if(model.type==='image')surfaces.add(model.id);
    }
    else if (box.y >= bottom) layouts.set(model.id, { ...box, y: box.y + growth });
  }
  return { layouts, surfaces, growth };
}

export function paperSlices(sourceWidth, sourceHeight, width, height) {
  const edge = Math.min(120,sourceWidth/3,sourceHeight/3);
  const border = Math.min(20,width/3,height/3);
  const sourceX=[0,edge,sourceWidth-edge,sourceWidth],sourceY=[0,edge,sourceHeight-edge,sourceHeight];
  const x=[0,border,width-border,width],y=[0,border,height-border,height];
  return Array.from({length:9},(_,index)=>{const row=Math.floor(index/3),col=index%3;return {
    sx:sourceX[col],sy:sourceY[row],sw:sourceX[col+1]-sourceX[col],sh:sourceY[row+1]-sourceY[row],
    x:x[col],y:y[row],width:x[col+1]-x[col],height:y[row+1]-y[row],
  };});
}
