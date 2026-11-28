// Optional photo blocks can reserve space in the editor and collapse in playback.
// Resolve a view without changing the saved layouts, media or published snapshot.
export function scenePresentation(document, scene) {
  const elements=document.elements.filter(e=>scene.elementIds.includes(e.id)&&e.visible!==false);
  const empty=elements.filter(e=>e.type==='image'&&e.props.optional&&e.props.placeholder==='collapse'&&!e.props.assetId);
  const hidden=new Set(),regions=[];
  for(const photo of empty){
    const members=elements.filter(e=>e.id===photo.id||(photo.groupId&&e.groupId===photo.groupId));
    for(const e of members)hidden.add(e.id);
    regions.push({top:Math.min(...members.map(e=>e.layout.y)),bottom:Math.max(...members.map(e=>e.layout.y+e.layout.height))});
  }
  const spans=[];
  for(const r of regions.sort((a,b)=>a.top-b.top)){
    const last=spans.at(-1);if(last&&r.top<=last.bottom)last.bottom=Math.max(last.bottom,r.bottom);else spans.push({...r});
  }
  const shift=y=>spans.reduce((sum,r)=>sum+(y>=r.bottom?r.bottom-r.top:0),0);
  const size={...document.artboard.baseSize};
  return {size,elements:elements.filter(e=>!hidden.has(e.id)).map(e=>{
    const delta=e.props.placement==='footer'?0:shift(e.layout.y);return delta?{...e,layout:{...e.layout,y:e.layout.y-delta}}:e;
  })};
}
