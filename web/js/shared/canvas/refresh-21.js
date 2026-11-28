import { REFRESH_21 } from './refresh-21-config.js';
import { refreshArt } from './refresh-21-art.js';
import { eventRecipe } from './event-recipes.js';
import { canonicalText } from '../locale.js';
import {NATURAL_MEDIA_IDS} from './natural-media.js';
import {EVENT_MEDIA,NATURAL_ARTWORK_LABEL} from './event-media.js';

const SCENERY = {
  afterglow:['#D6B7A3','#3F382F'], 'tiny-celebration':['#E0E8D7','#314C3E'],
  'winter-wishes-2026':['#173D3B','#FFF2D9'], polaroid:['#E8DFCF','#4B4338'],
  'calm-light':['#D8DED0','#384A3D'], 'cloud-nine':['#D6E4E7','#344E5B'],
  confetti:['#F0DCCB','#673B3D'], 'new-year-spark-2027':['#172931','#F5E9C9'],
  'spring-blessing-2027':['#7F2D34','#FFF0CE'], 'velvet-valentine-2027':['#572A3B','#F8E0D4'],
  greenhouse:['#D9E4D2','#304E3B'], 'gentle-apology':['#DED9CB','#484B40'],
  'love-letter':['#D8B6AD','#573E3A'], 'faraway-hug':['#D9E5E7','#3A5660'],
  lavender:['#DAD2DF','#4B4054'], 'mot-ky-niem':['#DCD7C6','#34463E'],
  'midnight-bloom':['#192A2B','#F1E6D0'], 'sunny-wishes':['#F1E3BA','#4C4935'],
  starlight:['#172D3B','#F1DFB3'], 'peachy-day':['#EAD3BF','#60493D'],
  'thank-you-bloom':['#D9DFCC','#3A503C'],
};
const OPEN_POINTS = {
  afterglow:[301,359], 'tiny-celebration':[183,497], 'winter-wishes-2026':[181,492],
  polaroid:[183,498], 'calm-light':[253,489], 'cloud-nine':[120,469], confetti:[55,497],
  'new-year-spark-2027':[320,325], 'spring-blessing-2027':[224,403], 'velvet-valentine-2027':[196,382],
  greenhouse:[208,407], 'gentle-apology':[174,349], 'love-letter':[263,310], 'faraway-hug':[194,362],
  lavender:[243,434], 'mot-ky-niem':[300,271], 'midnight-bloom':[237,350],
  'sunny-wishes':[263,293], starlight:[242,401], 'peachy-day':[201,375], 'thank-you-bloom':[251,447],
};
const WISH_HEADINGS={
  afterglow:['Giữ lại chút chiều êm','A little afterglow'], 'tiny-celebration':['Điều nhỏ, niềm vui lớn','A small, lovely surprise'],
  'winter-wishes-2026':['Ấm áp bên ô cửa','Warmth by the window'],polaroid:['Một khoảnh khắc, một lời','A moment, a message'],
  'calm-light':['Để ngọn đèn sáng dịu','Let a little light in'],'cloud-nine':['Ở tầng mây của bạn','Your own little cloud'],
  confetti:['Một điều ước đang mở','Here is your wish'],'new-year-spark-2027':['00:00','00:00'],
  'spring-blessing-2027':['Chén trà đầu năm','The first tea of spring'],'velvet-valentine-2027':['Trong lớp lụa dành riêng','Just for you, inside'],
  greenhouse:['Một khu vườn cho bạn','A garden for you'],'gentle-apology':['Một lời thật lòng','An honest little note'],
  'love-letter':['Những nếp thư gửi bạn','Between these folds'],'faraway-hug':['Gửi đến thành phố bạn','Arriving in your city'],
  lavender:['Ép lại một ngày dịu','A day to keep'],'mot-ky-niem':['Phía sau một kỷ niệm','Behind this memory'],
  'midnight-bloom':['Khi một nụ hoa mở','When a night flower opens'],'sunny-wishes':['Có nắng trong giỏ xe','Sunshine in the basket'],
  starlight:['Một khoảng trời để đọc','A quiet patch of sky'],'peachy-day':['Mở ra một ngày ngọt','Unwrap a sweet day'],
  'thank-you-bloom':['Lời cảm ơn buộc bằng dây','Thanks, tied with twine'],
};
const NATURAL_TAPS={afterglow:[.90,.46],'tiny-celebration':[.38,.77],'winter-wishes-2026':[.5,.87],polaroid:[.36,.84],'calm-light':[.59,.72],'cloud-nine':[.67,.76],confetti:[.30,.92],'new-year-spark-2027':[.93,.51],'spring-blessing-2027':[.69,.42],'velvet-valentine-2027':[.57,.62],greenhouse:[.82,.60],'gentle-apology':[.49,.5],'love-letter':[.80,.24],'faraway-hug':[.52,.49],lavender:[.39,.64],'mot-ky-niem':[.80,.18],'midnight-bloom':[.72,.40],'sunny-wishes':[.78,.14],starlight:[.71,.72],'peachy-day':[.45,.53],'thank-you-bloom':[.78,.76]};

