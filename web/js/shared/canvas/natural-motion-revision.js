import {motionRow} from './motion-stack.js';
import {NATURAL_MEDIA_IDS} from './natural-media.js';
const blank={paths:[{d:'M0 0',fill:'none',stroke:'none',strokeWidth:0}]};
const tr=(target,frames,x=.5,y=.5,delayMs=0)=>({target,anchor:{x,y},delayMs,frames:frames.map(([at,v])=>({at,...v}))});
const row=(id,title,tracks,periodMs,iterations='infinite')=>({...motionRow('sway',id),title,tracks,periodMs,iterations});
const swing=(target,a,x,y,delay=0)=>tr(target,[[0,{rotation:-a,easing:'ease-in-out'}],[.5,{rotation:a,easing:'ease-in-out'}],[1,{rotation:-a}]],x,y,delay);
const group=(id,title,parent)=>({id,title,anchor:{x:.5,y:.5},vector:structuredClone(blank),...(parent?{parent}:{})});
function image(id,title,mediaId,parent,d){return{...group(id,title,parent),image:{mediaId,x:0,y:0,width:100,height:100},...(d?{clip:{d}}:{})};}
export function reviseNaturalMotion(model,id){
 if(id==='motion-heart'){model.motions.rows[1].enabled=false;return model;}
 delete model.effects;
 if(id==='motion-star'){
  model.motions={version:1,enabled:true,rows:[row('star-tilt','Nghiêng nhẹ quanh tâm khối',[tr('whole',[[0,{rotation:-4,y:0,easing:'ease-in-out'}],[.5,{rotation:4,y:-.67,easing:'ease-in-out'}],[1,{rotation:-4,y:0}]])],3200)]};return model;
 }
 if(id==='motion-gift'){
  model.motions={version:1,enabled:true,rows:[row('gift-arrival','Đáp một lần rồi giữ nguyên tỉ lệ',[tr('whole',[[0,{y:-2.67,opacity:0}],[.103448,{y:-2.67,opacity:1,easing:'ease-in'}],[.496552,{y:0,opacity:1,easing:'ease-out'}],[.6,{y:-.33,opacity:1,easing:'ease-in-out'}],[.793103,{y:0,opacity:1}],[1,{y:0,opacity:1}]])],1450,1)]};return model;
 }
 // Mask copies keep every original pixel and immutable texture. Each cut is
 // inside its animated parent, so the mask moves with the material. Small
 // overlaps are confined to the stem / fabric roots beneath the front knot.
 const parts=[],mediaId=NATURAL_MEDIA_IDS[id==='motion-leaf'?'element-eucalyptus':id==='motion-ribbon'?'element-satin-bow':'element-paper-cotton'];
 if(id==='motion-leaf'){
  parts.push(group('root','Gốc cành đứng yên'),image('root-pixels','Ảnh gốc phần cuống',mediaId,'root','M0 20L10 30L17 40L23 48L29 49L34 60L50 72L100 95V100H0Z'),group('branch','Đoạn cành trên','root'),image('branch-pixels','Ảnh gốc cành giữa',mediaId,'branch','M0 0H48L50 10L57 20L64 22L73 32L100 50V95L50 72L34 60L29 48.5L23 47.5L17 39.5L10 29.5L0 19.5Z'),group('tip','Cụm lá ngọn','branch'),image('tip-pixels','Ảnh gốc phần ngọn',mediaId,'tip','M48 0H100V50.5L73 32.5L64 22.5L57 20.5L50 10.5Z'));
  model.motions={version:1,enabled:true,rows:[row('branch-sway','Cành giữa từ đốt thật',[swing('branch',1.2,.29,.47)],4800),row('tip-follow','Ngọn trễ thêm 0,2 s',[swing('tip',2,.64,.24,200)],4800)]};
 }else if(id==='motion-ribbon'){
  const specs=[['tail-left','Đuôi trái','M0 100V38L44 29L49 37L48 48L42 67L33 100Z',3,.45,.34,160],['tail-right','Đuôi phải','M48 33L53 31L61 45L77 69L87 100H49Z',-2,.51,.34,280],['ear-left','Tai trái','M0 0H48L49 31L45 38L35 39L0 45Z',.8,.46,.31,0],['ear-right','Tai phải','M49 0H100V56L58 49L51 38L48 32Z',-.8,.51,.31,0]];
  for(const [name,title,mask]of specs)parts.push(group(name,title),image(name+'-pixels','Ảnh satin '+title,mediaId,name,mask));
  parts.push(image('knot','Nút nơ đứng yên che gốc vải',mediaId,undefined,'M43 27Q49 25 53 29L55 39L48 43L43 38Z'));
  model.motions={version:1,enabled:true,rows:[row('ears-sway','Hai tai từ gốc nút',specs.slice(2).map(([name,,,a,x,y,delay])=>swing(name,a,x,y,delay)),4200),row('tails-follow','Hai đuôi mềm khác nhịp',specs.slice(0,2).map(([name,,,a,x,y,delay])=>swing(name,a,x,y,delay)),4200)]};
 }else{
  parts.push(image('inside','Mặt trong cùng chất giấy',mediaId,undefined,'M0 0H50V100H0Z'),group('fold','Nếp gấp x=50 đứng yên'),image('paper-face','Mặt giấy lật nguyên mép xé',mediaId,'fold','M49.5 0H100V100H49.5Z'),{...group('fold-shadow','Bóng mép giấy'),vector:{paths:[{d:'M50 2V98',fill:'none',stroke:'#7B6C86',strokeWidth:.5}]}});
  model.motions={version:1,enabled:true,rows:[row('paper-open','Mở một lần quanh nếp gấp',[tr('fold',[[0,{scaleX:.05,opacity:.5}],[.078947,{scaleX:.05,opacity:.5,easing:'ease-in-out'}],[.447368,{scaleX:.08,opacity:.8,easing:'ease-out'}],[.815789,{scaleX:1,opacity:1}],[1,{scaleX:1,opacity:1}]],.5,.5)],1900,1),row('paper-shadow','Bóng mép dịu khi mở hết',[tr('fold-shadow',[[0,{opacity:.4}],[.447368,{opacity:.5}],[.815789,{opacity:.1}],[1,{opacity:.1}]])],1900,1)]};
 }
 model.assembly={version:2,parts};
 return model;
}
