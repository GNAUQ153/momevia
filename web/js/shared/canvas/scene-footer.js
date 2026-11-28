// One responsive footer geometry for Canvas buttons, playback and cover output.
export const isSceneFooter = e => e.type==='button'&&e.props.placement==='footer';
export function sceneFooterLayout(elements,size,scale=1){
  const controls=elements.filter(isSceneFooter).sort((a,b)=>a.layout.x-b.layout.x);
  if(!controls.length)return null;
  const width=size.width*scale,height=size.height*scale,pad=Math.max(12,24*scale),gap=Math.max(8,12*scale);
  const buttonHeight=Math.max(56,56*scale),top=height-pad-buttonHeight;
  const quiet=controls.filter(e=>e.props.variant==='text').length,quietWidth=Math.max(44,48*scale);
  const fillWidth=(width-2*pad-gap*(controls.length-1)-quiet*quietWidth)/Math.max(1,controls.length-quiet);
  const layouts=new Map();let x=pad;
  for(const e of controls){const w=e.props.variant==='text'?quietWidth:fillWidth;layouts.set(e.id,{x,y:top,width:w,height:buttonHeight});x+=w+gap;}
  return {height,bodyHeight:Math.max(0,top-gap),layouts};
}
export function sceneFrameLayout(elements,size,scale=1){
  return sceneFooterLayout(elements,size,scale)||{height:size.height*scale,bodyHeight:size.height*scale,layouts:new Map()};
}
