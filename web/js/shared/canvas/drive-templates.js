import { openMeDocument } from './open-me-document.js';
import { polishDriveDocument } from './drive-polish.js';
import { driveBlockModels } from './drive-elements.js';
import { pinDocumentArtwork } from './library-materialize.js';

export const DRIVE_TEMPLATE_META=Object.freeze([
 {id:'secret-santa-invitation',theme:'sage',scenes:9,category:'christmas',palette:{paper:'#FFF3DC',ink:'#183E35',accent:'#983F4E',detail:'#BB8050',cover:'#183E35'}},
 {id:'midnight-soiree',theme:'navy',scenes:9,category:'invitation',palette:{paper:'#FFF2DB',ink:'#141B32',accent:'#773447',detail:'#D7B67C',cover:'#141B32'}},
 {id:'graduation-countdown',theme:'rose',scenes:8,category:'graduation',palette:{paper:'#F4E6E8',ink:'#27394B',accent:'#7D3854',detail:'#EAC572',cover:'#F4E6E8'}},
 {id:'graduation-mixtape',theme:'cream',scenes:9,category:'graduation',palette:{paper:'#F7EDDD',ink:'#272936',accent:'#67324D',detail:'#A8B9C9',cover:'#D8A8BE'}},
 {id:'the-last-chapter-v2',theme:'sky',scenes:10,category:'graduation',palette:{paper:'#EEF3F6',ink:'#29445D',accent:'#A84540',detail:'#D8AE63',cover:'#EEF3F6'}},
]);
export function createDriveTemplate(id,localize){
 const meta=DRIVE_TEMPLATE_META.find(m=>m.id===id);if(!meta)return null;
 const p=meta.palette,h=openMeDocument(id,localize,p),{doc,c,scene,add,text,heading,binding,shape}=h;
 doc.personalization={version:1,mode:'self'};
 const page=(name,bg=p.paper)=>{
  const at=scene(`scene-${name}`,`scene.${name}`,bg);
  if(id==='the-last-chapter-v2')for(let i=0;i<9;i++)add(at,'line',`${at}-notebook-rule-${i}`,[16,148+i*76,358,1],{color:'#C8D8E1',strokeWidth:1});
  return at;
 };
 const title=(at,key,y=70,size=36,color=p.ink)=>heading(at,`${at}-heading`,c(key),[28,y,334,96],size,color,'serif');
 const copy=(at,key,value,box,size=19,color=p.ink)=>text(at,key,value,box,size,color,'body','center');
 const block=(at,kind,box)=>{
  const models=driveBlockModels(kind,localize,{soft:kind==='pine-gift-tag'}),prefix=`${at}-${kind}`,map=new Map(models.map((e,i)=>[e.id,prefix+'-'+i]));
  const minX=Math.min(...models.map(e=>e.layout.x)),minY=Math.min(...models.map(e=>e.layout.y));
  const w=Math.max(...models.map(e=>e.layout.x+e.layout.width))-minX,h=Math.max(...models.map(e=>e.layout.y+e.layout.height))-minY;
  for(const model of models){model.id=map.get(model.id);if(model.groupId)model.groupId=map.get(model.groupId);const l=model.layout;Object.assign(l,{x:box[0]+(l.x-minX)*box[2]/w,y:box[1]+(l.y-minY)*box[3]/h,width:l.width*box[2]/w,height:l.height*box[3]/h});
   if(model.props.entries)model.props.entries.forEach((e,i)=>{if(kind!=='four-choice-quiz'){e.heading=c(`${kind}.heading`);e.body=c(`${kind}.body`);}else {e.heading=c(`quiz.answer.${i}`);e.body=c(`quiz.feedback.${i}`);}});
   if(['calendar-peel','tear-ticket'].includes(model.props.kind))model.props.clockSource='invitation';
   doc.elements.push(model);doc.scenes.find(s=>s.id===at).elementIds.push(model.id);
  }return models;
 };
 const photo=(at,key,box)=>{shape(at,key+'-paper',[box[0]-8,box[1]-8,box[2]+16,box[3]+44],'#FFF9EC','rectangle',{strokeColor:p.detail,strokeWidth:1});return add(at,'image',key,box,{assetId:null,optional:true,fit:'cover',radius:0,caption:c('photoCaption'),placeholder:'portrait'},{accessibility:{alt:c('photoAlt')}});};
 const voice=at=>add(at,'sound-button',`${at}-voice`,[50,645,290,54],{label:c('voice'),color:p.accent,optional:true});
 const next=(at,target,label='continue',x=82,y=764,width=284)=>add(at,'button',`${at}-next`,[x,y,width,56],{label:c(label),color:p.accent,placement:'footer'},{actions:[{on:'activate',type:'goToScene',targetSceneId:target}]});
 const back=(at,target)=>add(at,'button',`${at}-previous`,[24,764,46,56],{label:'‹',color:p.accent,variant:'text',placement:'footer'},{accessibility:{label:localize('catalog.pagination.prev')},actions:[{on:'activate',type:'goToScene',targetSceneId:target}]});
 const event=()=>{
  const at=page('details');title(at,'details',54,32);
  shape(at,'event-paper',[22,160,346,210],'#FFF9EC','rectangle',{strokeColor:p.detail,strokeWidth:1});
  copy(at,'event-date','',[35,178,320,64],19);copy(at,'event-location','',[35,265,320,84],21);
  doc.invitation={dateElementId:'event-date',venueElementId:'event-location',eventAt:null,timeZone:'Asia/Ho_Chi_Minh'};
  for(const [type,key,x]of [['openEventMap','map',28],['saveEventCalendar','calendar',201]])add(at,'button','event-'+key,[x,390,161,54],{label:c(key),color:p.accent},{actions:[{on:'activate',type}]});
  add(at,'interaction','event-clock',[28,470,334,155],{kind:'event-countdown',clockSource:'invitation',eventAt:null,timeZone:'Asia/Ho_Chi_Minh',optional:true,color:'#FFF9EC',entries:[{heading:c('countdown'),body:c('arrived')}]});
  add(at,'button','event-rsvp',[104,654,182,44],{label:c(id==='graduation-mixtape'?'leaveNote':'rsvp'),color:p.accent,variant:'text'},{actions:[{on:'activate',type:'goToScene',targetSceneId:'scene-reply'}]});
  return at;
 };
 const invite=()=>{const at=page('invitation');title(at,'headline',110,45);binding(at,'text-recipient','recipientName',[32,237,326,72],24,p.ink,'center');photo(at,'hero-photo',[107,352,176,215]);binding(at,'text-sender','senderName',[32,645,326,48],20,p.ink,'center');return at;};
 const letter=()=>{const at=page('message');title(at,'messageTitle',77,32);shape(at,'letter-paper',[22,206,346,420],'#FFF9EC','rectangle',{strokeColor:p.detail,strokeWidth:1});binding(at,'text-message','message',[42,239,306,338],21,p.ink,'left');voice(at);return at;};
 const album=()=>{const at=page('album');title(at,'album',74,34);add(at,'interaction','memory-album',[26,216,338,420],{kind:'swipe-album',color:'#FFF9EC',optional:true,zoom:true,photos:[0,1,2].map(i=>({id:`album-photo-${i}`,assetId:null,alt:'',caption:'',focalPoint:{x:.5,y:.5}}))});return at;};
 const reply=()=>{const at=page('reply');if(id==='graduation-mixtape'){
  title(at,'leaveNote',60,32);add(at,'reply','reply-card',[24,194,342,440],{replyMode:'message',title:c('replyTitle'),submitLabel:c('sendReply'),color:p.accent});
 }else add(at,'reply','attendance',[24,24,342,650],{replyMode:'attendance',appearance:'paper-v1',title:localize('rsvp.title'),submitLabel:localize('rsvp.save'),color:p.accent});return at;};
 const outro=()=>{const at=page('outro');title(at,'thanks',185,40);copy(at,'outro-message',c('outro'),[38,346,314,190],23);binding(at,'outro-sender','senderName',[40,566,310,60],20,p.ink,'center');return at;};
 const cover=page('cover',p.cover);
 if(id==='secret-santa-invitation'||id==='midnight-soiree'){
  const dark=p.cover;title(cover,'headline',76,44,p.paper);binding(cover,'cover-recipient','recipientName',[35,202,320,66],21,p.paper,'center');
  const [open]=block(cover,id==='secret-santa-invitation'?'santa-gift-box':'soiree-envelope',[33,307,324,352]);open.props.label=c('seal');open.accessibility.label=c('open');open.actions=[{on:'activate',type:'goToScene',targetSceneId:'scene-invitation'}];
  if(id==='secret-santa-invitation'){
   for(const e of block(cover,'pine-gift-tag',[180,275,190,90]))if(e.type==='text'){e.props.text=c('tag');e.props.fontSize=12;}
  }
  else {shape(cover,'champagne-border',[18,18,354,808],dark,'rectangle',{strokeColor:p.detail,strokeWidth:1});doc.scenes[0].elementIds.unshift(doc.scenes[0].elementIds.pop());}
  copy(cover,'cover-hint',c('hint'),[55,731,280,60],16,p.paper);
  invite();letter();event();
  const programme=page('programme');title(programme,'programme',66,34);
  add(programme,'line','timeline-stem',[49,213,1,439],{color:p.detail,strokeWidth:2});
  for(let i=0;i<4;i++){const y=206+i*112;shape(programme,`programme-dot-${i}`,[42,y+10,15,15],p.accent,'ellipse');copy(programme,`programme-time-${i}`,c('time'+i),[77,y,270,32],21,p.accent).props.align='left';copy(programme,`programme-item-${i}`,c('programme'+i),[77,y+38,270,65],18).props.align='left';}
  const dress=page('dress');title(dress,'dress',177,34);copy(dress,'dress-note',c('dressNote'),[35,319,320,175],21);[p.paper,p.accent,p.detail,p.ink].forEach((color,i)=>shape(dress,'swatch-'+i,[70+i*64,559,43,43],color,'ellipse',{strokeColor:p.ink,strokeWidth:1}));
  const secret=page('secret');title(secret,'secret',120,32);add(secret,'interaction','secret-scratch',[30,311,330,235],{kind:'scratch-ticket',appearance:'scratch-progress-v1',color:p.detail,entries:[{heading:c('scratch'),body:c('secretBody')}]});
  reply();outro();
 }else if(id==='graduation-countdown'){
  title(cover,'headline',55,35);block(cover,'calendar-peel',[26,191,338,442]);copy(cover,'cover-hint',c('hint'),[38,667,314,64],18);invite();event();
  const diary=page('diary');title(diary,'diary',75,34);add(diary,'interaction','diary-foldout',[26,238,338,325],{kind:'foldout-letter',appearance:'paper-fold-v2',color:'#FFF8E8',entries:[0,1,2].map(i=>({heading:c('diary'+i),body:c('diaryBody'+i)}))});
  letter();album();reply();outro();
 }else if(id==='graduation-mixtape'){
  title(cover,'headline',58,40);block(cover,'camera-print',[26,190,338,438]);block(cover,'vinyl-record',[300,645,60,60]);copy(cover,'cover-hint',c('hint'),[34,676,310,50],17);invite();event();letter();album();
  const caps=page('caps');title(caps,'caps',77,35);block(caps,'cap-toss',[26,238,338,345]);
  const notes=page('notes');title(notes,'foldNote',76,34);add(notes,'interaction','folded-note',[26,254,338,280],{kind:'foldout-letter',appearance:'paper-fold-v2',color:'#FFF8E8',entries:[0,1,2].map(i=>({heading:c('diary'+i),body:c('diaryBody'+i)}))});reply();outro();
 }else{
  title(cover,'headline',54,38);block(cover,'focus-photo',[26,181,338,436]);copy(cover,'cover-hint',c('hint'),[34,659,322,64],17);
  const yearbook=page('yearbook');title(yearbook,'yearbook',72,38);photo(yearbook,'yearbook-photo',[87,226,216,292]);binding(yearbook,'yearbook-sender','senderName',[36,600,318,50],23,p.ink,'center');
  const report=page('report');title(report,'report',69,34);block(report,'grade-stamp',[26,214,338,402]);
  const diploma=page('diploma');title(diploma,'diploma',77,34);block(diploma,'ribbon-diploma',[26,237,338,372]);event();
  const quiz=page('quiz');title(quiz,'quiz',69,34);block(quiz,'four-choice-quiz',[26,209,338,437]);
  const secret=page('message');title(secret,'messageTitle',76,32);block(secret,'peel-letter',[26,216,338,360])[0].props.bodyBinding='message';voice(secret);
  const ticket=page('ticket');block(ticket,'tear-ticket',[26,50,338,630]);reply();outro();
 }
 // Deterministic reading path, with a direct RSVP/reply route before the games.
 for(let i=0;i<doc.scenes.length;i++){
  const at=doc.scenes[i].id;if(i)back(at,doc.scenes[i-1].id);
  if(i<doc.scenes.length-1){if(i||!['secret-santa-invitation','midnight-soiree'].includes(id))next(at,doc.scenes[i+1].id,i===0?'open':'continue');}
  else add(at,'button','replay-gift',[82,764,284,56],{label:c('replay'),color:p.accent,placement:'footer'},{actions:[{on:'activate',type:'replay'}]});
  if(i){doc.scenes[i].effects={transition:{id:['scene-message','scene-diary'].includes(at)?'T08':'T07',speed:'normal'}};}
 }
 h.music(id==='secret-santa-invitation'?'christmas':'general');
 for(const e of doc.elements)if(e.name.startsWith(`templates.${id}.layer.`))e.name=(e.props.textBinding?localize('editor.binding.'+e.props.textBinding):e.props.text||e.accessibility.label||e.props.title||localize('editor.element.'+e.type)).slice(0,100);
 return pinDocumentArtwork(polishDriveDocument(doc,id,p,localize));
}