export function paintRefreshedTemplate(id, doc, api, original, localize) {
  const spec=REFRESH_21[id]; if(!spec)return false;
  const en=localize('templates.scene.cover')!==canonicalText('templates.scene.cover');
  const words = pair => pair[en?1:0];
  const [bg,ink]=SCENERY[id], p={...original,...spec,bg,ink,templateId:id};
  const {add,shape,line,text,binding,action}=api;
  doc.schemaVersion=doc.registryVersion=2;
  const rect=(s,key,box,color,radius=3)=>shape(s,key,box,color,'rectangle',{radius});
  const heading=(s,key,value,box,size=30,color=ink,align='left')=>{
    const node=text(s,key,value,box,size,color,'serif',align);
    node.accessibility={role:'heading',level:1};return node;
  };
  const note=(s,key,value,box,size=16,color=ink,align='left')=>text(s,key,value,box,size,color,'body',align);
  const paper=(s,key,box,color='#F6EBD5')=>{
    const role=['tiny-celebration','peachy-day','mot-ky-niem'].includes(id)?'paper-kraft':'paper-cotton',assetId=NATURAL_MEDIA_IDS['element-'+role];
    if(assetId){if(!doc.assets.some(a=>a.assetId===assetId))doc.assets.push({assetId,kind:'image'});return add(s,'image',key,[box[0]-12,box[1],box[2]+24,box[3]+12],{assetId,fit:'cover',radius:0},{name:localize('editor.library.item.natural-'+role),accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}});}
    const node=rect(s,key,box,color);node.effects={surface:eventRecipe('cotton-paper-v2')};return node;
  };
  const depth=(s,key,box)=>{
    const node=rect(s,key,[box[0]-12,box[1],box[2]+24,box[3]+12],'#352B30');node.opacity=.14;node.effects={surface:eventRecipe('contact-shadow-v1')};return node;
  };
  const art=(s,prefix,box,state)=>refreshArt(doc,api,s,prefix,box,p,state);
  const defaultPhoto=(s,box)=>{
    const assetId=NATURAL_MEDIA_IDS['default-stilllife'];if(!assetId)return;
    if(!doc.assets.some(a=>a.assetId===assetId))doc.assets.push({assetId,kind:'image'});
    add(s,'image','photo-window-default',box,{assetId,fit:'cover',radius:0},{name:'Cảnh minh họa',accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}});
  };
  const dark=['winter-wishes-2026','new-year-spark-2027','spring-blessing-2027','velvet-valentine-2027','midnight-bloom','starlight'].includes(id);
  for(const s of doc.scenes){s.background.color=bg;s.effects={surface:eventRecipe('cotton-paper-v2'),transition:{id:id==='faraway-hug'?'T02':id==='love-letter'||id==='mot-ky-niem'||id==='polaroid'?'T03':'T01',speed:'normal'}};}
  if(id==='winter-wishes-2026')doc.scenes[1].effects.ambience={id:'refresh-snow-v1',speed:'normal',density:'sparse',loop:false,definition:{id:'refresh-snow-v1',revision:1,family:'ambience',title:{vi:'Tuyết rơi một lượt',en:'One snowfall'},targets:{scenes:true,types:[]},animation:{engine:'particles',duration:1400,count:12,glyphs:['·','•'],colors:['#FFF9ED','#DDE8E0'],drift:65}}};
  if(id==='confetti')doc.scenes[1].effects.ambience={id:'B01',speed:'fast',density:'sparse',loop:false};

  // Marker is the actual surface receiving the object shadow. It also identifies
  // this revision when making a cover; old saved documents have no marker.
  rect(0,`refresh-${id}`,[0,528,390,316],bg,0).name=words(['Mặt nhận bóng của cảnh','Scene surface']);
  heading(0,'cover-title',p.headline,[30,56,330,126],35,ink,'left');
  const objectBox=id==='sunny-wishes'?[3,241,384,340]:id==='midnight-bloom'?[23,195,352,375]:[22,215,346,346];
  art(0,'cover-object',objectBox,'closed');

  if(id==='mot-ky-niem') {
    const frame=rect(0,'photo-window',[99,284,191,197], '#B9C9B7',0);
    frame.name='Khung ảnh kỷ niệm';
    // Deliberately drawn still life beneath the replaceable photo frame.
    frame.artwork={paths:[{d:'M0 0H100V100H0Z',fill:'#A9B8A7'},{d:'M0 69H100V100H0Z',fill:'#B59F7B'},{d:'M35 54H64L60 85H39Z',fill:'#DDCCAB'},{d:'M49 57V12M49 32 28 18M49 45 74 28',fill:'none',stroke:'#46614D',strokeWidth:1.8},{d:'M18 15Q34 7 47 31 25 38 18 15ZM54 38Q62 14 80 19 81 36 54 38Z',fill:'#647B58'},{d:'M5 3H7V64H5Z',fill:'#D3DDD0'}]};
    const media=EVENT_MEDIA[NATURAL_MEDIA_IDS[id]];
    if(media?.aperture){
      const [ax,ay,aw,ah]=objectBox,scale=Math.min(aw/media.width,ah/media.height),w=media.width*scale,h=media.height*scale,a=media.aperture;
      Object.assign(frame.layout,{x:ax+(aw-w)/2+a.x*w+1,y:ay+(ah-h)/2+a.y*h+1,width:a.width*w-2,height:a.height*h-2});
    }
    defaultPhoto(0,[frame.layout.x,frame.layout.y,frame.layout.width,frame.layout.height]);
    rect(0,'photo-reflection',[frame.layout.x-5,frame.layout.y,2,frame.layout.height],'#F7EBD2',0).opacity=.35;
    note(0,'photo-caption',localize('templates.copy.polaroidCaption'),[75,530,255,36],16,ink);
  }
  binding(0,'text-recipient','recipientName',[32,605,326,78],24,ink,'left');
  note(0,'cover-note',words(spec.open),[32,706,326,50],17,ink,'left');
  let [px,py]=OPEN_POINTS[id];
  const photo=doc.elements.find(e=>e.id==='cover-object-natural-art');
  if(photo&&NATURAL_TAPS[id]){
    const media=EVENT_MEDIA[photo.props.assetId],b=photo.layout,scale=Math.min(b.width/media.width,b.height/media.height),w=media.width*scale,h=media.height*scale,[x,y]=NATURAL_TAPS[id];
    px=Math.min(342,Math.max(0,b.x+(b.width-w)/2+x*w-24));py=Math.min(796,Math.max(0,b.y+(b.height-h)/2+y*h-24));
  }
  const opener=action(0,'button','open-gift','↗',[px,py,48,48],'scene-surprise');
  opener.accessibility.label=words(spec.open);opener.name=words(spec.open);
  opener.effects={reaction:{id:'R03',speed:'fast'}};

  // Each wish opens on the physical reverse/lining/leaf of its own object.
  const [x,y,w,h]=spec.wish;
  // Reflow can grow outside the stationery. Keep its canvas light enough for
  // dark body ink; the dark flower alcove keeps its own pale ink instead.
  if(dark&&id!=='midnight-bloom')doc.scenes[1].background.color='#D7CBB2';
  const wishInk=dark&&id==='midnight-bloom'?'#F5E9D3':['tiny-celebration','peachy-day','mot-ky-niem'].includes(id)?'#241C14':'#3E4036';
  if(id==='midnight-bloom') {
    art(1,'opened-petals',[246,38,166,181],'open');
    rect(1,'night-reading-alcove',[x-8,y-12,w+16,h+30],'#192A2B');
  } else {
    if(id==='afterglow') art(1,'open-window',[0,-95,390,435],'open');
    else if(id==='tiny-celebration') art(1,'open-drawer',[10,5,364,210],'open');
    else if(id==='winter-wishes-2026') art(1,'warm-house',NATURAL_MEDIA_IDS[id]?[-110,-30,610,460]:[85,20,220,235],'open');
    else if(id==='calm-light') art(1,'lit-lamp',[-35,245,172,310],'open');
    else if(id==='cloud-nine') art(1,'cloud-tiers',[-10,-53,410,255],'open');
    else if(id==='new-year-spark-2027') art(1,'midnight-leaves',[13,15,364,230],'open');
    else if(id==='greenhouse') art(1,'open-greenhouse',[-38,-48,193,250],'open');
    else if(id==='gentle-apology') art(1,'repaired-bowl',[-33,34,217,205],'open');
    else if(id==='faraway-hug') art(1,'plane-arrived',[198,-22,210,235],'open');
    else if(id==='sunny-wishes') art(1,'bicycle-basket',[-155,8,390,195],'open');
    else if(id==='starlight') art(1,'turned-disk',[193,-48,237,276],'open');
    else if(id==='thank-you-bloom') art(1,'flowers-at-margin',[-88,102,184,440],'open');
    else if(id==='peachy-day') art(1,'unwrapped-peach',[189,-30,207,238],'open');
    else if(id==='velvet-valentine-2027'&&NATURAL_MEDIA_IDS[id])art(1,'opened-velvet-box',[0,-12,390,250],'open');
    depth(1,'reading-contact',[x-10,y-7,w+24,h+29]);
    paper(1,'message-paper',[x-14,y-15,w+28,h+30],id==='velvet-valentine-2027'?'#F0D8C8':id==='calm-light'?'#E9E3C9':'#F7EEDA');
  }
  const stationery=doc.elements.find(e=>e.id==='message-paper');
  if(stationery?.type==='shape'){
    const tag=['greenhouse','thank-you-bloom','sunny-wishes','peachy-day'].includes(id);
    const ticket=['afterglow','confetti','new-year-spark-2027'].includes(id);
    if(tag||ticket||id==='cloud-nine'){
      delete stationery.effects;
      const d=tag?'M9 0H91L100 7V100H0V7Z':ticket?'M0 0H100V12Q95 15 100 18V82Q95 85 100 88V100H0V88Q5 85 0 82V18Q5 15 0 12Z':'M0 9Q8-3 17 6 25-3 33 4 49-5 58 5 71-3 80 5 94-1 100 9V95Q89 100 78 96 64 102 51 96 37 101 25 96 10 101 0 95Z';
      stationery.artwork={paths:[{d,fill:'color'}]};
      stationery.props.kind='refresh-v1-reading-paper';
    }
  }
  if(id==='afterglow'||id==='confetti'||id==='new-year-spark-2027') {
    line(1,'ticket-perforation',[x+12,y+82,w-24,2], '#AB9775',1).props.pattern='stitched';
    for(let i=0;i<3;i++)shape(1,`punched-hole-${i}`,[x-19,y+45+i*34,9,9],bg);
  }
  if(id==='tiny-celebration'){
    rect(1,'drawer-left-wall',[x-23,y-24,9,h+55],'#91734E',0);
    rect(1,'drawer-front-edge',[x-20,y+h+13,w+40,12],'#B39166',0);
  }
  if(id==='winter-wishes-2026') {
    rect(1,'house-roof-beam',[x-25,y-22,w+50,9],'#9E7853',0);
    rect(1,'warm-window-side',[x-23,y-15,9,h+38],'#AA825D',0);
    const roof=shape(1,'house-gable',[x-24,y-79,w+48,64],'#775B44','triangle');roof.name=words(['Mái ngôi nhà trong cầu tuyết','Roof of the snow-globe house']);
  }
  if(id==='spring-blessing-2027'){
    art(1,'tea-beside-scroll',[-86,393,181,221],'open');
    for(const yy of [y-25,y+h+20])rect(1,`scroll-rod-${yy}`,[x-25,yy,w+50,8],'#B58D4E',4);
  }
  if(id==='confetti'){
    for(let i=0;i<5;i++)rect(1,`opened-paper-curl-${i}`,[24+i*72,129+i%2*25,8,28,i*27-50],['#B56C63','#748E90','#C2A16D'][i%3],1);
  }
  if(id==='love-letter') {
    for(const yy of [y+138,y+330])line(1,`letter-fold-${yy}`,[x-13,yy,w+26,1],'#D5C6AA',1);
    rect(1,'folded-left-leaf',[0,y+80,20,330],'#DBC7AA',0);
  }
  if(id==='faraway-hug') {
    line(1,'postcard-divider',[x+w+20,y+140,170,1,90],'#9DAB9E',1);
    for(let i=0;i<4;i++)line(1,`postcard-address-${i}`,[329,y+160+i*25,38,1],'#809592',1);
  }
  if(id==='lavender') {
    rect(1,'herbarium-spine',[38,y-25,13,h+55],'#6F6375',1);
    const assetId=NATURAL_MEDIA_IDS['element-lavender'];
    if(assetId){if(!doc.assets.some(a=>a.assetId===assetId))doc.assets.push({assetId,kind:'image'});add(1,'image','pressed-lavender-sprig',[18,219,86,357],{assetId,fit:'contain',radius:0},{name:localize('editor.library.item.natural-lavender'),accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}});}
    else art(1,'pressed-lavender',[-118,166,220,426],'open');
    line(1,'botanical-margin',[x-12,y+25,h-20,1,90],'#B7A78A',1);
  }
  if(id==='mot-ky-niem'){
    rect(1,'frame-back-clips',[28,224,10,36],'#8E7755',1);
    rect(1,'frame-back-stand',[285,707,43,55,9],'#9C7C56',2);
    for(const xx of [39,339])shape(1,`frame-screw-${xx}`,[xx,y+20,7,7],'#7E7257');
    line(1,'frame-hanging-wire',[99,y-40,181,1],'#867B61',1);
  }
  if(id==='velvet-valentine-2027') {
    rect(1,'velvet-lining-edge',[17,y-35,14,h+72],'#692B41',3);
    line(1,'satin-light-fold',[x+20,y+88,w-35,1,-6],'#FFEFDD',7).opacity=.55;
  }
  if(id==='polaroid'){
    paper(1,'photo-strip-paper',[34,35,322,708],'#FFF9E9');
    doc.elements.find(e=>e.id==='message-paper').visible=false;
    doc.elements.find(e=>e.id==='reading-contact').visible=false;
    doc.elements.find(e=>e.id==='photo-strip-paper').effects={surface:eventRecipe('paper-shadow-v2')};
    const frame=rect(1,'photo-window',[50,53,290,214],'#B4C1AC',0);frame.name='Khung ảnh kỷ niệm';
    frame.artwork={paths:[{d:'M0 0H100V100H0Z',fill:'#8BA193'},{d:'M0 70H100V100H0Z',fill:'#BFA889'},{d:'M34 53H66L61 88H39Z',fill:'#F1DEC0'},{d:'M50 55V12M50 31 26 20M50 42 76 27',fill:'none',stroke:'#466550',strokeWidth:2},{d:'M23 14C39 8 43 22 48 32 30 35 19 27 23 14ZM54 40C56 20 72 15 82 21 83 37 69 42 54 40Z',fill:'#4A7357'},{d:'M8 4H10V65H8Z',fill:'#B8CABB'}]};
    defaultPhoto(1,[50,53,290,214]);
    line(1,'satin-edge',[50,270,290,1],'#D9CBB0',1);
    note(1,'photo-caption',localize('templates.copy.polaroidCaption'),[50,278,290,30],15,'#3E4036');
  }
  const top=id==='polaroid'?328:y+10;
  heading(1,'message-heading',words(WISH_HEADINGS[id]),[x+5,top,w-10,64],24,wishInk);
  binding(1,'message-to','recipientName',[x+5,top+64,w-10,63],20,wishInk,'left');
  binding(1,'text-message','message',[x+5,top+145,w-10,Math.max(70,h-240)],19,wishInk,'left');
  binding(1,'text-sender','senderName',[x+5,y+h-65,w-10,58],19,wishInk,'right');
  if(id==='polaroid') {
    const find=key=>doc.elements.find(e=>e.id===key);
    Object.assign(find('message-to').layout,{y:390,height:52});
    Object.assign(find('text-message').layout,{y:458,height:186});
    Object.assign(find('text-sender').layout,{y:660,height:53});
    find('text-message').props.fontSize=18;
    find('text-message').props.lineHeight=1.5;
    find('text-sender').props.color='#2F3027';
  }
  const continueNode=action(1,'button','to-message',localize('templates.copy.leaveReply'),[x,749,Math.min(w,306),56],'scene-message');
  continueNode.name=words(spec.reply);
  const readingText=doc.elements.filter(e=>doc.scenes[1].elementIds.includes(e.id)&&e.type==='text'&&['message-heading','message-to','text-message','text-sender'].includes(e.id));
  const firstLine=Math.min(...readingText.map(e=>e.layout.y));
  const lastLine=Math.max(...readingText.map(e=>e.layout.y+e.layout.height));
  doc.scenes[1].flow={version:1,region:{x:x+5,y:firstLine,width:w-10,height:lastLine-firstLine}};

  // A different, tangible writing object accompanies every reply. The live form
  // remains the standard permission-aware reply element, including retry state.
  const [rx,ry,rw,rh]=spec.response;
  art(2,'keepsake',[250,18,120,135],'open');
  // The heading and keepsake occupy separate columns, including long EN labels.
  heading(2,'reply-heading',words(spec.reply),[30,53,210,134],27,ink);
  note(2,'reply-intro',id==='gentle-apology'?words(['Bạn có thể viết khi sẵn sàng, hoặc khép lại món quà tại đây.','Write whenever you feel ready, or simply close your gift here.']):localize('templates.copy.replyIntro'),[32,197,320,66],16,ink);
  depth(2,'reply-object-shadow',[rx-10,ry-9,rw+22,rh+24]);
  paper(2,'reply-object-paper',[rx-8,ry-12,rw+16,rh+24],id==='velvet-valentine-2027'?'#E7C9C0':'#EFE0C2');
  if(['afterglow','confetti','new-year-spark-2027','faraway-hug'].includes(id)){
    line(2,'reply-perforation',[rx+15,ry+8,rw-30,1],'#9E8A65',1).props.pattern='stitched';
    note(2,'reply-ticket-mark',id==='new-year-spark-2027'?'00:00':'↩',[rx+14,ry+16,60,24],15,'#34352D');
  } else if(['winter-wishes-2026','greenhouse','thank-you-bloom','midnight-bloom','sunny-wishes','peachy-day'].includes(id)){
    shape(2,'tag-eyelet',[rx+rw-34,ry+6,12,12],bg,'ellipse',{strokeColor:'#B19B73',strokeWidth:2});
    line(2,'tag-thread',[rx+rw-24,ry-55,74,2,72],'#A78F64',2);
  } else if(id==='lavender'){
    note(2,'specimen-number',words(['MẪU ÉP HOA · 01','BOTANICAL SPECIMEN · 01']),[rx+10,ry+8,rw-20,25],12,'#5E554E');
    rect(2,'specimen-tape',[rx-12,ry-17,61,17,-8],'#B9AE95',1).opacity=.8;
  } else if(id==='polaroid'||id==='mot-ky-niem'){
    for(let i=0;i<3;i++)line(2,`photo-back-rule-${i}`,[rx+15,ry+14+i*7,rw-30,1],'#C9BCA1',.5);
  }
  if(id==='love-letter')doc.elements.find(e=>e.id==='reply-intro').props.color='#34251F';
  const reply=add(2,'reply','reply-card',[rx+3,ry+42,rw-6,rh-52],{title:localize('templates.copy.replyCard'),submitLabel:localize('templates.copy.sendReply'),color:p.button});
  reply.name=words(spec.reply);
  action(2,'button','replay-gift',localize('templates.copy.replay'),[59,754,272,56]);
  // Stable IDs used by the insertion library's constellation composition.
  if(id==='starlight'&&!NATURAL_MEDIA_IDS[id]) {
    for(let i=0;i<3;i++){const star=shape(0,`star-${i}`,[118+i*60,325+i*45,7,7],'#F3DE9D');star.name=words(['Ngôi sao khắc trên đĩa','Engraved star']);}
    line(0,'constellation-1',[120,338,133,1,34],'#D9CEA0',1);
  }
  return true;
}
