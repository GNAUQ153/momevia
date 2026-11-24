import {motionTracks,numericFrame} from '../../shared/canvas/motion-stack.js';
const svgNS='http://www.w3.org/2000/svg';
const svg=tag=>document.createElementNS(svgNS,tag);
export function renderAssembly(assembly,props){
 const palette=typeof props==='string'?{color:props}:props,paint=value=>value==='color'?palette.color:value==='strokeColor'?palette.strokeColor||palette.color:value;
 const root=svg('svg');root.setAttribute('viewBox','0 0 100 100');root.setAttribute('width','100%');root.setAttribute('height','100%');root.setAttribute('aria-hidden','true');root.style.overflow='hidden';root.style.pointerEvents='none';
 const parts=new Map();
 for(const part of assembly.parts){const group=svg('g');group.dataset.motionPart=part.id;(parts.get(part.parent)||root).append(group);parts.set(part.id,group);
  if(part.clip){const clip=svg('clipPath'),boundary=svg(part.clip.x!==undefined?'rect':'ellipse'),id='motion-clip-'+globalThis.crypto.randomUUID();clip.id=id;for(const [key,value]of Object.entries(part.clip))boundary.setAttribute(key,value);clip.append(boundary);root.prepend(clip);group.setAttribute('clip-path',`url(#${id})`);}
  for(const p of part.vector.paths){const path=svg('path');path.setAttribute('d',p.d);path.setAttribute('fill',paint(p.fill)||'none');if(p.stroke)path.setAttribute('stroke',paint(p.stroke));if(p.strokeWidth!==undefined)path.setAttribute('stroke-width',p.strokeWidth==='strokeWidth'?palette.strokeWidth||0:p.strokeWidth);if(p.dash)path.setAttribute('stroke-dasharray',p.dash);path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('pathLength','1');group.append(path);}
 }
 return root;
}
// Layout and hit target stay outside every animated layer. Each row owns a
// separate layer, including overlapping properties (composition is nested).
export function prepareMotionLayers(node,model){
 if(!model.motions)return;
 if(['shape','line'].includes(model.type)&&!model.assembly&&!node.classList.contains('gift-runtime-vector-box')){
  const visual=document.createElement('span');visual.className=node.className;Object.assign(visual.style,{display:'block',width:'100%',height:'100%',boxSizing:'border-box'});
  for(const key of ['backgroundColor','borderColor','borderStyle','borderWidth','borderRadius'])visual.style[key]=node.style[key];
  visual.append(...node.childNodes);node.append(visual);Object.assign(node.style,{backgroundColor:'transparent',borderWidth:'0',borderStyle:'none'});
 }
 if(['button','envelope','gift-box'].includes(model.type)){
  const visual=document.createElement('span');visual.className=node.className;visual.setAttribute('aria-hidden','true');Object.assign(visual.style,{width:'100%',height:'100%',boxSizing:'border-box',backgroundColor:model.props.color});visual.append(...node.childNodes);node.append(visual);
  Object.assign(node.style,{backgroundColor:'transparent',padding:'0',boxShadow:'none'});
 }
 if(model.type==='image'){
  // Crop the photo before moving it, so spinning a rectangular photo does not
  // clip its rotating corners against the fixed editor selection rectangle.
  node.style.overflow='visible';
  if(!node.querySelector('.gift-runtime-photo-frame')){
   const crop=document.createElement('span');Object.assign(crop.style,{display:'block',width:'100%',height:'100%',overflow:'hidden',borderRadius:node.style.borderRadius});crop.append(...node.childNodes);node.append(crop);
  }
 }
 const whole=document.createElement('span');whole.dataset.motionPart='whole';Object.assign(whole.style,{display:'block',position:'relative',width:'100%',height:'100%',pointerEvents:'none'});
 if(model.type==='sticker')Object.assign(whole.style,{display:'grid',placeItems:'center'});
 whole.append(...node.childNodes);node.append(whole);
 const targets=new Map([...node.querySelectorAll('[data-motion-part]')].map(n=>[n.dataset.motionPart,n]));
 for(const row of model.motions.rows){for(const [index,t]of motionTracks(row).entries()){
  const target=targets.get(t.target);if(!target)continue;const isSvg=target.namespaceURI===svgNS,layer=isSvg?svg('g'):document.createElement('span');
  layer.dataset.motionRow=row.id;layer.dataset.motionTrack=String(index);layer.dataset.motionSignature=JSON.stringify(row);
  Object.assign(layer.style,isSvg?{transformBox:'view-box',transformOrigin:`${t.anchor.x*100}px ${t.anchor.y*100}px`}:{display:'block',width:'100%',height:'100%',transformOrigin:`${t.anchor.x*100}% ${t.anchor.y*100}%`});
  if(!isSvg&&model.type==='sticker')Object.assign(layer.style,{display:'grid',placeItems:'center'});
  if(t.frames.some(f=>f.draw!==undefined))layer.style.strokeDasharray='1';
  layer.append(...target.childNodes);target.append(layer);
 }}
 // Existing families have separate visual layers as well. A custom reaction
 // may animate while emphasis loops, without touching the layout/hit target.
 let content=whole;
 for(const family of ['reaction','emphasis','entrance']){
  const layer=document.createElement('span');layer.dataset.motionFamily=family;Object.assign(layer.style,{display:'block',width:'100%',height:'100%',pointerEvents:'none'});content.replaceWith(layer);layer.append(content);content=layer;
 }
}
export function playMotionStack(node,model,motion,signal){
 const stack=model.motions;if(!stack?.enabled||!motion.enabled()||signal?.aborted)return Promise.resolve();
 const tasks=[];for(const row of stack.rows){if(!row.enabled)continue;const tracks=motionTracks(row);
  for(const layer of node.querySelectorAll('[data-motion-row]')){if(layer.dataset.motionRow!==row.id)continue;
   // Restart replaces this row only; no hidden duplicate emitter.
   layer.getAnimations().forEach(a=>a.cancel());const track=tracks[Number(layer.dataset.motionTrack)];
   const frames=track.frames.map(f=>{const v=numericFrame(f,row);if(row.kind==='pulse')v.easing='ease-in-out';if(layer.namespaceURI!==svgNS)v.transform=v.transform.replace(/translate\(([-\d.]+)px, ([-\d.]+)px\)/,(_,x,y)=>`translate(${x}%, ${y}%)`);return v;});
   tasks.push(motion.run(layer,frames,{duration:row.periodMs,delay:row.delayMs+track.delayMs,easing:'linear',iterations:row.iterations==='infinite'?Infinity:row.iterations,fill:row.iterations==='infinite'?'backwards':'both'},signal,()=>{} ,{retain:row.iterations!=='infinite'}));
  }
 }return Promise.all(tasks);
}
