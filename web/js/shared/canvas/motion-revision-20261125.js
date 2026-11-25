// Revision for new insertions only. Existing documents retain their own drawings.
import {motionRow} from './motion-stack.js';
const rose='#CB7799',pink='#EFC2D6',purple='#8C71AA',ink='#7B6C86',paper='#FFF4DE',gold='#D9AC62',leaf='#9FBDA0',green='#527E68',blue='#9DBFD2',white='#FFFDF8';
const p=(d,fill='none',stroke=ink,strokeWidth=1.5)=>({d,fill,stroke,strokeWidth});
const box=(x,y,w,h,fill)=>p(`M${x} ${y}h${w}v${h}h${-w}Z`,fill);
const oval=(x,y,rx,ry,fill,stroke=ink)=>p(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0Z`,fill,stroke);
const part=(id,title,paths=[],parent)=>({id,title,anchor:{x:.5,y:.5},vector:{paths:paths.length?paths:[p('M0 0','none','none',0)]},...(parent?{parent}:{})});
const t=(target,points,x=.5,y=.5,delayMs=0)=>({target,anchor:{x,y},delayMs,frames:points.map(([at,v])=>({at,...Object.fromEntries(Object.entries(v).map(([k,n])=>[k,typeof n==='number'?(Math.round(n*1e6)/1e6||0):n]))}))});
const r=(id,title,tracks,periodMs,iterations=1,delayMs=0,kind='sway')=>({...motionRow(kind,id),title,tracks,periodMs,iterations,delayMs});
const ease='ease-in-out';
const pend=(target,angle,x=.5,y=.5,delay=0)=>t(target,[[0,{rotation:-angle,easing:ease}],[.5,{rotation:angle,easing:ease}],[1,{rotation:-angle}]],x,y,delay);
const frames=(n,fn)=>Array.from({length:n},(_,i)=>[i/(n-1),fn(i/(n-1))]);
const pose=(object,drawings)=>{object.poses=drawings.map(paths=>({paths}));object.vector=structuredClone(object.poses.at(-1));return object;};
const lookup=(e,id)=>e.parts.find(p=>p.id===id);
const set=(e,parts,rows)=>{e.parts=parts;e.rows=rows;e.assemblyVersion=2;};
export function revisePriorityMotion(entries){
 // 14: each moving glass owns its clipping cavity. The two inner rim
 // landmarks meet at (50,27.5); no water path can bridge the gap.
 {
  const e=entries[13],parts=[],body=[],water=[],angle=(Math.asin(17/Math.hypot(10,53))-Math.atan2(10,53))*180/Math.PI;
  for(const [side,c,sign]of [['left',33,1],['right',67,-1]]){
   const bowl=`M${c-10} 25H${c+10}L${c+7} 49Q${c} 59 ${c-7} 49Z`;
   parts.push(part(side,'Cụm ly '+side,[p(bowl,blue),p(`M${c} 55V78M${c-9} 80H${c+9}`,'none',ink,2)]));
   const fluid=part(side+'-cavity','Lòng chứa riêng',[],side);fluid.clip={d:bowl};parts.push(fluid);
   parts.push(part(side+'-water','Nước và mặt thoáng',[box(c-25,40,50,25,gold),p(`M${c-25} 40H${c+25}`,'none',paper,1)],side+'-cavity'));
   parts.push(part(side+'-rim','Vành trước',[p(bowl,'none',ink),p(`M${c-10} 25H${c+10}`,'none',white,1)],side));
   const points=[[0,{rotation:0,easing:ease}],[.25,{rotation:sign*angle*.9,easing:'ease-out'}],[.296875,{rotation:sign*angle}],[.325,{rotation:sign*angle}],[.375,{rotation:sign*angle*.7,easing:ease}],[.7,{rotation:0}],[1,{rotation:0}]];
   body.push(t(side,points,c/100,.78));
   water.push(t(side+'-water',[[0,{rotation:0,easing:ease}],[.25,{rotation:-sign*angle*.9}],[.296875,{rotation:-sign*angle}],[.328125,{rotation:-sign*angle}],[.4,{rotation:sign*4,easing:ease}],[.53,{rotation:-sign*2,easing:ease}],[.65,{rotation:sign*.7,easing:ease}],[.8125,{rotation:0}],[1,{rotation:0}]],c/100,.4));
  }
  set(e,parts,[r('primary','Hai vành chạm ở 0,95 s',body,3200),r('secondary','Nước bù góc trong từng lòng ly',water,3200)]);
 }
 // 25: the growing tip is a separate moving parent; leaves never inherit
 // stem scale. Shells hide the curled leaves before emergence.
 {
  const e=entries[24],stem=part('stem','Thân từ gốc đến ngọn',[p('M50 78Q46 57 50 39','none',green,2.5)]);
  pose(stem,[[p('M50 78Q50 77 50 74','none',green,2.5)],[p('M50 78Q46 57 50 39','none',green,2.5)]]);
  const left=part('left','Lá trái có cuống',[p('M50 39Q29 18 25 28Q32 43 50 39Z',leaf,green,1)],'tip');
  const right=part('right','Lá phải có cuống',[p('M50 39Q71 18 75 28Q68 43 50 39Z',leaf,green,1)],'tip');
  const parts=[stem,part('tip','Ngọn mang hai lá',[]),left,right,part('shell-left','Nửa vỏ trái',[p('M50 66Q27 57 28 77L48 84Z',gold)]),part('shell-right','Nửa vỏ phải',[p('M50 66Q73 57 72 77L52 84Z',gold)])];
  const growth=[[0,{pose:0}],[.152778,{pose:0,easing:'ease-out'}],[.680556,{pose:1}],[1,{pose:1}]];
  set(e,parts,[r('primary','Vỏ mở trước, ngọn vươn sau',[t('shell-left',[[0,{rotation:0,easing:ease}],[.236111,{rotation:-25}],[1,{rotation:-25}]],.48,.8),t('shell-right',[[0,{rotation:0,easing:ease}],[.236111,{rotation:25}],[1,{rotation:25}]],.52,.8),t('stem',growth),t('tip',growth.map(([at,v])=>[at,{y:35*(1-v.pose),...(v.easing?{easing:v.easing}:{})}]))],3600),r('secondary','Lá cuộn theo đúng ngọn rồi mở',[t('left',[[0,{rotation:65,scaleX:.1,scaleY:.2}],[.347222,{rotation:65,scaleX:.1,scaleY:.2,easing:ease}],[.75,{rotation:0,scaleX:1,scaleY:1}],[1,{rotation:0,scaleX:1,scaleY:1}]],.5,.39),t('right',[[0,{rotation:-65,scaleX:.1,scaleY:.2}],[.397222,{rotation:-65,scaleX:.1,scaleY:.2,easing:ease}],[.8,{rotation:0,scaleX:1,scaleY:1}],[1,{rotation:0,scaleX:1,scaleY:1}]],.5,.39)],3600)]);
 }
 // 28: periodic body deformation replaces whole-object sliding. The two
 // feelers are children of the head; shell and foot stay on the leaf.
 {
  const e=entries[27],old=structuredClone(e.parts),ground=old.find(p=>p.id==='leaf')||old[0],shell=part('shell','Vỏ xoắn giữ nét gốc',structuredClone(old.find(p=>p.id==='body').vector.paths.slice(1)));
  const body=pose(part('body','Bụng mềm trên lá'),[[p('M23 68Q27 55 47 58Q61 64 70 57Q80 50 84 58Q89 72 69 75H31Q22 75 23 68Z',gold)] , [p('M23 68Q33 60 50 60Q66 66 73 57Q83 50 87 58Q92 72 69 75H31Q22 75 23 68Z',gold)]]);
  const head=part('head','Mốc đầu mang râu',[]);
  const parts=[ground,body,shell,head,part('feelers','Hai râu trên đầu',[p('M80 59 81 46M84 60 91 49','none',ink,1.6),oval(81,46,1.6,1.6,ink),oval(91,49,1.6,1.6,ink)],'head')];
  set(e,parts,[r('primary','Bụng co duỗi, chân giữ lá',[t('body',[[0,{pose:0,easing:ease}],[.323077,{pose:1,easing:ease}],[1,{pose:0}]]),t('head',[[0,{x:0,easing:ease}],[.323077,{x:3,easing:ease}],[1,{x:0}]]),t('shell',[[0,{x:0}],[.18,{x:0,easing:ease}],[.584615,{x:2,easing:ease}],[1,{x:0}]])],6500,'infinite'),r('secondary','Râu dò đường từ gốc đầu',[pend('feelers',4,.8,.59,350)],6500,'infinite')]);
 }
 // 46: a solid front lid hides the dancer until it opens. Four homologous
 // views turn only the figure; the foot and elliptical plinth never scale.
 {
  const e=entries[45],figure=(view)=>{const side=view===1||view===3,back=view===2,dx=side?(view===3?-1:1):0;return [oval(50+dx,34,side?3.4:4,4,rose),p(`M${50+dx} 38L50 51M50 43Q${side?48:39} ${back?42:39} ${side?55:38} 43M50 43Q${side?55:61} ${back?42:39} ${side?55:62} 43M50 51L50 66`,'none',ink,2),p(`M47 47Q${side?42:37} 54 ${side?42:38} 56Q50 62 ${side?58:62} 56Q${side?58:63} 54 53 47Z`,rose),p('M50 66L54 66','none',ink,1.5),oval(50+dx,back?33:30,back?3:side?1.5:.3,back?3:side?2:.3,purple,'none'),p(`M47 49Q50 ${back?46:52} 53 49`,'none',purple,.8)];};
  const dancer=pose(part('dancer','Vũ công trước, nghiêng, sau'),[figure(0),figure(1),figure(2),figure(3),figure(0)]);
  const lid=part('lid','Nắp ngoài che kín người',[p('M19 59L17 21L49 13L83 21L82 59L50 69Z',pink),p('M24 51L23 27L49 20L77 27L77 51L50 58Z',paper)]);
  set(e,[part('box','Hộp đứng vững',[p('M19 59L50 50L82 59V81L50 91L19 81Z',purple),p('M19 59L50 69L82 59M50 69V91','none',gold)]),part('lid-back','Mặt trong nắp đã mở',structuredClone(lid.vector.paths)),part('plinth','Bệ giữ phối cảnh',[oval(50,66,10,3,gold)]),dancer,lid,part('front','Mép hộp trước',[p('M19 68L50 77L82 68V81L50 91L19 81Z',purple),p('M19 68L50 77L82 68M50 77V91','none',gold)])],[r('primary','Nắp mở quanh mép sau',[t('lid-back',[[0,{opacity:0}],[.295455,{opacity:0}],[.7,{opacity:1}],[1,{opacity:1}]]),t('lid',[[0,{scaleY:1,opacity:1}],[.113636,{scaleY:1,easing:ease}],[.7,{scaleY:.12,opacity:0}],[1,{scaleY:.05,opacity:0}]],.5,.59),t('dancer',[[0,{opacity:0}],[.295455,{opacity:0}],[.4,{opacity:1}],[1,{opacity:1}]])],2200),r('secondary','Xoay bốn tư thế, chân khóa bệ',[t('dancer',[[0,{pose:0}],[.25,{pose:1}],[.5,{pose:2}],[.75,{pose:3}],[1,{pose:4}]],.5,.65)],6000,'infinite',1750)]);
 }
 // 49: the jaws have one real hinge. The punch meets the hole at (75,59),
 // then a same-colour paper disc detaches. No pre-impact hole exists.
 {
  const e=entries[48],ticket=part('ticket','Vé chưa bấm',[p('M12 43H85V76H12V65Q22 60 12 55Z',paper),p('M27 49V70M34 52H65M34 60H59M34 68H52','none',gold)]);
  set(e,[part('lower','Má dưới và lỗ nhận',[p('M44 28L50 23L77 54L79 63L70 64L66 49Z',gold),oval(75,59,4,2,ink)]),ticket,part('hole','Lỗ sau khi ép',[oval(75,59,3.5,3.5,ink)]),part('upper','Má trên và đầu đục',[p('M44 28L48 20L76 48L79 58L72 60L68 48Z',purple),oval(75,59,3.5,1.5,gold)]),part('pivot','Chốt chung',[oval(47,27,3,3,gold)]),part('disc','Mảnh giấy cùng màu vé',[oval(75,59,3.5,3.5,paper)])],[r('primary','Hai má khép đúng tâm lỗ',[t('upper',[[0,{rotation:-18}],[.270833,{rotation:-18,easing:'ease-in'}],[.416667,{rotation:0}],[.458333,{rotation:0,easing:'ease-out'}],[.6875,{rotation:-18}],[1,{rotation:-18}]],.47,.27),t('lower',[[0,{rotation:0}],[1,{rotation:0}]])],2400),r('secondary','Lỗ và mảnh giấy sau tác động',[t('hole',[[0,{opacity:0}],[.416666,{opacity:0,easing:'step-end'}],[.416667,{opacity:1}],[1,{opacity:1}]]),t('disc',[[0,{opacity:0,y:0}],[.416666,{opacity:0,y:0,easing:'step-end'}],[.416667,{opacity:1,y:0,easing:'ease-in'}],[.85,{opacity:1,y:27}],[1,{opacity:1,y:27}]],.75,.59)],2400)]);
 }
 lookup(entries[45],'lid').rest={opacity:0};
 for(const e of entries)if(e.assemblyVersion===2)for(const row of e.rows)for(const tr of row.tracks){const pp=lookup(e,tr.target);if(pp)pp.anchor={...tr.anchor};}
}
export function reviseOtherMotion(entries){
 // Wave 2: topology and physical actions.
 {
  const e=entries[2],shapes=[
   'M24 66C32 57 39 49 48 48L56 52C82 26 68 15 48 35C26 61 47 77 56 43L48 57C59 60 68 62 76 66',
   'M18 71C29 59 40 50 48 48L56 52C74 34 64 26 48 39C35 59 49 69 56 43L48 57C62 61 73 66 82 70',
   'M13 76C25 62 40 50 48 48L56 52C66 42 60 34 48 43C41 57 50 64 56 43L48 57C63 64 77 70 88 74'];
  const knot=pose(part('knot','Sợi liên tục vòng lỏng đến nút chặt'),shapes.map(d=>[p(d,'none',rose,2.5)]));
  knot.clip={d:'M0 0H100V100H0ZM49.8 48.3H54.2V51.7H49.8Z'};
  set(e,[knot,part('under-gap','Chặn đoạn đi dưới',[p('M49 48L54 53','none',paper,5)]),part('overpass','Sợi đi trên',[p('M56 43L48 57','none',rose,2.5)])],[r('primary','Hai đầu kéo và vòng thu nhỏ',[t('knot',[[0,{pose:0}],[.1875,{pose:0,easing:ease}],[.65625,{pose:1,easing:'ease-in'}],[.75,{pose:2}],[1,{pose:2}]])],3200),r('secondary','Nút giao khóa, đuôi tắt rung',[t('overpass',[[0,{rotation:0}],[.75,{rotation:0,easing:ease}],[.82,{rotation:1.5,easing:ease}],[.91,{rotation:-.5,easing:ease}],[1,{rotation:0}]],.52,.5),t('under-gap',[[0,{opacity:0}],[.62,{opacity:0}],[.75,{opacity:1}],[1,{opacity:1}]])],3200)]);
 }
 {
  const e=entries[12],parts=[part('tube','Ống pháo và vành sau',[p('M24 76L37 44L57 64Z',purple),p('M29 64L43 51M27 72L50 58','none',pink,3),oval(47,54,11,4,ink)])],bits=[];
  for(let i=0;i<6;i++){
   const name='paper-'+i,dx=(i-2.5)*5,dy=-(20+(i%3)*7),delay=.2+i*.04,apex=.78+(i%3)*.1,land=2.35+i*.08;
   parts.push(part(name,'Mảnh giấy độc lập '+(i+1),[box(45.5,52,i%2?3:2,i%2?4:8,[rose,gold,purple][i%3])]));
   const knots=frames(12,u=>{const sec=u*3;if(sec<delay)return{x:0,y:0,opacity:0,rotation:0};if(sec<apex){const q=(sec-delay)/(apex-delay);return{x:dx*q,y:dy*(2*q-q*q),opacity:1,rotation:(i%2?1:-1)*q*90};}const q=Math.min(1,(sec-apex)/(land-apex));return{x:dx+(i%2?5:-4)*q,y:dy+(27-dy)*q*q,opacity:1,rotation:(i%2?1:-1)*(90+q*100)};});
   const release=delay/3;const exact=[[0,{x:0,y:0,opacity:0,rotation:0}],[release,{x:0,y:0,opacity:0,rotation:0,easing:'step-end'}],[release+.000001,{x:0,y:0,opacity:1,rotation:0}],...knots.filter(([at])=>at>release+.000001)];bits.push(t(name,exact,.47,.54));
  }
  parts.push(part('rim-front','Vành miệng trước che lúc phóng',[p('M36 54Q47 61 58 54','none',gold,3)]));
  set(e,parts,[r('primary','Nén rồi giật ống',[t('tube',[[0,{rotation:0}],[.066667,{rotation:-3}],[.106667,{rotation:0}],[1,{rotation:0}]],.47,.54),t('rim-front',[[0,{rotation:0}],[.066667,{rotation:-3}],[.106667,{rotation:0}],[1,{rotation:0}]],.47,.54)],3000),r('secondary','Sáu quỹ đạo trọng lực riêng',bits,3000)]);
 }
 {
  const e=entries[15],medal=lookup(e,'medal');set(e,[part('ribbon-left','Băng trái gắn sau',[p('M36 53L26 85L40 78L46 89L54 57Z',rose)]),part('ribbon-right','Băng phải gắn sau',[p('M53 54L74 80L62 78L62 88L46 60Z',purple)]),medal,part('glint','Phản quang kim loại',[p('M32 24L37 24L66 64L60 65Z',white,'none')],'medal')],[r('primary','Mặt tròn nghiêng nhẹ',[pend('whole',3,.5,.43)],5800,'infinite'),r('secondary','Băng trễ, vệt sáng trên mặt',[pend('ribbon-left',3,.4,.53),pend('ribbon-right',-2,.57,.54,120),t('glint',[[0,{x:-20,opacity:0}],[.327586,{x:-20,opacity:0}],[.38,{x:0,opacity:.7}],[.413793,{x:20,opacity:0}],[1,{x:20,opacity:0}]])],5800,'infinite')]);lookup(e,'glint').clip={cx:50,cy:43,rx:23,ry:23};
 }
 {
  const e=entries[18],parts=[],tracks=[],angles=[-38,-19,0,19,38],pivot=[50,76],L=52;
  // Paper wedges interpolate homologous endpoints; every wooden rib rotates
  // rigidly about the same pin and therefore keeps its length.
  const wedge=(a,b)=>{const point=z=>[50+Math.sin(z*Math.PI/180)*L,76-Math.cos(z*Math.PI/180)*L];const A=point(a),B=point(b);return p(`M50 76L${A[0].toFixed(4)} ${A[1].toFixed(4)}Q${((A[0]+B[0])/2).toFixed(4)} ${(Math.min(A[1],B[1])-5).toFixed(4)} ${B[0].toFixed(4)} ${B[1].toFixed(4)}Z`,pink,purple,1);};
  for(let i=0;i<4;i++){const name='fold-'+i,fold=pose(part(name,'Nếp giấy '+(i+1)),[[wedge(-3+i*1.5,-1.5+i*1.5)],[wedge(angles[i],angles[i+1])]]);parts.push(fold);tracks.push(t(name,[[0,{pose:0}],[.072+i*.02,{pose:0,easing:ease}],[.62+i*.02,{pose:1}],[1,{pose:1}]]));}
  for(let i=0;i<5;i++){parts.push(part('rib-'+i,'Nan cứng '+(i+1),[p('M50 76V24','none',gold,1.4)]));tracks.push(t('rib-'+i,[[0,{rotation:-3+i*1.5}],[.072+i*.02,{rotation:-3+i*1.5,easing:ease}],[.62+i*.02,{rotation:angles[i]}],[1,{rotation:angles[i]}]],pivot[0]/100,pivot[1]/100));}
  parts.push(part('pin','Chốt quạt',[oval(50,76,3,3,gold)]),part('tassel','Tua dưới chốt',[p('M50 79V87M47 85H53L55 94H45Z',gold)]));set(e,parts,[r('primary','Năm nan giữ chiều dài, bốn nếp giấy',tracks,2500),r('secondary','Tua văng sau khi hãm',[t('tassel',[[0,{rotation:0}],[.62,{rotation:0,easing:ease}],[.76,{rotation:9,easing:ease}],[.87,{rotation:-3,easing:ease}],[1,{rotation:0}]],.5,.79)],2500)]);
 }
 {
  const e=entries[19],parts=[lookup(e,'frame'),lookup(e,'light')],tracks=[];
  for(const [name,x]of [['left',16],['right',50]]){
   const curtain=pose(part(name,'Rèm kín rồi dồn nếp'),[[p(name==='left'?'M16 21H50Q50 48 50 80H16Z':'M50 21H84V80H50Q50 48 50 21Z',rose)],[p(name==='left'?'M16 21H29Q22 48 27 80H16Z':'M71 21H84V80H73Q78 48 71 21Z',rose)]]);parts.push(curtain);tracks.push(t(name,[[0,{pose:0}],[.090323,{pose:0,easing:ease}],[.645161,{pose:1}],[1,{pose:1}]]));
   for(let j=0;j<2;j++){const xx=x+8+j*12,end=name==='left'?20+j*3:77+j*3,fold=pose(part(name+'-fold-'+j,'Nếp vải theo mép'),[[p(`M${xx} 27Q${xx-2} 52 ${xx} 78`,'none',pink,1.5)],[p(`M${end} 27Q${end-2} 52 ${end} 78`,'none',pink,1.5)]]);parts.push(fold);tracks.push(t(fold.id,[[0,{pose:0}],[.13+j*.03,{pose:0,easing:ease}],[.85+j*.025,{pose:1}],[1,{pose:1}]]));}
  }parts.push(lookup(e,'top'));set(e,parts,[r('primary','Mép rèm kéo và nếp vải dồn',tracks,3100),r('secondary','Đèn nằm sau rèm kín',[t('light',[[0,{opacity:.3}],[.090323,{opacity:.3,easing:ease}],[.741935,{opacity:1}],[1,{opacity:1}]])],3100)]);
 }
 {
  const e=entries[20],water=part('water','Gợn nước mảnh',[oval(50,79,29,5,'none',blue),oval(50,80,22,3,'none',blue)]),parts=[water],opening=[];
  for(const [id,dx,dy,color,delay]of [['outer-left',-31,-22,pink,0],['outer-right',31,-22,pink,0],['inner-left',-17,-36,rose,.3],['inner-right',17,-36,rose,.3],['center',0,-45,pink,.3]]){
   const petal=p(`M50 72Q${50+dx-12} ${72+dy} ${50+dx} ${72+dy}Q${50+dx+12} ${72+dy} 50 72Z`,color,rose,1);parts.push(part(id,'Cánh sen '+id,[petal]));opening.push(t(id,[[0,{scaleX:.2,rotation:-dx*.7,easing:ease}],[.916667,{scaleX:1,rotation:0}],[1,{scaleX:1,rotation:0}]],.5,.72,delay*1000));
  }parts.push(part('core','Nhụy che chân cánh',[oval(50,70,10,4,gold)]));set(e,parts,[r('primary','Cánh ngoài rồi cánh trong',opening,3300),r('secondary','Gợn tan hết trước khi đặt lại',[t('water',[[0,{scaleX:.55,scaleY:.55,opacity:0}],[.08,{scaleX:.6,scaleY:.6,opacity:.5}],[.9,{scaleX:1.1,scaleY:1.1,opacity:0}],[1,{scaleX:1.1,scaleY:1.1,opacity:0}]],.5,.79)],4800,'infinite')]);
 }
 {
  const e=entries[22],flower=lookup(e,'flower'),parts=[flower],tracks=[];
  const roots=[[40,24],[50,27],[53,39]],release=[.55,.9,1.35];
  for(let i=0;i<3;i++){const [x,y]=roots[i],id='seed-'+i;parts.push(part(id,'Hạt còn gắn rồi rời',[p(`M${x} ${y}L40 39M${x} ${y}l-4-3m4 3 5-2m-5 2 0-6`,'none',ink,1)]));tracks.push(t(id,[[0,{x:0,y:0,rotation:0}],[release[i]/4.6,{x:0,y:0,rotation:0,easing:'ease-out'}],[.6+i*.06,{x:20+i*4,y:-12+i*7,rotation:12+i*10,easing:'ease-in-out'}],[1,{x:25+i*4,y:-7+i*10,rotation:19+i*8}]],x/100,y/100));}
  set(e,parts,[r('primary','Ba hạt rời ở 0,55 / 0,90 / 1,35 s',tracks,4600),r('secondary','Cuống hồi sau lần nhả cuối',[t('flower',[[0,{rotation:0}],[.293478,{rotation:0,easing:ease}],[.45,{rotation:-2,easing:ease}],[.65,{rotation:1,easing:ease}],[1,{rotation:0}]],.36,.85)],4600)]);
 }
 {
  const e=entries[23],leafPart=lookup(e,'leaf'),drop=pose(part('dew','Giọt lăn, cổ kéo rồi rời'),[[p('M78 38Q73 42 72 46Q67 50 78 54Q89 50 84 46Q83 42 78 38Z',blue)],[p('M78 38Q76 46 74 52Q68 64 78 64Q88 64 82 52Q80 46 78 38Z',blue)],[p('M78 46Q73 48 71 52Q64 55 78 64Q92 55 85 52Q83 48 78 46Z',blue)]]);
  set(e,[leafPart,drop],[r('primary','Lăn tới mép rồi rơi khỏi cảnh',[t('dew',[[0,{x:-25,y:-6,pose:0,opacity:1,easing:ease}],[.390625,{x:0,y:0,pose:0}],[.515625,{x:0,y:0,pose:1}],[.53125,{x:0,y:0,pose:2,easing:'ease-in'}],[.734375,{x:0,y:32,pose:2,opacity:0}],[1,{x:0,y:32,pose:2,opacity:0}]])],3200),r('secondary','Lá bật khi giọt đã rời',[t('leaf',[[0,{rotation:0}],[.53125,{rotation:0,easing:ease}],[.64,{rotation:-4,easing:ease}],[.83,{rotation:1,easing:ease}],[1,{rotation:0}]],.15,.72)],3200)]);drop.rest={opacity:0};
 }
 {
  const e=entries[28],parts=[lookup(e,'frame'),lookup(e,'flowers')],tracks=[];
  for(const [id,x,sign]of [['left',20,1],['right',80,-1]]){const end=x+sign*30,outer=x-sign*16;parts.push(part(id,'Cửa xoay quanh bản lề',[p(`M${x} 22L${outer} 27V76L${x} 80Z`,green),p(`M${x-sign*3} 36H${outer+sign*3}M${x-sign*3} 48H${outer+sign*3}M${x-sign*3} 60H${outer+sign*3}`,'none',leaf,1)]));tracks.push(t(id,[[0,{scaleX:1.875}],[.08,{scaleX:1.875,easing:ease}],[.5,{scaleX:.05,easing:ease}],[.86,{scaleX:1}],[1,{scaleX:1}]],x/100,.5));
   // A homologous pose moves the free edge through the hinge without ever
   // translating the hinge. The edge strip remains at the same x.
   const door=parts.at(-1);pose(door,[[p(`M${x} 22L${end} 22V80L${x} 80Z`,green),p(`M${x+sign*3} 36H${end-sign*3}M${x+sign*3} 48H${end-sign*3}M${x+sign*3} 60H${end-sign*3}`,'none',leaf,1)],structuredClone(door.vector.paths)]);tracks.at(-1).frames=[[0,{pose:0}],[.08,{pose:0,easing:ease}],[.86,{pose:1}],[1,{pose:1}]].map(([at,v])=>({at,...v}));parts.push(part(id+'-edge','Bề dày và chốt cửa',[p(`M${x} 22V80`,'none',gold,2),oval(x,28,1.5,2,gold),oval(x,74,1.5,2,gold)]));}
  set(e,parts,[r('primary','Mở hai cánh với cạnh gắn cố định',tracks,2500),r('secondary','Hoa sau cửa đón gió',[pend('flowers',2,.51,.78)],6800,'infinite',200)]);
 }
 {
  const e=entries[31],head=lookup(e,'head'),tail=pose(part('tail','Lụa cổ cố định, ngọn trễ'),[[-2,3],[3,-3],[-2,3]].map(([a,b])=>[p(`M63 34C51 ${48+a} 32 ${65+b} 14 ${71+b}C34 ${61+a} 47 ${43+b} 63 30Z`,pink),p(`M63 33C48 ${50+a} 38 ${59+b} 24 ${61+b}`,'none',purple,2)]));tail.parent='head';set(e,[head,tail],[r('primary','Sao đi theo đường cong kín',[t('head',frames(13,u=>({x:5*Math.sin(u*Math.PI*2),y:2*(1-Math.cos(u*Math.PI*2))})))],6200,'infinite'),r('secondary','Đuôi thay độ cong, cổ nằm dưới sao',[t('tail',[[0,{pose:0,easing:ease}],[.5,{pose:1,easing:ease}],[1,{pose:2}]])],6200,'infinite',120)]);
  // Head must paint in front of the child tail at the same attachment.
  const overlay=part('head-front','Đầu sao che cổ lụa',structuredClone(head.vector.paths),'head');e.parts.push(overlay);
 }
 {
  const e=entries[33],moon=lookup(e,'moon'),hammock=pose(part('hammock','Hai dây khóa móc, vải võng biến dạng'),[-3,3,-3].map(dx=>[p(`M39 34L${44+dx} 63Q${58+dx} 77 ${76+dx} 57L80 30M${44+dx} 63Q${61+dx} 65 ${76+dx} 57`,'none',purple,2)]));
  set(e,[moon,hammock,part('hooks','Hai móc đứng yên',[oval(39,34,2,2,gold),oval(80,30,2,2,gold)]),part('bottom','Điểm đáy mang dây sao'),part('star','Sao dưới đáy',structuredClone(lookup(e,'star').vector.paths),'bottom')],[r('primary','Vải võng đổi cong giữa hai móc',[t('hammock',[[0,{pose:0,easing:ease}],[.5,{pose:1,easing:ease}],[1,{pose:2}]]),t('bottom',[[0,{x:-3,easing:ease}],[.5,{x:3,easing:ease}],[1,{x:-3}]])],6200,'infinite'),r('secondary','Sao trễ từ đúng đáy võng',[pend('star',6,.61,.69,250)],6200,'infinite')]);
 }
 {
  const e=entries[37],parts=[lookup(e,'glass')],snow=[];
  for(let i=0;i<6;i++){if(i===3)parts.push(lookup(e,'tree'));const x=32+(i%3)*17,y=30+Math.floor(i/3)*15,id='snow-'+i,pt=part(id,'Hạt tuyết '+(i+1),[oval(x,y,i%2?1.6:1.2,i%2?1.6:1.2,white)]);pt.clip={cx:50,cy:43,rx:29,ry:29};parts.push(pt);snow.push(t(id,[[0,{x:0,y:0}],[.137931+i*.01,{x:(i%2?3:-3),y:-4,easing:'ease-in'}],[(3.2+i*.45)/5.8,{x:(i%2?5:-4),y:Math.min(35,67-y)}],[1,{x:(i%2?5:-4),y:Math.min(35,67-y)}]],x/100,y/100));}
  parts.push(lookup(e,'shine'),lookup(e,'base'));set(e,parts,[r('primary','Sáu hạt rơi và lắng độc lập',snow,5800),r('secondary','Ánh kính nhỏ',[t('shine',[[0,{opacity:.6,easing:ease}],[.5,{opacity:.9,easing:ease}],[1,{opacity:.6}]])],7600,'infinite')]);
 }
 {
  const e=entries[39];for(const [index,id]of ['band-a','band-b'].entries()){
   const d=lookup(e,id),y=index?54:35,color=index?purple:leaf;
   pose(d,Array.from({length:5},(_,i)=>{const phase=i*Math.PI/2,ys=Array.from({length:4},(_,j)=>Math.round((y+4*Math.sin(phase-j*Math.PI/2))*1000)/1000);return[p(`M16 ${y}C26 ${ys[0]-9} 34 ${ys[1]-9} 44 ${y}C54 ${ys[2]+9} 70 ${ys[3]+9} 84 ${y}L84 ${y+11}C70 ${ys[3]+20} 54 ${ys[2]+20} 44 ${y+11}C34 ${ys[1]+2} 26 ${ys[0]+2} 16 ${y+11}Z`,color,'none')];}));d.clip={d:'M12 20Q50 7 88 20V80Q50 91 12 80Z'};
  }e.assemblyVersion=2;e.rows=[r('primary','Đỉnh sóng lan dọc hai dải',[t('band-a',[[0,{pose:0}],[.25,{pose:1}],[.5,{pose:2}],[.75,{pose:3}],[1,{pose:4}]]),t('band-b',[[0,{pose:0}],[.25,{pose:1}],[.5,{pose:2}],[.75,{pose:3}],[1,{pose:4}]],.5,.5,1200)],10000,'infinite'),r('secondary','Sao xa dịu',[t('stars',[[0,{opacity:.65,easing:ease}],[.5,{opacity:1,easing:ease}],[1,{opacity:.65}]])],8500,'infinite')];
 }
 {
  const e=entries[47];lookup(e,'upper').clip={d:'M29 21H71Q69 39 50 49Q31 39 29 21Z'};lookup(e,'lower').clip={d:'M50 51Q69 62 71 79H29Q31 62 50 51Z'};
  e.assemblyVersion=2;e.rows=[r('primary','Cát chuyển cùng tiến độ diện tích',[t('upper',[[0,{scaleY:1,easing:'linear'}],[.933333,{scaleY:.1}],[1,{scaleY:.05}]],.5,.47),t('lower',[[0,{scaleY:.05}],[.933333,{scaleY:.95}],[1,{scaleY:1}]],.5,.75)],9000),r('secondary','Tia ngừng cùng lúc cát cạn',[t('stream',[[0,{opacity:0,draw:0}],[.033333,{opacity:1,draw:1}],[.933333,{opacity:1,draw:1}],[.999,{opacity:0,draw:1}],[1,{opacity:0,draw:1}]])],9000)];
  // Meaningful reduced-motion pose: lower bulb full and upper/stream empty.
  lookup(e,'upper').rest={opacity:0};lookup(e,'stream').rest={opacity:0};e.rows[0].tracks[0].frames.forEach(f=>f.opacity=f.at===1?0:1);
 }
 for(const e of entries)if(e.assemblyVersion===2)for(const row of e.rows)for(const tr of row.tracks){const pp=lookup(e,tr.target);if(pp)pp.anchor={...tr.anchor};}
}
export function refineMotion(entries){
 // Wave 3: local joints and material response. Wave 4 is included here so
 // the timing primitives used by preserved mechanisms remain consistent.
 {
  const e=entries[0];
  // Exact extremum of the original cubic heart, measured in the 100 board.
  const half=14.814814814815*.85,meet=(20-2*half)/2;
  e.rows=[r('primary','Hai cung đến cùng mép chạm',[t('left',[[0,{x:-12,y:0,easing:ease}],[.2,{x:-8,y:-3,easing:ease}],[.4,{x:meet,y:0}],[.453333,{x:meet,y:0,easing:ease}],[.7,{x:-8,y:3,easing:ease}],[1,{x:-12,y:0}]]),t('right',[[0,{x:12,y:-2,easing:ease}],[.2,{x:8,y:1,easing:ease}],[.4,{x:-meet,y:-2}],[.453333,{x:-meet,y:-2,easing:ease}],[.7,{x:8,y:-5,easing:ease}],[1,{x:12,y:-2}]])],6000,'infinite'),r('secondary','Nén và hồi cùng khoảnh khắc',[...['left','right'].map((id,i)=>t(id,[[0,{scaleX:1,scaleY:1}],[.4,{scaleX:1,scaleY:1}],[.42,{scaleX:.97,scaleY:1.02,easing:ease}],[.453333,{scaleX:1.04,scaleY:1.04,easing:ease}],[.5,{scaleX:1,scaleY:1}],[1,{scaleX:1,scaleY:1}]],i?.6:.4,i?.52:.5))],6000,'infinite')];
 }
 {
  const e=entries[1];lookup(e,'glint').parent='ring';lookup(e,'glint').clip={d:'M34 32L43 22H57L66 32L50 44Z'};e.assemblyVersion=2;
  e.rows=[r('primary','Khối đai đá nghiêng chung',[pend('ring',5,.5,.55)],6000,'infinite'),r('secondary','Phản quang cùng pha góc nghiêng',[t('glint',[[0,{opacity:0,x:-2}],[.45,{opacity:0,x:-2}],[.475,{opacity:.8,x:0}],[.55,{opacity:0,x:2}],[1,{opacity:0,x:2}]])],6000,'infinite')];lookup(e,'glint').rest={opacity:0};
 }
 {
  const e=entries[3],body=lookup(e,'body'),shackle=lookup(e,'shackle'),key=lookup(e,'key');
  body.vector.paths=[box(23,48,37,30,gold),oval(46,65,3,3,ink),p('M45 66L44 71H48L47 66Z',ink)];
  key.vector.paths=[oval(66,45,7,7,gold),p('M62 49L46 65M50 61L54 65M54 57L58 61','none',gold,4)];key.clip={d:'M0 0H100V100H0ZM41 62H49V76H41Z'};
  const front=part('key-slot-front','Mặt ổ che răng chìa',[p('M40 67H49V77H40Z',gold)]);
  set(e,[body,shackle,key,front],[r('primary','Chìa tra rồi vặn quanh tâm ổ',[t('key',[[0,{x:12,y:-12,rotation:0,easing:ease}],[.288462,{x:0,y:0,rotation:0}],[.334615,{x:0,y:0,rotation:0,easing:ease}],[.546154,{x:0,y:0,rotation:75}],[1,{x:0,y:0,rotation:75}]],.46,.65)],2600),r('secondary','Quai chỉ nhả sau góc mở',[t('shackle',[[0,{y:8}],[.557692,{y:8,easing:'ease-out'}],[.7,{y:1,easing:ease}],[.8,{y:2}],[1,{y:2}]])],2600)]);
 }
 {
  const e=entries[4];e.keywords=e.vi+' Photo locket';e.vi='Mặt dây chuyền trái tim';e.en='Heart locket';
  lookup(e,'lid').vector.paths=[oval(17,64,16,22,gold),oval(17,64,12,18,paper)];e.parts.push(part('hinge-pin','Chốt mặt dây',[p('M33 57V71','none',gold,3)]));
  // Lid geometry is drawn to the left of x33; a homologous closed pose
  // places it on the right, through a thin edge, around the fixed hinge.
  const lid=lookup(e,'lid');pose(lid,[[oval(49,64,16,22,gold),oval(49,64,12,18,paper)],[oval(33,64,.25,22,gold),oval(33,64,.15,18,paper)],[oval(17,64,16,22,gold),oval(17,64,12,18,paper)]]);
  e.assemblyVersion=2;e.rows=[r('primary','Mở quanh cạnh chốt cố định',[t('lid',[[0,{pose:0}],[.111111,{pose:0,easing:ease}],[.527778,{pose:1,easing:ease}],[.861111,{pose:2}],[1,{pose:2}]],.33,.64)],1800),r('secondary','Đu đưa tại điểm treo',[pend('whole',2.5,.5,.13)],6800,'infinite')];
 }
 {
  const e=entries[5],body=[];
  for(const [id,sign,x]of [['left',1,.31],['right',-1,.69]])body.push(t(id,[[0,{rotation:0}],[.135417,{rotation:-sign*3,easing:'ease-in'}],[.239583,{rotation:sign*18.530471}],[.25625,{rotation:sign*18.530471,easing:'ease-out'}],[.35,{rotation:sign*8,easing:ease}],[.75,{rotation:0}],[1,{rotation:0}]],x,.7));
  for(const [steam,parent,x]of [['steam-a','left',31],['steam-b','right',69]]){const pp=lookup(e,steam);pp.parent=parent;pose(pp,[-3,3,-3].map(dx=>[p(`M${x} 49C${x-10+dx} 35 ${x+10+dx} 30 ${x+dx} 19`,'none',parent==='left'?rose:purple,1.6)]));}
  e.assemblyVersion=2;e.rows=[r('primary','Miệng tách chạm chung tại 1,15 s',body,4800,'infinite'),r('secondary','Gốc hơi theo miệng, ngọn trôi trễ',[t('steam-a',[[0,{pose:0,easing:ease}],[.5,{pose:1,easing:ease}],[1,{pose:2}]]),t('steam-b',[[0,{pose:0,easing:ease}],[.5,{pose:1,easing:ease}],[1,{pose:2}]],.5,.5,350)],4800,'infinite')];
 }
 {
  const e=entries[6];e.rows=[r('primary','Mực đọc trái sang phải, xong ở 2,2 s',[t('ink',[[0,{draw:0}],[.6875,{draw:1}],[1,{draw:1}]])],3200),r('secondary','Tim nở sau mực 0,1 s',[t('heart',[[0,{scaleX:1,scaleY:1}],[.71875,{scaleX:1,scaleY:1,easing:ease}],[.775,{scaleX:1.12,scaleY:1.12,easing:ease}],[.88125,{scaleX:1,scaleY:1}],[1,{scaleX:1,scaleY:1}]],.73,.51)],3200)];
 }
 {
  const e=entries[7];e.keywords=e.vi+' Dove with olive branch';e.vi='Bồ câu mang nhành lá';e.en='Dove carrying an olive branch';lookup(e,'branch').vector.paths[0]=p('M76 47Q79 55 84 61','none',green,2);lookup(e,'branch').anchor={x:.76,y:.47};
  e.rows=[r('primary','Chân đáp, thân nhún rồi cánh khép',[t('body',[[0,{y:-6,easing:'ease-in'}],[.333333,{y:0,easing:'ease-out'}],[.4,{y:1,easing:ease}],[.56,{y:0}],[1,{y:0}]]),t('wing',[[0,{rotation:30}],[.333333,{rotation:22,easing:ease}],[.645833,{rotation:0}],[1,{rotation:0}]],.4,.5)],2400),r('secondary','Cành còn giữ ở mỏ sau cú đáp',[t('branch',[[0,{rotation:0}],[.383333,{rotation:0,easing:ease}],[.5,{rotation:7,easing:ease}],[.7,{rotation:-2,easing:ease}],[.916667,{rotation:0}],[1,{rotation:0}]],.76,.47)],2400)];
 }
 {
  const e=entries[8];e.rows=[r('primary','Sao hãm mềm trong lọ',[t('star',[[0,{y:3,easing:ease}],[.5,{y:-3,easing:ease}],[1,{y:3}]])],6200,'infinite'),r('secondary','Phản chiếu bám thành kính',[t('glass',[[0,{opacity:.45,easing:ease}],[.5,{opacity:.9,easing:ease}],[1,{opacity:.45}]],.5,.5,150)],6200,'infinite')];
 }
 {
  const e=entries[9];e.rows=[r('primary','Hai mép ráp cùng một biên',[t('left',[[0,{x:-10,rotation:0,easing:ease}],[.589286,{x:0,rotation:0}],[1,{x:0,rotation:0}]]),t('right',[[0,{x:10,rotation:0,easing:ease}],[.589286,{x:0,rotation:0}],[1,{x:0,rotation:0}]])],2800),r('secondary','Lóe chỉ sau lúc đã vào khớp',[t('seam',[[0,{opacity:0}],[.589286,{opacity:0}],[.66,{opacity:1}],[.732143,{opacity:0}],[1,{opacity:0}]])],2800)];e.assemblyVersion=2;lookup(e,'seam').rest={opacity:0};
 }
 {
  const e=entries[10];e.parts=e.parts.filter(p=>p.id!=='ribbon');e.parts.push(part('knot','Nút buộc bóng',[oval(50,58,2,2,rose)],'balloon'),part('ears','Hai tai nơ',[p('M50 60Q30 48 38 66Z M50 60Q69 49 63 66Z',rose)],'knot'));
  const string=pose(part('string','Dây có gốc và đầu tự do',[],'knot'),[-4,4,-4].map(dx=>[p(`M50 58C48 68 ${57+dx} 75 ${49+dx} 88`,'none',purple,1.6)]));e.parts.push(string);e.assemblyVersion=2;e.rows=[r('primary','Bóng dẫn nhịp nâng hạ',[t('balloon',[[0,{y:2,easing:ease}],[.5,{y:-2,easing:ease}],[1,{y:2}]])],6000,'infinite'),r('secondary','Tai và đầu dây theo sau',[pend('ears',3,.5,.58,120),t('string',[[0,{pose:0,easing:ease}],[.5,{pose:1,easing:ease}],[1,{pose:2}]],.5,.58,350)],6000,'infinite')];
 }
 {
  const e=entries[11],flame=lookup(e,'flame');pose(flame,[-2,3,-1,-2].map(dx=>[p(`M50 36C36 30 ${48+dx} 19 ${51+dx} 12C${53+dx} 22 63 29 50 36Z`,gold)]));lookup(e,'halo').vector.paths=[oval(50,27,14,16,paper,'none'),oval(50,27,10,12,paper,'none'),oval(50,27,6,8,paper,'none')];e.assemblyVersion=2;e.rows=[r('primary','Chân lửa cố định, ngọn thay dáng',[t('flame',[[0,{pose:0,easing:ease}],[.25,{pose:1,easing:ease}],[.65,{pose:2,easing:ease}],[1,{pose:3}]],.5,.36)],2800,'infinite'),r('secondary','Quầng dịu theo cường độ lửa',[t('halo',[[0,{opacity:.1,easing:ease}],[.25,{opacity:.14,easing:ease}],[.65,{opacity:.11,easing:ease}],[1,{opacity:.1}]],.5,.27,120)],2800,'infinite')];
 }
 {
  const e=entries[14];lookup(e,'tassel').vector.paths=[p('M77 49C78 56 74 64 77 70','none',gold,2),p('M73 68H81L83 80H71Z',gold)];e.parts.push(part('button','Nút và dây sát mũ',[oval(50,43,2,2,gold),p('M50 43L77 49','none',gold,2)]));
  e.rows=[r('primary','Cung tung trọng lực, đỉnh 1,05 s',[t('whole',frames(16,u=>{const sec=u*3.2;if(sec<.2)return{x:0,y:0,rotation:0};if(sec<1.95){const q=(sec-.2)/1.75;return{x:3*Math.sin(q*Math.PI),y:-14*4*q*(1-q),rotation:10*Math.sin(q*Math.PI)};}return{x:0,y:0,rotation:0};}))],3200),r('secondary','Đoạn tua buông trễ sau đỉnh',[t('tassel',[[0,{rotation:0}],[.125,{rotation:0,easing:ease}],[.4,{rotation:16,easing:ease}],[.68,{rotation:-7,easing:ease}],[.9,{rotation:0}],[1,{rotation:0}]],.77,.49)],3200)];
 }
 {
  const e=entries[16];e.rows=[r('primary','Trục quay đều 11 s',[t('blades',[[0,{rotation:0}],[1,{rotation:360}]],.5,.44)],11000,'infinite',0,'spin'),r('secondary','Que và tâm cánh cùng khối',[pend('whole',2,.5,.88)],7200,'infinite')];
 }
 {
  const e=entries[17];lookup(e,'stick-a').vector.paths=[p('M25 23L38 51','none',gold,3),oval(38,51,3,3,purple)];lookup(e,'stick-b').vector.paths=[p('M75 23L62 51','none',gold,3),oval(62,51,3,3,purple)];e.parts=e.parts.filter(p=>p.id!=='head').concat([part('head','Mặt trống vững',[oval(50,53,30,10,paper)]),part('hit-a','Lún bên trái',[p('M33 54Q38 57 43 54','none',rose,1.3)]),part('hit-b','Lún bên phải',[p('M57 54Q62 57 67 54','none',rose,1.3)])]);
  // Place the face beneath sticks, and strokes only after their own strike.
  e.parts.sort((a,b)=>(a.id==='body'?-3:a.id==='head'?-2:0)-(b.id==='body'?-3:b.id==='head'?-2:0));
  const beat=(id,sign,hit)=>t(id,[[0,{rotation:-sign*18}],[hit-.066667,{rotation:-sign*18,easing:'ease-in'}],[hit,{rotation:0}],[hit+.020833,{rotation:0,easing:'ease-out'}],[hit+.104167,{rotation:-sign*18}],[1,{rotation:-sign*18}]],id==='stick-a'?.25:.75,.23);
  e.rows=[r('primary','Đầu dùi chạm trái 0,45 / phải 1,65 s',[beat('stick-a',1,.1875),beat('stick-b',-1,.6875)],2400,'infinite'),r('secondary','Mặt chỉ đáp ứng đúng điểm gõ',[t('hit-a',[[0,{opacity:0}],[.1875,{opacity:0}],[.208333,{opacity:1}],[.29,{opacity:0}],[1,{opacity:0}]]),t('hit-b',[[0,{opacity:0}],[.6875,{opacity:0}],[.708333,{opacity:1}],[.79,{opacity:0}],[1,{opacity:0}]])],2400,'infinite')];e.assemblyVersion=2;lookup(e,'hit-a').rest={opacity:0};lookup(e,'hit-b').rest={opacity:0};
 }
 {
  const e=entries[21];lookup(e,'flower').parent='stem';lookup(e,'body').parent='flower';lookup(e,'wing-a').parent='body';lookup(e,'wing-b').parent='body';e.parts=[lookup(e,'stem'),lookup(e,'flower'),lookup(e,'body'),lookup(e,'wing-b'),lookup(e,'wing-a')];
  e.rows=[r('primary','Cánh quanh gốc trên thân bướm',[t('wing-a',[[0,{scaleX:1,easing:ease}],[.25,{scaleX:.3,easing:ease}],[.5,{scaleX:1,easing:ease}],[.75,{scaleX:.3,easing:ease}],[1,{scaleX:1}]],.62,.39),t('wing-b',[[0,{scaleX:.8,easing:ease}],[.25,{scaleX:.2,easing:ease}],[.5,{scaleX:.8,easing:ease}],[.75,{scaleX:.2,easing:ease}],[1,{scaleX:.8}]],.62,.39)],4800,'infinite'),r('secondary','Cuống mang cả hoa và chân bướm',[pend('stem',3,.46,.82,120)],4800,'infinite')];
 }
 {
  const e=entries[25],book=lookup(e,'book'),petal=lookup(e,'petal'),corner=lookup(e,'corner');
  const cover=part('page-front','Mép trang che phần cánh mắc',[p('M49 52Q70 44 88 48V79Q66 72 49 82Z',paper),p('M49 52Q70 44 88 48','none',gold,1)]);
  e.parts=[book,petal,cover,corner];pose(corner,[[p('M69.25 47Q80 45 88 48V62Z',paper)],[p('M69.25 47Q80 36 88 48V62Z',paper)],[p('M69.25 47Q80 45 88 48V62Z',paper)]]);e.assemblyVersion=2;
  e.rows=[r('primary','Cánh hoa trượt giữa hai lớp giấy',[t('petal',[[0,{y:14}],[.116667,{y:14,easing:'ease-out'}],[.55,{y:0}],[1,{y:0}]])],3000),r('secondary','Giấy uốn tại chỗ cánh đi qua',[t('corner',[[0,{pose:0}],[.116667,{pose:0,easing:ease}],[.4,{pose:1,easing:ease}],[.883333,{pose:2}],[1,{pose:2}]])],3000)];
 }
 {
  const e=entries[26],jar=lookup(e,'jar'),parts=[jar],tracks=[],glows=[];
  for(let i=0;i<2;i++){const id='firefly-'+i,x=i?60:42,y=i?55:49;parts.push(part(id,'Đom đóm có lõi và quầng',[oval(x,y,5-i,5-i,gold,'none'),oval(x,y,1.5,1.5,paper,'none')]));tracks.push(t(id,frames(13,u=>({x:(i?8:10)*Math.cos(u*Math.PI*2),y:(i?10:13)*Math.sin(u*Math.PI*2)})),x/100,y/100));glows.push(t(id,[[0,{opacity:.55,easing:ease}],[.2,{opacity:1,easing:ease}],[.6,{opacity:.55}],[1,{opacity:.55}]],x/100,y/100));}
  e.parts=parts;e.rows=[r('primary','Đom đóm gần đường cong kín',[tracks[0],glows[0]],6400,'infinite'),r('secondary','Đom đóm xa đường cong kín',[tracks[1],glows[1]],8000,'infinite')];
 }
 {
  const e=entries[29],grass=lookup(e,'grass');if(grass){e.parts=e.parts.filter(p=>p.id!=='grass');e.parts.push(part('grass-left','Cỏ trái có chân',[p('M16 86Q10 77 16 72M16 86Q23 77 23 73','none',green,2)]),part('grass-right','Cỏ phải có chân',[p('M78 87Q74 77 80 72M78 87Q85 77 88 75','none',green,2)]));}else{e.parts.push(part('grass-left','Cỏ trái có chân',[p('M16 86Q10 77 16 72M16 86Q23 77 23 73','none',green,2)]),part('grass-right','Cỏ phải có chân',[p('M78 87Q74 77 80 72M78 87Q85 77 88 75','none',green,2)]));}
  e.rows[0].periodMs=15000;e.rows[0].kind='spin';e.rows[1]=r('secondary','Ngọn cỏ uốn quanh chân riêng',[pend('grass-left',5,.16,.86),pend('grass-right',-4,.78,.87,220)],7500,'infinite');
 }
 {
  const e=entries[30];
  // The existing contiguous line is retained; individual stars are lit in
  // actual cumulative-distance order in the same drawing clock.
  const points=[[20,65],[38,31],[65,45],[81,23]],d='M20 65L38 31L65 45L81 23',lengths=[0];for(let i=1;i<4;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const oldStars=points.map((_,i)=>structuredClone(lookup(e,'star-'+i).vector.paths));e.parts=[part('line','Một đường nối sao',[p(d,'none',blue,1.5)]),...points.map(([x,y],i)=>part('star-'+i,'Sao theo đầu nét',oldStars[i]))];
  e.rows=[r('primary','Đầu nét đọc xuyên suốt',[t('line',[[0,{draw:0}],[.097222,{draw:0}],[.791667,{draw:1}],[1,{draw:1}]])],3600),r('secondary','Sao sáng khi đầu nét tới',points.map((_,i)=>{const at=i===0?.05:.097222+lengths[i]/lengths[3]*.694445;return t('star-'+i,[[0,{opacity:.35}],[Math.max(.001,at-.001),{opacity:.35}],[at,{opacity:1,easing:ease}],[Math.min(.99,at+.069444),{opacity:.65}],[1,{opacity:.65}]]);}),3600)];void oldStars;
 }
 {
  const e=entries[32],planet=lookup(e,'planet'),bands=lookup(e,'bands'),sat=lookup(e,'satellite'),ring=lookup(e,'ring');
  const back=part('ring-back','Vành sau',[p('M17 48C10 23 91 26 85 50','none',gold,3)]),far=part('satellite-back','Vệ tinh pha sau',[oval(50,48,4,4,gold)]),near=part('satellite-front','Vệ tinh pha trước',[oval(50,48,4,4,gold)]);bands.parent='planet';bands.clip={cx:50,cy:48,rx:24,ry:24};
  e.parts=[back,far,planet,bands,near,ring];
  const orbit=[...new Set([...Array.from({length:13},(_,i)=>i/12),.499999,.999999])].sort((a,b)=>a-b).map(u=>[u,{x:28*Math.cos(u*Math.PI*2),y:12*Math.sin(u*Math.PI*2),opacity:u<.5||u===1?1:0}]);
  const reversed=orbit.map(([at,v])=>[at,{...v,opacity:1-v.opacity}]);
  e.rows=[r('primary','Vân nằm trong hình cầu',[t('bands',[[0,{x:-2,easing:ease}],[.5,{x:2,easing:ease}],[1,{x:-2}]])],9000,'infinite'),r('secondary','Vệ tinh elip đổi lớp khi khuất',[t('satellite-front',orbit),t('satellite-back',reversed)],9000,'infinite')];e.assemblyVersion=2;void sat;
 }
 {
  const e=entries[34];e.rows[0].periodMs=3800;for(const tr of e.rows[0].tracks){tr.delayMs=Math.min(720,tr.delayMs);tr.frames=[{at:0,draw:0},{at:.657895,draw:1},{at:1,draw:1}];}e.rows[1]=r('secondary','Mây hãm và tiếp tục che chân cung',[t('cloud-left',[[0,{x:0}],[.105263,{x:0,easing:ease}],[.763158,{x:-2}],[1,{x:-2}]]),t('cloud-right',[[0,{x:0}],[.105263,{x:0,easing:ease}],[.763158,{x:2}],[1,{x:2}]])],3800);for(const p of e.parts.filter(p=>p.id.startsWith('arc-')))p.clip={x:10,y:10,width:80,height:62};
 }
 {
  const e=entries[35];e.rows=[r('primary','Thân lắc mềm, qua giữa liên tục',[pend('body',4,.5,.1)],6800,'infinite'),r('secondary','Tua giữ khớp và theo sau',[pend('tassel',8,.5,.73,400)],6800,'infinite')];
 }
 {
  const e=entries[36],basket=lookup(e,'basket'),balloon=lookup(e,'balloon');e.rows[0]=r('primary','Khí cầu nhô lên rồi hãm',[t('balloon',[[0,{y:13,easing:ease}],[.777778,{y:0}],[1,{y:0}]])],3600);e.rows[1]=r('secondary','Giỏ phản ứng sau lực nâng',[pend('basket',1.5,.5,.65,180)],6000,'infinite');
  if(basket)basket.parent='balloon';const cloud=e.parts.find(p=>p.id.includes('cloud'));if(cloud)cloud.vector.paths=[p('M9 88C4 75 16 67 25 74C31 66 40 73 41 82Q52 91 62 82C68 73 79 71 85 78Q98 78 92 90Z',white)];
  // Suspend the full basket and both ropes as one rigid assembly, avoiding
  // rope endpoint drift when it responds to the lift.
  if(basket&&balloon){basket.anchor={x:.5,y:.65};}
 }
 {
  const e=entries[38];lookup(e,'beam').vector.paths=[p('M50 31L89 18V49Z',gold,'none')];e.rows=[r('primary','Tia quét mềm qua giữa',[pend('beam',12,.5,.31)],8000,'infinite'),r('secondary','Sóng nền dịu',[t('waves',[[0,{x:-2,easing:ease}],[.5,{x:2,easing:ease}],[1,{x:-2}]])],6600,'infinite')];
 }
 {
  const e=entries[40],curve='M22 66C25 62 35 44 29 42C21 40 22 69 31 67C37 65 43 50 42 57C40 68 43 65 49 60C52 56 51 67 57 62C63 56 62 64 60 66C65 65 73 61 80 58';
  lookup(e,'signature').vector.paths=[p(curve,'none',purple,1.7)];
  const progress=[[0,0],[.055556,0],[.25,.15],[.42,.35],[.58,.53],[.72,.75],[.805556,1],[.861111,1],[1,1]],pen=t('pen',progress.map(([at,value])=>[at,{progress:value,y:at===1?-5:0}]));
  pen.follow={part:'signature',path:0,tip:{x:57,y:58}};
  e.rows=[r('primary','Ngòi dùng chính đường cong của mực',[pen],3600),r('secondary','Mực cùng tiến độ chiều dài với ngòi',[t('signature',progress.map(([at,value])=>[at,{draw:value}]))],3600)];e.assemblyVersion=2;

 }
 {
  const e=entries[41];lookup(e,'ink').vector.paths=[oval(50,61,21,3.5,'none'),p('M34 61H66','none',ink,1)];
  e.rows=[r('primary','Mặt in ép đúng tâm rồi nhấc',[t('stamp',[[0,{y:0,easing:ease}],[.270833,{y:23}],[.345833,{y:23,easing:ease}],[.625,{y:0}],[1,{y:0}]])],2400),r('secondary','Mực đủ cỡ ngay lúc ép',[t('ink',[[0,{opacity:0}],[.270832,{opacity:0,easing:'step-end'}],[.270833,{opacity:1}],[1,{opacity:1}]])],2400)];e.assemblyVersion=2;lookup(e,'ink').rest={opacity:1};
 }
 {
  const e=entries[42];lookup(e,'left').parent='body';lookup(e,'right').parent='body';e.parts=[lookup(e,'body'),lookup(e,'right'),lookup(e,'left')];e.rows=[r('primary','Vỗ xuống nhanh, thu chậm',[t('left',[[0,{rotation:0,easing:'ease-in'}],[.154762,{rotation:-18,easing:ease}],[.8,{rotation:0}],[1,{rotation:0}]],.44,.58),t('right',[[0,{rotation:0,easing:'ease-in'}],[.154762,{rotation:12,easing:ease}],[.8,{rotation:0}],[1,{rotation:0}]],.48,.57)],4200,'infinite'),r('secondary','Thân nâng sau cú vỗ',[t('body',[[0,{y:0}],[.038095,{y:0,easing:ease}],[.3,{y:-3,easing:ease}],[1,{y:0}]])],4200,'infinite')];
 }
 {
  const e=entries[43],camera=lookup(e,'camera'),photo=lookup(e,'photo'),shutter=lookup(e,'shutter');delete photo.clip;
  const sleeve=part('photo-sleeve','Khe ảnh che tờ đủ tỉ lệ');sleeve.clip={x:28,y:65,width:44,height:30};photo.parent='photo-sleeve';e.parts=[sleeve,photo,camera,shutter,part('flash','Chớp trong vành tròn',[oval(48,43,7,7,paper,'none')])];
  e.rows=[r('primary','Vành kính cố định, chụp một lần',[t('flash',[[0,{opacity:0}],[.102941,{opacity:0}],[.12,{opacity:.9}],[.141176,{opacity:0}],[1,{opacity:0}]])],3400),r('secondary','Ảnh chỉ trượt khỏi khe',[t('photo',[[0,{y:-26}],[.191176,{y:-26,easing:'ease-out'}],[.794118,{y:0}],[1,{y:0}]])],3400)];e.assemblyVersion=2;lookup(e,'flash').rest={opacity:0};
 }
 {
  const e=entries[44];e.rows[0].kind='spin';e.rows[0].periodMs=12000;e.rows[1]=r('secondary','Kim hạ một lần vào rãnh',[t('arm',[[0,{rotation:-20,easing:ease}],[.875,{rotation:0}],[1,{rotation:0}]],.78,.31)],2400);
 }
 {
  const e=entries[46];e.rows=[r('primary','Kim dao động giảm dần quanh đúng trục',[t('needle',[[0,{rotation:-100,easing:ease}],[.361111,{rotation:16,easing:ease}],[.555556,{rotation:-7,easing:ease}],[.722222,{rotation:2,easing:ease}],[1,{rotation:0}]],.5,.54)],3600),r('secondary','Mặt chia độ cố định',[t('dial',[[0,{rotation:0}],[1,{rotation:0}]],.5,.53)],3600)];
 }
 {
  const e=entries[49],boat=lookup(e,'boat'),wave=pose(part('surface','Mặt sóng dẫn độ cao và độ dốc'),Array.from({length:5},(_,i)=>{const a=i*Math.PI/2,y=73+2.5*Math.sin(a),s=2.5*Math.cos(a);return[p(`M13 ${73-2.5*Math.sin(a)}Q32 ${y-s} 50 ${y}Q68 ${y+s} 87 ${73-2.5*Math.sin(a)}L87 92H13Z`,blue,'none')];}));
  e.parts=[wave,boat,part('wave-front','Sóng trước che đáy',[p('M13 74Q31 80 50 75Q69 70 87 76V92H13Z',blue,'none'),p('M18 86Q28 80 38 86T58 86 78 86','none',purple,1.5)])];
  e.rows=[r('primary','Thuyền lấy cao độ và dốc từ mặt sóng',[t('boat',frames(13,u=>{const a=u*Math.PI*2;return{y:3+2.5*Math.sin(a),rotation:2.5*Math.cos(a)};}),.5,.7),t('surface',[[0,{pose:0}],[.25,{pose:1}],[.5,{pose:2}],[.75,{pose:3}],[1,{pose:4}]])],7200,'infinite'),r('secondary','Sóng trước cùng nhịp nước',[t('wave-front',frames(13,u=>({y:2.5*Math.sin(u*Math.PI*2)})))],7200,'infinite')];e.assemblyVersion=2;
 }
 lookup(entries[15],'glint').rest={opacity:0};
 lookup(entries[27],'body').vector=structuredClone(lookup(entries[27],'body').poses[0]);
 lookup(entries[48],'upper').rest={rotation:-18};
 lookup(entries[49],'boat').rest={y:3,rotation:2.5};
 lookup(entries[32],'satellite-front').rest={x:28};lookup(entries[32],'satellite-back').rest={opacity:0};
 for(let i=0;i<6;i++)lookup(entries[12],'paper-'+i).rest={x:(i-2.5)*5+(i%2?5:-4),y:27,rotation:(i%2?1:-1)*190};
 for(let i=0;i<3;i++)lookup(entries[22],'seed-'+i).rest={x:25+i*4,y:-7+i*10,rotation:19+i*8};
 // The bridge is the visible upper strand; there is no background-colour
 // patch, which would turn into a white sticker on a dark card.
 lookup(entries[2],'under-gap').vector.paths=[p('M0 0','none','none',0)];
 const lidBack=lookup(entries[45],'lid-back');pose(lidBack,[[p('M19 59L19 59L50 50L82 59L82 59L50 69Z',pink),p('M24 59L24 59L50 54L77 59L77 59L50 64Z',paper)],structuredClone(lidBack.vector.paths)]);
 entries[45].rows[0].tracks=[t('lid-back',[[0,{pose:0}],[.113636,{pose:0,easing:ease}],[.8,{pose:1}],[1,{pose:1}]]),t('dancer',[[0,{opacity:0}],[.295455,{opacity:0}],[.45,{opacity:1}],[1,{opacity:1}]])];
 lookup(entries[41],'stamp').vector.paths.push(oval(50,38,21,3.5,ink));
 // Congruent sand piles use area, not a pair of unrelated height scales.
 // Scaling both axes by sqrt(volume) conserves their visible area.
 lookup(entries[47],'upper').vector.paths=[p('M33 31H67L50 47Z',gold)];
 lookup(entries[47],'lower').vector.paths=[p('M33 75L50 59L67 75Z',gold)];
 entries[47].rows[0].tracks=[t('upper',frames(16,u=>({scaleX:Math.max(.05,Math.sqrt(1-u)),scaleY:Math.max(.05,Math.sqrt(1-u)),opacity:u===1?0:1})),.5,.47),t('lower',frames(16,u=>({scaleX:Math.max(.05,Math.sqrt(u)),scaleY:Math.max(.05,Math.sqrt(u)),opacity:u===0?0:1})),.5,.75)];
 // Boat height and local slope sample precisely the same surface poses.
 const boatProgress=[0,.25,.5,.75,1],boatY=[3,5.5,3,.5,3],boatAngles=[2.5,0,-2.5,0,2.5];
 entries[49].rows[0].tracks[0]=t('boat',boatProgress.map((at,i)=>[at,{y:boatY[i],rotation:boatAngles[i]}]),.5,.7);
 const surface=lookup(entries[49],'surface');pose(surface,boatProgress.map((u,i)=>{const y=70+boatY[i],s=18*Math.tan(boatAngles[i]*Math.PI/180);return[p(`M13 ${73-2.5*Math.sin(u*Math.PI*2)}Q32 ${y-s} 50 ${y}Q68 ${y+s} 87 ${73-2.5*Math.sin(u*Math.PI*2)}L87 92H13Z`,blue,'none')];}));
 lookup(entries[32],'bands').vector.paths=[36,48,60].map(y=>p('M-10 '+y+'q6 8 12 0'+Array.from({length:9},()=> 't12 0').join(''),'none',pink,3));
 entries[32].rows[0].tracks=[t('bands',[[0,{x:-24}],[1,{x:0}]])];
 const craneBody=lookup(entries[42],'body'),front=part('body-front','Thân che cánh xa',structuredClone(craneBody.vector.paths),'body');craneBody.vector.paths=[p('M0 0','none','none',0)];entries[42].parts.splice(2,0,front);
 lookup(entries[6],'ink').vector.paths[0].d='M20 52H29L34 40L41 65L48 34L55 61L61 48L73.851852 48.772291';
 entries[6].rows[1].tracks[0].anchor={x:.73851852,y:.48772291};
 lookup(entries[11],'cake').vector.paths.push(p('M50 37V36','none',ink,1));
 lookup(entries[21],'body').rest={y:2};
 lookup(entries[46],'needle').vector.paths=[p('M50 28L43 57L50 53L57 57Z',rose),p('M50 76L43 57L50 53L57 57Z',blue),oval(50,53,3,3,gold)];
 entries[46].rows[0].tracks[0].anchor={x:.5,y:.53};
 const clothT=(-28+Math.sqrt(28*28+16*17))/8,clothY=63+28*clothT-34*clothT*clothT;
 lookup(entries[33],'star').vector.paths[0]=p('M61 '+clothY+'V80','none',gold,1);entries[33].rows[1].tracks[0].anchor={x:.61,y:clothY/100};
 // Native closed paths preserve tangents at the seam, rather than closing
 // a polygonal approximation with a visible corner in slow playback.
 for(const [index,id,cx,cy,rx,ry,rowIndex]of [[26,'firefly-0',42,49,10,13,0],[26,'firefly-1',60,55,8,10,1],[31,'head',67,31,5,2,0]]){
  const e=entries[index],source=part(id+'-route','Quỹ đạo kín có tiếp tuyến liên tục',[oval(cx,cy,rx,ry,'none','none')]);e.parts.unshift(source);
  const track=e.rows[rowIndex].tracks.find(t=>t.target===id);track.follow={part:source.id,path:0,tip:{x:cx,y:cy}};track.frames=[{at:0,progress:0},{at:1,progress:1}];e.assemblyVersion=2;
 }
 for(const e of entries){if(e.parts.some(p=>p.poses||p.rest||p.clip?.d))e.assemblyVersion=2;for(const row of e.rows)for(const tr of row.tracks){const pp=lookup(e,tr.target);if(pp)pp.anchor={...tr.anchor};}}
}
