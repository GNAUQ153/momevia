import {motionTracks,numericFrame,posePath} from '../../shared/canvas/motion-stack.js';
import {eventMediaUrl,EVENT_MEDIA} from '../../shared/canvas/event-media.js';
const svgNS='http://www.w3.org/2000/svg';
const svg=tag=>document.createElementNS(svgNS,tag);
let nativePathMorph;
function supportsPathMorph(){
 if(nativePathMorph!==undefined)return nativePathMorph;
 if(!globalThis.CSS?.supports('d','path("M0 0L1 0")'))return nativePathMorph=false;
 const root=svg('svg'),path=svg('path');root.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';path.setAttribute('d','M0 0L1 0');root.append(path);document.body.append(root);
 const animation=path.animate([{d:'path("M0 0L1 0")'},{d:'path("M0 0L3 0")'}],{duration:1000,fill:'both'});animation.pause();animation.currentTime=500;
 nativePathMorph=Math.abs(path.getTotalLength()-2)<.01;animation.cancel();root.remove();return nativePathMorph;
}
function easedProgress(value,easing){
 if(easing==='step-end')return value<1?0:1;
 const pair={'ease-in':[.42,1],'ease-out':[0,.58],'ease-in-out':[.42,.58]}[easing];if(!pair)return value;
 const curve=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
 let lo=0,hi=1;for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(curve(mid,...pair)<value)lo=mid;else hi=mid;}return curve((lo+hi)/2,0,1);
}
function mirrorPathPose(path,part,index,track,row,clock,motion,signal){
 const original=path.getAttribute('d');let raf=0,stopped=false,previous=null,release=()=>{};
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);path.setAttribute('d',original);release();signal?.removeEventListener('abort',stop);};
 release=motion.track(stop);signal?.addEventListener('abort',stop,{once:true});
 const tick=()=>{
  if(stopped||signal?.aborted)return;
  const progress=clock.effect.getComputedTiming().progress??0;
  if(progress!==previous){let i=0;while(i<track.frames.length-2&&progress>track.frames[i+1].at)i++;const a=track.frames[i],b=track.frames[i+1],q=easedProgress(Math.max(0,Math.min(1,(progress-a.at)/(b.at-a.at))),a.easing),last=part.poses.length-1,pose=(a.pose??last)*(1-q)+(b.pose??last)*q;path.setAttribute('d',posePath(part,index,last+(pose-last)*row.amplitude));previous=progress;}
  if(clock.playState!=='finished')raf=requestAnimationFrame(tick);
 };
 tick();return stop;
}
export function renderAssembly(assembly,props,assetUrl){
 const palette=typeof props==='string'?{color:props}:props,paint=value=>value==='color'?palette.color:value==='strokeColor'?palette.strokeColor||palette.color:value;
 const root=svg('svg');root.setAttribute('viewBox','0 0 100 100');root.setAttribute('width','100%');root.setAttribute('height','100%');root.setAttribute('aria-hidden','true');root.style.overflow='hidden';root.style.pointerEvents='none';
 const parts=new Map();
 const imagePart=assembly.parts.find(p=>p.image),art=imagePart?svg('g'):root;
 if(imagePart){const media=EVENT_MEDIA[imagePart.image.mediaId],aspect=media.width/media.height;root.setAttribute('viewBox',`0 0 ${100*aspect} 100`);art.setAttribute('transform',`scale(${aspect} 1)`);root.append(art);}
 for(const part of assembly.parts){const group=svg('g');group.dataset.motionPart=part.id;if(part.rest){if(part.rest.opacity!==undefined)group.style.opacity=part.rest.opacity;if(['x','y','rotation'].some(k=>part.rest[k]!==undefined))Object.assign(group.style,{transform:numericFrame({at:0,...part.rest},{amplitude:1,kind:'sway',direction:'clockwise'}).transform,transformBox:'view-box',transformOrigin:`${part.anchor.x*100}px ${part.anchor.y*100}px`});}(parts.get(part.parent)||art).append(group);parts.set(part.id,group);
  if(part.clip){const clip=svg('clipPath'),boundary=svg(part.clip.d!==undefined?'path':part.clip.x!==undefined?'rect':'ellipse'),id='motion-clip-'+globalThis.crypto.randomUUID();clip.id=id;for(const [key,value]of Object.entries(part.clip))boundary.setAttribute(key,value);if(part.clip.d)boundary.setAttribute('clip-rule','evenodd');clip.append(boundary);root.prepend(clip);group.setAttribute('clip-path',`url(#${id})`);}
  if(part.image){const picture=svg('image');picture.setAttribute('href',assetUrl?.(palette.assetId)||eventMediaUrl(part.image.mediaId));for(const k of ['x','y','width','height'])picture.setAttribute(k,part.image[k]);picture.setAttribute('preserveAspectRatio','none');group.append(picture);}
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
  if(target.style.opacity){layer.style.opacity=target.style.opacity;target.style.opacity='';}
  if(target.style.transform){layer.style.transform=target.style.transform;target.style.transform='';}
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
   const frames=track.frames.map(f=>{const v=numericFrame(f,row);if(row.kind==='pulse'&&!f.easing)v.easing='ease-in-out';if(layer.namespaceURI!==svgNS)v.transform=v.transform.replace(/translate\(([-\d.]+)px, ([-\d.]+)px\)/,(_,x,y)=>`translate(${x}%, ${y}%)`);return v;});
   if(track.follow){
    const source=node.querySelector(`[data-motion-part="${track.follow.part}"]`).querySelectorAll('path')[track.follow.path],length=source.getTotalLength();
    // SVG stroke reveal and CSS motion paths use different curve-length
    // approximations. Sample the actual SVG's arc length once, so the tip
    // and the ink use the same metric even around a tight signature hook.
    const points=Array.from({length:257},(_,i)=>source.getPointAtLength(length*i/256)),distances=[0];
    for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
    const route=points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(''),distance=p=>{const v=p*256,i=Math.min(255,Math.floor(v));return(distances[i]+(distances[i+1]-distances[i])*(v-i))/distances.at(-1)*100;};
    const authored=track.frames,expanded=[...authored];
    for(let i=1;i<256;i++){const progress=i/256;for(let j=0;j<authored.length-1;j++){const a=authored[j],b=authored[j+1];if((a.progress??1)<progress&&(b.progress??1)>progress){const q=(progress-a.progress)/(b.progress-a.progress),frame={at:a.at+(b.at-a.at)*q,progress};for(const k of ['x','y','rotation','scaleX','scaleY','opacity'])if(a[k]!==undefined||b[k]!==undefined){const fallback=['scaleX','scaleY','opacity'].includes(k)?1:0;frame[k]=(a[k]??fallback)*(1-q)+(b[k]??fallback)*q;}expanded.push(frame);break;}}}
    frames.splice(0,frames.length,...expanded.sort((a,b)=>a.at-b.at).map(frame=>({...numericFrame(frame,row),offsetPath:`path("${route}")`,offsetDistance:`${distance(1+((frame.progress??1)-1)*row.amplitude)}%`,offsetAnchor:`${track.follow.tip.x}px ${track.follow.tip.y}px`,offsetRotate:'0deg'})));
   }
   const options={duration:row.periodMs,delay:row.delayMs+track.delayMs,easing:'linear',iterations:row.iterations==='infinite'?Infinity:row.iterations,fill:row.iterations==='infinite'?'backwards':'both'},retain={retain:row.iterations!=='infinite'};
   tasks.push(motion.run(layer,frames,options,signal,()=>{},retain));
   if(track.frames.some(f=>f.pose!==undefined)){
    const part=model.assembly.parts.find(p=>p.id===track.target);
    [...layer.children].filter(n=>n.tagName==='path').forEach((path,index)=>{
     path.getAnimations().forEach(a=>a.cancel());
     if(supportsPathMorph()){
      const poses=track.frames.map(f=>({offset:f.at,d:`path("${posePath(part,index,(f.pose??part.poses.length-1)*row.amplitude+(part.poses.length-1)*(1-row.amplitude))}")`,...(f.easing?{easing:f.easing}:{})}));tasks.push(motion.run(path,poses,options,signal,()=>{},retain));
     }else{
      let stop=()=>{};tasks.push(motion.run(path,[{opacity:1},{opacity:1}],options,signal,()=>stop(),retain));const clock=path.getAnimations().at(-1);if(clock)stop=mirrorPathPose(path,part,index,track,row,clock,motion,signal);
     }
    });
   }
  }
 }return Promise.all(tasks);
}
