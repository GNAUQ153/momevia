import {applySoftAppearance} from './soft-appearance.js';
import {softDuration} from '../../shared/canvas/drive-soft.js';
import {OBJECT_APPEARANCE,DIPLOMA_MASK} from '../../shared/canvas/natural-objects.js';
import { calendarMonth, graduationPassSvg } from '../../shared/canvas/drive-data.js';
import { currentLocale, t } from '../../core/i18n.js';

export function renderDriveInteraction(model,{mode,signal,renderPhoto,document:doc,invitation,activate}) {
  const p=structuredClone(model.props),live=['preview','public'].includes(mode);
  let first={...p.entries[0],...(p.bodyBinding==='message'?{body:doc?.bindings?.message?.value||p.entries[0].body}:{})};
  const node=(tag,css,text)=>{const el=globalThis.document.createElement(tag);if(css)el.className=css;if(text!==undefined)el.textContent=text;return el;};
  const root=node('section',`gift-drive-block gift-drive-${p.kind}`);root.style.backgroundColor=p.color;const soft=applySoftAppearance(root,p);
  const natural=p.appearance===OBJECT_APPEARANCE&&p.objectAssetId;
  if(natural)root.classList.add('gift-drive-natural');
  const objectArt=css=>{const wrapper=node('span',css),art=renderPhoto({id:model.id+'-object',assetId:p.objectAssetId,fit:'contain',decorative:true,focalPoint:{x:.5,y:.5}});
    if(css==='gift-natural-diploma-art'){
      art.style.clipPath=`polygon(${DIPLOMA_MASK.map(([x,y])=>x+'% '+y+'%').join(',')})`;
      // The existing photograph includes a navy cap above the warm diploma.
      // Keep its original alpha and warm pixels; key out only dark cap remnants.
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),filter=document.createElementNS(svg.namespaceURI,'filter'),matrix=document.createElementNS(svg.namespaceURI,'feColorMatrix'),composite=document.createElementNS(svg.namespaceURI,'feComposite');
      svg.setAttribute('width','0');svg.setAttribute('height','0');filter.id='diploma-key-'+crypto.randomUUID();filter.setAttribute('color-interpolation-filters','sRGB');matrix.setAttribute('values','1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 20 0 -20 0 0');matrix.setAttribute('result','warm-mask');composite.setAttribute('in','SourceGraphic');composite.setAttribute('in2','warm-mask');composite.setAttribute('operator','in');filter.append(matrix,composite);svg.append(filter);art.append(svg);art.style.filter=`url(#${filter.id})`;
    }wrapper.append(art);return wrapper;};
  const listen=(el,event,fn)=>{if(live)el.addEventListener(event,fn,{signal});};
  const button=(text,fn,css='')=>{const el=node(live?'button':'span',`gift-drive-button ${css}`,text);if(live){el.type='button';listen(el,'click',event=>activate?activate(el,event,()=>fn?.(event)):fn?.(event));}return el;};
  const title=node('h3','gift-drive-title',p.kind==='four-choice-quiz'?(p.question||t('drive.quizQuestion')):first.heading),status=node('p','gift-drive-status');status.setAttribute('role','status');
  root.append(title);
  const complete=(control,text)=>{if(root.dataset.complete)return false;root.dataset.complete='true';control?.setAttribute('aria-expanded','true');status.textContent=text;return true;};
  const photo=()=>p.photos?.[0]?.assetId?renderPhoto(p.photos[0]):node('div','gift-drive-photo-empty',t('drive.noPhoto'));
  if(p.kind==='calendar-peel'){
    const eventAt=p.clockSource==='invitation'?doc?.invitation?.eventAt:p.eventAt,timeZone=p.clockSource==='invitation'?doc?.invitation?.timeZone:p.timeZone;
    const month=calendarMonth(eventAt,timeZone,currentLocale());
    const calendar=node('div','gift-drive-calendar');
    if(month){
      calendar.append(node('p','gift-drive-month',month.title));
      const grid=node('div','gift-drive-calendar-grid');
      for(const s of t('drive.weekdays').split('|'))grid.append(node('span','gift-drive-weekday',s));
      for(let i=0;i<month.offset;i++)grid.append(node('span',''));
      for(let day=1;day<=month.days;day++){
        if(day===month.day){const peel=button(String(day),()=>{if(complete(peel,first.body))peel.classList.add('is-peeled');},'gift-drive-date-sticker');peel.setAttribute('aria-label',t('drive.peelDay',{day}));calendar.dataset.eventDay=String(day);grid.append(peel);}
        else grid.append(node('span','gift-drive-day',String(day)));
      }
      calendar.append(grid);
    }else calendar.append(node('p','',t('drive.chooseEvent')));
    const open=button(t('drive.openNow'),()=>{complete(open,first.body);root.querySelector('.gift-drive-date-sticker')?.classList.add('is-peeled');});
    root.append(calendar,open);
  }else if(p.kind==='camera-print'){
    const camera=node('div','gift-drive-camera'),lens=node('span','gift-drive-lens');camera.append(lens);
    if(natural)camera.append(objectArt('gift-natural-camera-art'));
    const print=node('figure','gift-drive-print');print.append(photo(),node('figcaption','',p.photos[0].caption));
    const snap=button(t('drive.takePhoto'),()=>{if(complete(snap,first.body))root.classList.add('is-printed');});
    if(live){camera.setAttribute('role','button');camera.tabIndex=0;camera.setAttribute('aria-label',t('drive.takePhoto'));listen(camera,'click',()=>snap.click());listen(camera,'keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();snap.click();}});}
    root.append(camera,print,snap);
  }else if(p.kind==='focus-photo'){
    const lens=node('div','gift-drive-focus-lens'),picture=photo();lens.append(picture);root.append(lens);
    const range=node('input','gift-drive-focus-range');range.type='range';range.min='0';range.max='100';range.value='0';range.setAttribute('aria-label',t('drive.focus'));
    const update=value=>{picture.style.filter=`blur(${(100-value)/12}px)`;range.value=String(value);if(value>=95)complete(auto,first.body);};
    const auto=button(t('drive.autoFocus'),()=>update(100));listen(range,'input',()=>update(Number(range.value)));update(live?0:100);
    if(live)root.append(range);root.append(auto);
  }else if(p.kind==='four-choice-quiz'){
    const options=node('div','gift-drive-quiz');
    for(const [i,entry]of p.entries.entries()){
      const option=button(`${String.fromCharCode(65+i)}. ${entry.heading}`,()=>{for(const b of options.children)b.setAttribute('aria-pressed',String(b===option));status.textContent=entry.body;root.dataset.choice=String(i);});option.setAttribute('aria-pressed','false');options.append(option);
    }root.append(options);
  }else if(p.kind==='tear-ticket'){
    const label=node('label','gift-drive-name',t('drive.guestName')),name=node('input','');name.maxLength=80;name.value=doc?.bindings?.recipientName?.value||'';label.append(name);
    const ticket=node('div','gift-drive-pass');ticket.append(node('p','',first.body));
    const who=node('strong',''),when=node('p',''),where=node('p','');ticket.append(who,when,where);
    if(soft)ticket.append(node('span','gift-drive-ticket-stub','MOMEVIA'));
    const event=doc?.invitation||invitation||p;
    const render=()=>{who.textContent=name.value||t('drive.specialGuest');when.textContent=event.eventAt?new Intl.DateTimeFormat(currentLocale(),{timeZone:event.timeZone,dateStyle:'long',timeStyle:'short'}).format(new Date(event.eventAt)):t('drive.chooseEvent');where.textContent=invitation?.venue||doc?.elements?.find(e=>e.id===doc.invitation?.venueElementId)?.props.text||'';};
    const pull=button(t('drive.pullTicket'),()=>{root.classList.add('is-pulled');status.textContent=t('drive.ticketReady');});
    const tear=button(t('drive.tearTicket'),()=>{root.classList.add('is-pulled');if(complete(tear,t('drive.ticketTorn')))ticket.classList.add('is-torn');});
    const download=button(t('drive.saveTicket'),()=>{
      render();const svg=graduationPassSvg({name:name.value||t('drive.specialGuest'),eventAt:event.eventAt,timeZone:event.timeZone,venue:where.textContent,title:first.body});
      const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=node('a','');a.href=url;a.download='momevia-graduation-pass.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    listen(name,'input',render);render();root.append(label,ticket,pull,tear,download);
  }else{
    const body=node('p','gift-drive-reveal-body',first.body),paper=node('div',`gift-drive-paper gift-drive-paper-${p.kind}`);
    if(p.kind==='cap-toss'){
      const cap=node('span','gift-drive-cap',soft?'':'◆');
      if(natural)cap.append(objectArt('gift-natural-cap-art'));
      else if(soft){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 130 100');
        for(const[d,fill,stroke]of [['M7 33L65 5 123 33 65 62Z',p.inkColor||'#272936',p.detailColor||'#D8AE63'],['M31 51V76Q65 99 99 76V51',p.inkColor||'#272936','none'],['M120 34V78M116 79H124V91H116Z',p.detailColor||'#D8AE63',p.detailColor||'#D8AE63']]){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill',fill);path.setAttribute('stroke',stroke);path.setAttribute('stroke-width','2');svg.append(path);}cap.append(svg);
      }paper.append(cap);
    }
    else if(p.kind==='ribbon-diploma')paper.append(natural?objectArt('gift-natural-diploma-art'):node('span','gift-drive-ribbon','∞'));
    else if(p.kind==='grade-stamp')paper.append(node('span','gift-drive-stamp',t('drive.graduated')));
    else paper.append(node('span','gift-drive-tape',''));
    paper.append(body);
    body.hidden=p.kind!=='grade-stamp';
    const open=button(t(`drive.action.${p.kind}`),()=>{if(complete(open,t('drive.opened'))){body.hidden=false;root.classList.add('is-revealed');}});
    root.append(paper,open);
  }
  // Each swipe/drag gesture has the same single-click/keyboard path above.
  let start;
  listen(root,'pointerdown',e=>{if(p.kind==='calendar-peel'){if(!e.target.closest('.gift-drive-date-sticker'))return;}else if(e.target.closest('input,textarea,button'))return;start={x:e.clientX,y:e.clientY,id:e.pointerId};});
  listen(root,'pointerup',e=>{if(start?.id===e.pointerId&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>45){const controls=root.querySelectorAll('button');controls[p.kind==='tear-ticket'&&root.classList.contains('is-pulled')?1:0]?.click();}start=null;});
  for(const event of ['pointercancel','lostpointercapture'])listen(root,event,()=>{start=null;});
  if(soft){const reset=button(t('soft.tryAgain'),()=>{
    delete root.dataset.complete;delete root.dataset.choice;root.classList.remove('is-printed','is-revealed','is-pulled');root.querySelector('.gift-drive-pass')?.classList.remove('is-torn');root.querySelector('.gift-drive-date-sticker')?.classList.remove('is-peeled');
    const body=root.querySelector('.gift-drive-reveal-body');if(body)body.hidden=p.kind!=='grade-stamp';
    const focus=root.querySelector('.gift-drive-focus-range');if(focus){focus.value='0';root.querySelector('.gift-drive-focus-lens > *').style.filter='blur(8.33333px)';}
    for(const choice of root.querySelectorAll('[aria-pressed]'))choice.setAttribute('aria-pressed','false');for(const control of root.querySelectorAll('[aria-expanded]'))control.setAttribute('aria-expanded','false');status.textContent=t('soft.ready');
  },'gift-drive-reset');root.append(reset);}
  root.updateDriveCopy=(next,nextDoc)=>{
    Object.assign(p,structuredClone(next.props));first={...p.entries[0],...(p.bodyBinding==='message'?{body:nextDoc?.bindings?.message?.value||p.entries[0].body}:{})};
    title.textContent=p.kind==='four-choice-quiz'?(p.question||t('drive.quizQuestion')):first.heading;
    const body=root.querySelector('.gift-drive-reveal-body');if(body)body.textContent=first.body;
    if(root.dataset.complete&&p.kind!=='tear-ticket')status.textContent=first.body;
    if(p.kind==='four-choice-quiz'){for(const[i,control]of [...root.querySelectorAll('.gift-drive-quiz button')].entries())control.textContent=`${String.fromCharCode(65+i)}. ${p.entries[i].heading}`;if(root.dataset.choice!==undefined)status.textContent=p.entries[Number(root.dataset.choice)].body;}
    const month=root.querySelector('.gift-drive-month');if(month){const event=p.clockSource==='invitation'?nextDoc.invitation:p;month.textContent=calendarMonth(event?.eventAt,event?.timeZone,currentLocale())?.title||'';}
    const caption=root.querySelector('figcaption');if(caption)caption.textContent=p.photos?.[0]?.caption||'';
    const reset=root.querySelector('.gift-drive-reset');if(reset)reset.textContent=t('soft.tryAgain');
    for(const[i,day]of [...root.querySelectorAll('.gift-drive-weekday')].entries())day.textContent=t('drive.weekdays').split('|')[i];
    const camera=root.querySelector('.gift-drive-camera');if(camera)camera.setAttribute('aria-label',t('drive.takePhoto'));
    const labels={ 'calendar-peel':['drive.openNow'],'camera-print':['drive.takePhoto'],'focus-photo':['drive.autoFocus'],'tear-ticket':['drive.pullTicket','drive.tearTicket','drive.saveTicket'] }[p.kind]||(!['four-choice-quiz'].includes(p.kind)?['drive.action.'+p.kind]:[]);
    const controls=root.querySelectorAll('button:not(.gift-drive-date-sticker)');for(const[i,control]of [...controls].entries())if(labels[i])control.textContent=t(labels[i]);
  };
  root.append(status);return root;
}

export function decorateDriveOpening(node,preset,label,color,sealColor,paperColor,mode,signal,settings={}){
  node.style.setProperty('--drive-opening-color',color);node.style.setProperty('--drive-seal-color',sealColor||'#D7B67C');node.style.setProperty('--drive-paper-color',paperColor||'#FFF3DC');
  node.classList.add('gift-drive-opening',preset.startsWith('lid-card')?'gift-drive-box':'gift-drive-envelope');
  if(preset.endsWith('-v2')){node.classList.add('gift-drive-opening-soft');node.style.setProperty('--drive-radius',(settings.cornerRadius??22)+'px');node.style.setProperty('--drive-duration',softDuration(settings.motionSpeed)+'ms');}
  const part=(css,text)=>{const e=globalThis.document.createElement('span');e.className=css;if(text)e.textContent=text;e.setAttribute('aria-hidden','true');return e;};
  node.replaceChildren(part('gift-drive-sliding-card',label),part('gift-drive-box-body'),part('gift-drive-flap'),part('gift-drive-bow',preset.startsWith('lid-card')?'∞':label),part('gift-drive-opening-label',preset.startsWith('wax-letter')?t('drive.openNow'):label));
  if(preset==='lid-card-v2'){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 70');
    for(const d of ['M49 39C21 5 2 6 6 34C8 56 27 55 49 39Z','M51 39C79 5 98 6 94 34C92 56 73 55 51 39Z','M43 35H57V48H43Z','M46 43L32 69L49 61L57 69L55 43Z']){
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill',sealColor||'#BB8050');path.setAttribute('stroke','#875832');path.setAttribute('stroke-width','1.2');svg.append(path);
    }node.querySelector('.gift-drive-bow').replaceChildren(svg);
  }
  if(['preview','public'].includes(mode)){
    let start;node.style.touchAction='none';
    node.addEventListener('pointerdown',e=>{start={id:e.pointerId,x:e.clientX,y:e.clientY};},{signal});
    node.addEventListener('pointerup',e=>{if(start?.id===e.pointerId&&(start.y-e.clientY>45||Math.abs(start.x-e.clientX)>60)){e.preventDefault();node.click();}start=null;},{signal});
    for(const event of ['pointercancel','lostpointercapture'])node.addEventListener(event,()=>{start=null;},{signal});
  }
}
export function playDriveOpening(control,motion,signal,duration=850){
  control.classList.add('is-opening');
  if(motion?.enabled()===false||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return Promise.resolve();
  return new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};timer=setTimeout(finish,duration);signal?.addEventListener('abort',finish,{once:true});if(signal?.aborted)finish();});
}
