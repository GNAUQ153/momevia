// Versioned, portable numeric choreography. No executable markup, URLs or CSS.
import { validateVector, libraryId } from './library-contract.js';
import { EVENT_MEDIA } from './event-media.js';
import {NATURAL_MEDIA_IDS} from './natural-media.js';
const motionImageIds=new Set(['element-eucalyptus','element-satin-bow','element-paper-cotton'].map(id=>NATURAL_MEDIA_IDS[id]));

export const MOTION_LIMITS = Object.freeze({ rows: 3, parts: 12, tracks: 24, frames: 16 });
export const motionKinds = Object.freeze({ pulse: {vi:'Đập',en:'Heartbeat'}, spin:{vi:'Xoay quanh tâm',en:'Center spin'}, float:{vi:'Nhấp nhô',en:'Float'}, sway:{vi:'Đung đưa',en:'Sway'}, orbit:{vi:'Quỹ đạo',en:'Orbit'}, draw:{vi:'Vẽ nét',en:'Draw'}, hinge:{vi:'Mở quanh bản lề',en:'Hinge'}, glow:{vi:'Bắt sáng',en:'Glow'}, burst:{vi:'Hạt trong vật thể',en:'Local particles'}, reveal:{vi:'Hiện dần',en:'Reveal'}, settle:{vi:'Chuyển tới tư thế nghỉ',en:'Settle'} });
export const supportsMotions = e => ['image','sticker','shape','line','button','envelope','gift-box'].includes(e?.type) && !(e.type==='envelope'&&e.props?.preset==='photo-caption-v3');
export const usesMotions = d => d.elements.some(e => e.motions || e.assembly);
const check=(v,s)=>{if(!v)throw new Error('Motion: '+s);};
const obj=(v,keys)=>{check(v&&Object.getPrototypeOf(v)===Object.prototype,'object required');check(Object.keys(v).every(k=>keys.includes(k)),'unsupported field');};
const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function anchor(v){obj(v,['x','y']);check(num(v.x,0,1)&&num(v.y,0,1),'anchor is a fraction 0–1');}
export function validateAssembly(v){
 obj(v,['version','parts']);check([1,2].includes(v.version)&&Array.isArray(v.parts)&&v.parts.length>0&&v.parts.length<=MOTION_LIMITS.parts,'1–12 parts required');
 const ids=new Set();for(const p of v.parts){obj(p,v.version===2?['id','title','anchor','vector','parent','clip','poses','image','rest']:['id','title','anchor','vector','parent','clip']);check(libraryId(p.id)&&p.id!=='whole'&&!ids.has(p.id),'unique part ID required');
  if(p.parent!==undefined)check(ids.has(p.parent),'parent must precede its child');
  if(p.clip!==undefined){if(v.version===2&&p.clip.d!==undefined){obj(p.clip,['d']);validateVector({paths:[{d:p.clip.d,fill:'none'}]});}
   else if(p.clip.x!==undefined){obj(p.clip,['x','y','width','height']);check(num(p.clip.x,0,100)&&num(p.clip.y,0,100)&&num(p.clip.width,1,100-p.clip.x)&&num(p.clip.height,1,100-p.clip.y),'clip must be a bounded local rectangle');}
   else{obj(p.clip,['cx','cy','rx','ry']);check(num(p.clip.cx,0,100)&&num(p.clip.cy,0,100)&&num(p.clip.rx,1,50)&&num(p.clip.ry,1,50),'clip must be a bounded local ellipse');}}
  ids.add(p.id);check(typeof p.title==='string'&&p.title.length<=100,'part title');anchor(p.anchor);validateVector(p.vector);
  if(p.rest!==undefined){obj(p.rest,['opacity','x','y','rotation']);for(const [key,value]of Object.entries(p.rest))check(num(value,...({opacity:[0,1],x:[-35,35],y:[-35,35],rotation:[-720,720]}[key])),'static numeric pose');}
  if(p.poses!==undefined){check(Array.isArray(p.poses)&&p.poses.length>=2&&p.poses.length<=8,'2–8 approved poses');for(const pose of p.poses){validateVector(pose);check(pose.paths.length===p.vector.paths.length,'pose topology');pose.paths.forEach((q,i)=>{check(q.d.replace(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi,'#')===p.vector.paths[i].d.replace(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi,'#'),'matching path commands required');check(q.fill===p.vector.paths[i].fill&&q.stroke===p.vector.paths[i].stroke&&q.strokeWidth===p.vector.paths[i].strokeWidth,'pose paint must match');});}}
  if(p.image!==undefined){obj(p.image,['mediaId','x','y','width','height']);check(motionImageIds.has(p.image.mediaId)&&Object.hasOwn(EVENT_MEDIA,p.image.mediaId)&&!EVENT_MEDIA[p.image.mediaId].previewOnly,'approved internal image required');for(const k of ['x','y'])check(num(p.image[k],0,100),'image position');for(const k of ['width','height'])check(num(p.image[k],1,100),'image size');}
 }
 return v;
}
export function validateMotions(v,model){
 check(supportsMotions(model),'target type is incompatible');obj(v,['version','enabled','rows']);check(v.version===1&&typeof v.enabled==='boolean'&&Array.isArray(v.rows)&&v.rows.length<=MOTION_LIMITS.rows,'maximum three rows');
 check(v.rows.length+(model.effects?.emphasis?1:0)<=MOTION_LIMITS.rows,'legacy emphasis also occupies one of three rows');
 const targets=new Set(['whole',...(model.assembly?.parts.map(p=>p.id)||[])]),ids=new Set();let tracks=0;
 for(const r of v.rows){obj(r,['id','kind','target','anchor','trigger','delayMs','periodMs','iterations','enabled','direction','amplitude','tracks','title']);
  check(libraryId(r.id)&&!ids.has(r.id),'unique row ID required');ids.add(r.id);check(Object.hasOwn(motionKinds,r.kind)&&targets.has(r.target),'unknown motion or target');anchor(r.anchor);
  check(r.trigger==='scene'&&typeof r.enabled==='boolean','invalid trigger or state');check(num(r.delayMs,0,10000)&&num(r.periodMs,300,30000),'timing must be finite milliseconds');
  check(r.iterations==='infinite'||Number.isInteger(r.iterations)&&num(r.iterations,1,5),'iterations 1–5 or infinite');check(['clockwise','counterclockwise'].includes(r.direction)&&num(r.amplitude,0,2),'direction or amplitude');
  if(r.title!==undefined)check(typeof r.title==='string'&&r.title.length<=100,'row title');
  if(r.tracks!==undefined){check(r.amplitude<=1,'authored choreography amplitude is 0–1');check(Array.isArray(r.tracks)&&r.tracks.length>0&&r.tracks.length<=12,'1–12 tracks');tracks+=r.tracks.length;
   for(const t of r.tracks){obj(t,['target','anchor','delayMs','frames','follow']);check(targets.has(t.target),'missing part');anchor(t.anchor);check(num(t.delayMs,0,10000),'track delay milliseconds');check(Array.isArray(t.frames)&&t.frames.length>=2&&t.frames.length<=MOTION_LIMITS.frames,'2–16 frames');let previous=-1;
    if(t.follow!==undefined){obj(t.follow,['part','path','tip']);const source=model.assembly?.parts.find(p=>p.id===t.follow.part);check(model.assembly?.version===2&&source&&!source.parent&&!source.poses,'fixed approved follow path');check(Number.isInteger(t.follow.path)&&num(t.follow.path,0,source.vector.paths.length-1),'follow path index');obj(t.follow.tip,['x','y']);check(num(t.follow.tip.x,0,100)&&num(t.follow.tip.y,0,100),'local tip');check(!r.tracks.some(other=>other.target===t.follow.part&&other.frames.some(f=>['x','y','rotation','pose','scaleX','scaleY'].some(k=>f[k]!==undefined))),'follow source must be stationary');}
    for(const f of t.frames){obj(f,['at','x','y','rotation','scaleX','scaleY','opacity','draw','pose','easing','progress']);check(num(f.at,0,1)&&f.at>previous,'strictly increasing offsets');previous=f.at;for(const [k,n]of Object.entries(f)){if(k==='at')continue;if(k==='progress'){check(t.follow&&num(n,0,1),'follow progress');continue;}if(k==='easing'){check(['linear','ease-in','ease-out','ease-in-out','step-end'].includes(n),'approved easing');continue;}if(k==='pose'){const p=model.assembly?.parts.find(p=>p.id===t.target);check(model.assembly?.version===2&&p?.poses&&num(n,0,p.poses.length-1),'approved pose channel');continue;}check(num(n,...({x:[-35,35],y:[-35,35],rotation:[-720,720],scaleX:[.05,2],scaleY:[.05,2],opacity:[0,1],draw:[0,1]}[k])),'invalid numeric channel');}}
    check(t.frames[0].at===0&&t.frames.at(-1).at===1,'endpoints required');
    if(t.follow)check(t.frames.every((f,i)=>(!f.easing||f.easing==='linear')&&f.progress!==undefined&&(!i||f.progress>=t.frames[i-1].progress)),'follow uses monotonic shared progress');
   }
  }else tracks++;
 }
 check(tracks<=MOTION_LIMITS.tracks,'track budget exceeded');return v;
}
export function motionRow(kind,id=globalThis.crypto.randomUUID()){
 return {id,kind,target:'whole',anchor:{x:.5,y:.5},trigger:'scene',delayMs:0,periodMs:kind==='pulse'?1800:kind==='spin'?8000:4000,iterations:'infinite',enabled:true,direction:'clockwise',amplitude:1};
}
export function motionTracks(row){
 if(row.tracks)return row.kind==='orbit'&&row.direction==='counterclockwise'?row.tracks.map(t=>({...t,frames:t.frames.slice().reverse().map(f=>({...f,at:1-f.at}))})):row.tracks;
 const frames={
  pulse:[{at:0,scaleX:1,scaleY:1},{at:.18,scaleX:1.055,scaleY:1.055},{at:.32,scaleX:1,scaleY:1},{at:.48,scaleX:1.04,scaleY:1.04},{at:.65,scaleX:1,scaleY:1},{at:1,scaleX:1,scaleY:1}],
  spin:[{at:0,rotation:0},{at:1,rotation:360}],
  float:[{at:0,y:0},{at:.5,y:-5},{at:1,y:0}],
  sway:[{at:0,rotation:-4},{at:.5,rotation:4},{at:1,rotation:-4}],
 }[row.kind]||[{at:0,opacity:1},{at:.5,opacity:.65},{at:1,opacity:1}];
 return [{target:row.target,anchor:row.anchor,delayMs:0,frames}];
}
export function numericFrame(frame,row){
 const a=row.amplitude,sign=row.direction==='counterclockwise'&&row.kind!=='orbit'?-1:1;
 return {offset:frame.at,...(frame.easing?{easing:frame.easing}:{}),transform:`translate(${(frame.x||0)*a}px, ${(frame.y||0)*a}px) rotate(${(frame.rotation||0)*(row.kind==='spin'?1:a)*sign}deg) scale(${Math.max(.05,1+((frame.scaleX??1)-1)*a)}, ${Math.max(.05,1+((frame.scaleY??1)-1)*a)})`,...(frame.opacity!==undefined?{opacity:Math.max(0,Math.min(1,1+(frame.opacity-1)*a))}:{}),...(frame.draw!==undefined?{strokeDashoffset:1-frame.draw}: {})};
}
export function posePath(part,index,pose){
 const a=Math.floor(pose),b=Math.min(part.poses.length-1,a+1),mix=pose-a;
 const numbers=part.poses[b].paths[index].d.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);let i=0;
 return part.poses[a].paths[index].d.replace(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi,v=>String(Math.round((Number(v)*(1-mix)+numbers[i++]*mix)*1e5)/1e5));
}
