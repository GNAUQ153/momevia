import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {MOTION_REPAIR_IDS} from '../../src/modules/designs/motion-repair-rollout.mjs';

// Real renderer regression: no accounts, database, saved sessions or artifacts.
const root=fileURLToPath(new URL('../../web/',import.meta.url)),items=builtinLibraryItems().filter(r=>r.kind==='element'&&MOTION_REPAIR_IDS.includes(r.id)),ordered=[...items.filter(r=>r.id.startsWith('motion-')),...items.filter(r=>r.id.startsWith('natural-motion-'))];
assert.equal(ordered.length,56);
const types={'.json':'application/json','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
 try{
  const name=new URL(request.url,'http://localhost').pathname;
  if(name==='/'){response.writeHead(200,{'content-type':'text/html'});response.end('<!doctype html><html><meta charset="utf-8"><title>Motion regression</title><body></body></html>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(name));if(!file.startsWith(root))throw new Error('Outside test web root');
  const bytes=fs.readFileSync(file);response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});response.end(bytes);
 }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const engine=process.argv.includes('--webkit')?webkit:chromium,report=[];
let browser;
try{
 browser=await engine.launch({headless:true,...(engine===chromium&&process.platform==='win32'?{channel:'chrome'}:{})});const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(async data=>{
  const {renderElement}=await import('/js/features/gift-runtime/renderer.js'),{createMotion,playElement}=await import('/js/features/gift-runtime/effects.js'),{eventMediaUrl}=await import('/js/shared/canvas/event-media.js');
  let active=null;
  for(const item of data){const host=globalThis.document.createElement('section');host.id='m'+item.number;host.innerHTML='<div class="after" style="width:220px;height:220px"></div>';globalThis.document.body.append(host);}
  const stop=()=>{if(!active)return null;const current=active;current.abort.abort();current.motion.cancel();active=null;return current.motion;};
  const seek=(number,time)=>{
   if(active?.number!==number){stop();const item=data[number-1],host=globalThis.document.querySelector('#m'+number+' .after'),abort=new AbortController(),motion=createMotion(()=>true),node=renderElement(item.after,{document:{bindings:{}},assetUrl:eventMediaUrl});Object.assign(node.style,{position:'relative',width:'100%',height:'100%'});host.replaceChildren(node);void playElement(node,item.after,motion,abort.signal);const animations=host.getAnimations({subtree:true});animations.forEach(a=>a.pause());active={number,abort,motion,animations};}
   active.animations.forEach(a=>a.currentTime=time);
  };
  globalThis.motionTest={data,seek,stop};
 },ordered.map((row,i)=>({number:i+1,id:row.id,after:row.definition.elements[0]})));
for(let number=1;number<=56;number++){
 const result=await page.evaluate(async({number,waitFrame})=>{
  const qa=globalThis.motionTest;qa.seek(number,0);const item=qa.data[number-1],model=item.after,host=globalThis.document.querySelector('#m'+number+' .after'),checks=new Map();let time=0;
  const part=id=>host.querySelector('[data-motion-part="'+id+'"]'),basis=id=>{let n=part(id);while(n){const child=[...n.children].find(c=>c.dataset.motionRow);if(!child)break;n=child;}return n;},path=(id,i=0)=>part(id).querySelectorAll('path')[i];
  const point=(id,x,y)=>{const n=basis(id);return new globalThis.DOMPoint(x,y).matrixTransform(n.getScreenCTM()).matrixTransform(n.closest('svg').getScreenCTM().inverse());};
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),check=(label,value,limit=.5,unit='đơn vị')=>{const prior=checks.get(label);if(!prior||prior.max<value)checks.set(label,{label,max:value,time,limit,unit,passed:value<=limit});},join=(label,a,b)=>check(label,distance(a,b));
  const pathPoint=(id,f=0,i=0)=>{const n=path(id,i),p=n.getPointAtLength(n.getTotalLength()*f);return new globalThis.DOMPoint(p.x,p.y).matrixTransform(n.getScreenCTM()).matrixTransform(n.closest('svg').getScreenCTM().inverse());};
  const opacity=id=>parseFloat(globalThis.getComputedStyle(basis(id)).opacity),matrix=id=>new globalThis.DOMMatrix(globalThis.getComputedStyle(basis(id)).transform);
  const duration=Math.max(...model.motions.rows.map(r=>r.periodMs+r.delayMs+Math.max(0,...(r.tracks||[]).map(t=>t.delayMs)))),times=Array.from({length:161},(_,i)=>duration*i/160);
  times.push(...({1:[2400],4:[870,1420,1450],5:[950],6:[1150],7:[2200,2300,2480],13:[0,190],14:[950],18:[450,1650],21:[4550,4799,4800,4801],24:[1700,2350,8200],25:[0,800,1600],28:[2925,6499,6500,6501],34:[1240,3410],41:Array.from({length:386},(_,i)=>200+i*7),42:[650,830],46:[0,650,1750,3250,4750],48:[0,4500,8800,9000,10000],49:[999,1000,1100,1650]}[number]||[]));
  if(number===31)times.push(...model.motions.rows[1].tracks.map(t=>t.frames[2].at*3600));if(number===40)times.push(2500);
  let lastDrop=null,dropBackward=0,firstEnds=null;
  for(time of times.sort((a,b)=>a-b)){qa.seek(number,time);if(waitFrame)await new Promise(globalThis.requestAnimationFrame);
   switch(number){
    case 1:if(time===2400){const extremes=id=>{const p=path(id),pts=Array.from({length:2049},(_,i)=>p.getPointAtLength(p.getTotalLength()*i/2048));return id==='left'?pts.reduce((a,b)=>a.x>b.x?a:b):pts.reduce((a,b)=>a.x<b.x?a:b);},a=extremes('left'),b=extremes('right');join('Hai mép tim thật ở khung chạm',point('left',a.x,a.y),point('right',b.x,b.y));}break;
    case 2:check('Đá và đai là khối cứng',Math.abs(distance(point('ring',34,32),point('ring',66,32))-32));check('Lóe bị che trong mặt đá',part('glint').hasAttribute('clip-path')?0:1,0);break;
    case 3:{const d=distance(pathPoint('knot'),pathPoint('knot',1));if(time===0)firstEnds=d;if(time>=2400)check('Hai đầu kéo xa khi vòng siết',d>firstEnds+15?0:1,0);break;}
    case 4:if(time>=870)join('Chìa xoay quanh tâm ổ thực',point('key',46,65),point('body',46,65));if(time<1450)check('Quai chưa nhả trước khi vặn',Math.abs(matrix('shackle').f-8),.001);break;
    case 5:{const box=path('lid').getBBox(),x=Math.abs(box.x-33)<Math.abs(box.x+box.width-33)?box.x:box.x+box.width;join('Cạnh gắn nắp - chốt mặt dây',point('lid',x,64),point('hinge-pin',33,64));break;}
    case 6:if(time===1150)join('Hai mép miệng tách chạm',point('left',44,49),point('right',56,49));break;
    case 7:if(time>=2200)join('Tim bám đúng cuối mực',point('heart',73.851852,48.772291),pathPoint('ink',1));break;
    case 8:join('Đầu cành - điểm ngậm mỏ',pathPoint('branch'),point('body',76,47));break;
    case 9:check('Lọ đứng nguyên',Math.abs(matrix('jar').e)+Math.abs(matrix('jar').f),.001);break;
    case 10:if(time>=1650)join('Hai biên ráp cùng tọa độ',point('left',45,46),point('right',45,46));else check('Khe chưa ráp không phát sáng',opacity('seam'),.001);break;
    case 11:join('Nút bóng - gốc dây',point('knot',50,58),pathPoint('string'));break;
    case 12:join('Chân lửa - tim nến',pathPoint('flame'),point('cake',50,36));break;
    case 13:if(time<200)for(let i=0;i<6;i++)check('Không có giấy trước khung phóng',opacity('paper-'+i),.001);break;
    case 14:if(time===950)join('Hai vành ly tại 0,95 s',point('left',43,25),point('right',57,25));check('Hai vùng chứa riêng theo ly',part('left-cavity').hasAttribute('clip-path')&&part('right-cavity').hasAttribute('clip-path')?0:1,0);break;
    case 15:join('Gốc tua - nút dây trên mũ',pathPoint('tassel'),point('button',77,49));break;
    case 16:join('Rễ băng trái - mặt sau huy chương',point('ribbon-left',36,53),point('medal',36,53));join('Rễ băng phải - mặt sau huy chương',point('ribbon-right',53,54),point('medal',53,54));break;
    case 17:join('Tâm cánh - đầu que',point('blades',50,44),pathPoint('stick'));break;
    case 18:if(time===450)join('Đầu dùi trái - điểm gõ trái',point('stick-a',38,51),point('head',38,51));if(time===1650)join('Đầu dùi phải - điểm gõ phải',point('stick-b',62,51),point('head',62,51));break;
    case 19:for(let i=0;i<5;i++){check('Nan '+i+' bảo toàn chiều dài',Math.abs(distance(pathPoint('rib-'+i),pathPoint('rib-'+i,1))-52));join('Chân nan '+i+' - chốt quạt',pathPoint('rib-'+i),point('pin',50,76));}break;
    case 20:if(time<=280)check('Rèm đầu cảnh đóng kín',Math.max(0,path('right').getBBox().x-(path('left').getBBox().x+path('left').getBBox().width)),.001);break;
    case 21:if(time>=4550&&time<=4801)check('Gợn chỉ đặt lại khi đã tắt',opacity('water'),.01);break;
    case 22:join('Chân bướm - mặt cánh hoa',point('body',63,44),point('flower',63,46));break;
    case 23:for(let i=0;i<3;i++)if(time<=[550,900,1350][i])join('Hạt '+i+' còn cài trên đài',point('seed-'+i,40,39),point('flower',40,39));break;
    case 24:if(time>=1700){const y=point('dew',78,55).y;if(lastDrop!==null)dropBackward=Math.max(dropBackward,lastDrop-y);lastDrop=y;check('Giọt đã tách chỉ đi xuống',dropBackward,.001);}if(time>=2350)check('Kết thúc bằng lá trống',opacity('dew'),.001);break;
    case 25:for(const id of ['left','right'])join('Gốc lá '+id+' - ngọn thân thật',point(id,50,39),pathPoint('stem',1));break;
    case 26:join('Gốc góc giấy - mép trang tại cánh đi qua',pathPoint('corner'),point('page-front',69.25,47));break;
    case 27:check('Hai quỹ đạo kín có cùng tiếp tuyến',model.motions.rows.every(r=>r.tracks.some(t=>t.follow))?0:1,0);break;
    case 28:join('Gốc râu trái - đầu',point('feelers',80,59),point('head',80,59));join('Gốc râu phải - đầu',point('feelers',84,60),point('head',84,60));break;
    case 29:for(const [id,x]of [['left',20],['right',80]])join('Cạnh bản lề '+id+' - khung',pathPoint(id),point(id+'-edge',x,22));break;
    case 30:for(const [id,x,y]of [['grass-left',16,86],['grass-right',78,87]])join('Chân cỏ '+id+' bám đất',pathPoint(id),point('tower',x,y));join('Trục cánh trên tháp',point('blades',50,45),point('tower',50,45));break;
    case 31:for(const [i,tr]of model.motions.rows[1].tracks.entries())if(Math.abs(time-tr.frames[2].at*3600)<.001){const progress=1-parseFloat(globalThis.getComputedStyle(basis('line')).strokeDashoffset),coords=[[20,65],[38,31],[65,45],[81,23]][i];join('Đầu nét thật kích sao '+i,pathPoint('line',progress),point('star-'+i,...coords));}break;
    case 32:join('Cổ lụa luồn dưới sao, không đo tâm sao',point('tail',63,33),point('head',63,33));break;
    case 33:check('Chỉ một vệ tinh theo tổng alpha hai lớp',Math.abs(opacity('satellite-front')+opacity('satellite-back')-1),.001);check('Vân bị giới hạn trong thân cầu',part('bands').hasAttribute('clip-path')?0:1,0);break;
    case 34:join('Móc trái cố định trên trăng',pathPoint('hammock'),point('hooks',39,34));{const q=(-28+Math.sqrt(1056))/8,y=63+28*q-34*q*q;join('Gốc dây sao - điểm thật dưới vải võng',pathPoint('star'),point('bottom',61,y));}break;
    case 35:check('Giữ đủ năm cung màu',model.assembly.parts.filter(p=>p.id.startsWith('arc-')).length===5?0:1,0);break;
    case 36:join('Gốc tua - đáy đèn đang lắc',pathPoint('tassel'),point('body',50,73));break;
    case 37:for(const x of [39,61])join('Đầu dây '+x+' - bầu khí cầu',point('basket',x,64),point('balloon',x,64));break;
    case 38:check('Sáu hạt có đường và thời điểm lắng riêng',model.motions.rows[0].tracks.length===6&&new Set(model.motions.rows[0].tracks.map(t=>t.frames[2].at)).size===6?0:1,0);break;
    case 39:join('Gốc tia - tâm buồng đèn',pathPoint('beam'),point('tower',50,31.5));break;
    case 40:check('Hai dải thực sự đổi độ cong',model.assembly.parts.filter(p=>p.id.startsWith('band-')).every(p=>new Set(p.poses.map(v=>v.paths[0].d)).size>2)?0:1,0);break;
    case 41:if(time>=200&&time<=2900){const ink=path('signature'),progress=1-parseFloat(globalThis.getComputedStyle(basis('signature')).strokeDashoffset),p=ink.getPointAtLength(progress*ink.getTotalLength());check('Ngòi - đầu mực tại tiến độ chung',distance(point('pen',57,58),point('signature',p.x,p.y)),.25);}break;
    case 42:if(time>=650&&time<=830)join('Tâm mặt in - tâm dấu trên tem',point('stamp',50,38),point('ink',50,61));break;
    case 43:join('Gốc cánh gần - nếp gấp thân',pathPoint('left'),point('body-front',44,58));join('Gốc cánh xa - nếp gấp thân',pathPoint('right'),point('body-front',48,57));break;
    case 44:check('Ống kính và tờ ảnh bảo toàn tỉ lệ',Math.abs(Math.hypot(matrix('photo').a,matrix('photo').b)-Math.hypot(matrix('photo').c,matrix('photo').d)),.001);check('Vành ống kính không bị ép ngang',Math.abs(matrix('shutter').a-1)+Math.abs(matrix('shutter').d-1),.001);break;
    case 45:if(time>=2400)check('Kim giữ nguyên sau khi hạ',Math.abs(matrix('arm').b)+Math.abs(matrix('arm').c),.001);break;
    case 46:join('Chân - tâm bệ không đổi phối cảnh',point('dancer',50,66),point('plinth',50,66));if(time===0)check('Người bị che khi nắp đóng',opacity('dancer'),.001);check('Có dáng trước, nghiêng và sau riêng',new Set(model.assembly.parts.find(p=>p.id==='dancer').poses.map(v=>JSON.stringify(v))).size>=4?0:1,0);break;
    case 47:join('Chốt kim - tâm mặt chia độ',point('needle',50,53),point('dial',50,53));break;
    case 48:{const a=matrix('upper'),b=matrix('lower');check('Diện tích cát hai bầu bảo toàn',Math.abs(a.a*a.d-a.b*a.c+b.a*b.d-b.b*b.c-1),.025,'tỉ lệ diện tích');if(time>=9000)check('Tia tắt sau giây 9',opacity('stream'),.001);break;}
    case 49:if(time>=1000&&time<=1100)join('Đầu đục - tâm lỗ khi ép',point('upper',75,59),point('hole',75,59));if(time<1000){check('Vé chưa thủng trước cú bấm',opacity('hole'),.001);check('Chưa có mảnh giấy trước cú bấm',opacity('disc'),.001);}break;
    case 50:{const p=path('surface'),length=p.getTotalLength();let lo=0,hi=0,prev=0;for(let i=1;i<=400;i++){const s=length*i/400,pt=p.getPointAtLength(s);if(pt.x>=50){lo=prev;hi=s;break;}prev=s;}for(let i=0;i<20;i++){const mid=(lo+hi)/2;if(p.getPointAtLength(mid).x<50)lo=mid;else hi=mid;}const water=p.getPointAtLength((lo+hi)/2);join('Đáy thuyền lấy từ mặt sóng thật',point('boat',50,70),point('surface',water.x,water.y));break;}
    case 51:{const m=new globalThis.DOMMatrix(globalThis.getComputedStyle(part('whole').querySelector('[data-motion-row="heart-beat"]')).transform);check('Tim đập đều hai trục',Math.abs(Math.hypot(m.a,m.b)-Math.hypot(m.c,m.d)),.001);break;}
    case 52:case 53:check('Khối ảnh giữ nguyên tỉ lệ hoa văn',Math.abs(Math.hypot(matrix('whole').a,matrix('whole').b)-Math.hypot(matrix('whole').c,matrix('whole').d)),.001);break;
    case 54:join('Gốc cành đứng tại cuống thật',point('root',5,95),point('root-pixels',5,95));break;
    case 55:check('Nút nơ đứng yên trên thiệp',Math.abs(matrix('knot').e)+Math.abs(matrix('knot').f),.001);break;
    case 56:for(const y of [0,100])join('Đầu nếp gấp '+y+' đứng nguyên',point('fold',50,y),point('inside',50,y));break;
   }
  }
  return{number,id:item.id,samples:times.length,checks:[...checks.values()],passed:checks.size>0&&[...checks.values()].every(c=>c.passed)};
 },{number,waitFrame:engine!==chromium});report.push(result);if(!result.passed)console.log('FAIL '+number+' '+JSON.stringify(result.checks.filter(c=>!c.passed)));
}
assert(report.every(r=>r.passed));
const cleanup=await page.evaluate(async()=>{const motion=globalThis.motionTest.stop();await new Promise(globalThis.requestAnimationFrame);await new Promise(globalThis.requestAnimationFrame);return{remaining:globalThis.document.getAnimations().length,stats:motion?.stats()};});
assert.equal(cleanup.remaining,0);assert.deepEqual(cleanup.stats,{animations:0,pending:0});
console.log('PASS 56 motion models: physical relationships, timing and renderer cleanup ('+engine.name()+').');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
