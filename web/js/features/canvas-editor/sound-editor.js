import { node,field,trapDialog } from './dom.js';
import { t,currentLocale } from '../../core/i18n.js';
import { createSoundPlayer } from '../gift-runtime/audio.js';
import { soundUrl } from '../../shared/canvas/sound.js';

export const normalizeSoundSearch=value=>value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replaceAll('đ','d');
export async function openSoundEditor({current,assetUrl,upload,onApply,onRemove,registerDialog=()=>{},onClose=()=>{}}={}){
 const dialog=node('dialog',{class:'sfx-dialog','aria-label':t('sfx.title')}),status=node('p',{role:'status'}),list=node('div',{class:'sfx-list'}),details=node('section',{class:'sfx-details'}),trimHost=node('section',{class:'sfx-trim'});
 let selected=current?structuredClone(current):null,trimmer,disposed=false,busy=false,close,sourcePcm=null;
 const audio=createSoundPlayer({assetUrl,onError:()=>{status.textContent=t('sfx.playError');}});
 const search=node('input',{type:'search',placeholder:t('sfx.search'),'aria-label':t('sfx.search')}),group=node('select',{'aria-label':t('sfx.group')},node('option',{value:''},t('sfx.allGroups')));
 const file=node('input',{type:'file',disabled:true,accept:'.wav,.mp3,.m4a,.aac,audio/wav,audio/mpeg,audio/mp4,audio/aac'});
 const header=node('div',{class:'sfx-heading'},node('h2',{},t('sfx.title'))),exit=node('button',{type:'button'},t('sfx.close'));
 header.append(exit);dialog.append(header,node('p',{class:'editor-help'},t('sfx.hint')),field(t('sfx.search'),search),field(t('sfx.group'),group),list,field(t('sfx.upload'),file),status,details,trimHost);document.body.append(dialog);registerDialog(dialog);
 function dispose(){if(disposed)return;disposed=true;audio.dispose();trimmer?.dispose();onClose();}
 close=trapDialog(dialog,dispose);dialog.addEventListener('close',dispose,{once:true});exit.onclick=()=>{if(!busy)close();};
 const response=await fetch('/api/designs/sfx',{credentials:'same-origin'}).catch(()=>null);
 if(disposed)return;
 if(!response?.ok){status.textContent=t('sfx.catalogError');return;}
 const catalog=await response.json();
 if(disposed)return;
 const locale=currentLocale(),name=a=>a.name[locale]||a.name.vi;
 for(const a of catalog.assets)if(![...group.options].some(o=>o.value===a.group))group.append(node('option',{value:a.group},a.groupName[locale]));
 function renderList(){
  const q=normalizeSoundSearch(search.value);
  list.replaceChildren(...catalog.assets.filter(a=>(!group.value||group.value===a.group)&&normalizeSoundSearch(`${a.name.vi} ${a.name.en} ${a.keywords}`).includes(q)).map(a=>{
   const sound={kind:'library',id:a.id,version:a.version,startMs:0,endMs:a.durationMs,volume:1},row=node('div',{class:'sfx-row','data-sfx-id':a.id}),play=node('button',{type:'button','aria-label':t('sfx.previewNamed',{name:name(a)})},t('sfx.preview')),stop=node('button',{type:'button'},t('sfx.stop')),choose=node('button',{type:'button',disabled:!catalog.createEnabled,'aria-label':t('sfx.chooseNamed',{name:name(a)})},t('sfx.choose'));
   row.append(node('div',{},node('strong',{},name(a)),node('small',{},`${a.name[locale==='vi'?'en':'vi']} · ${(a.durationMs/1000).toFixed(2)} s`),a.version>=2?node('small',{},`${a.author} · ${a.license}`):null),play,stop,choose);
   play.onclick=()=>{void audio.play(sound,{explicit:true});};stop.onclick=()=>audio.stop();choose.onclick=()=>{audio.stop();trimmer?.dispose();sourcePcm=null;selected=sound;renderDetails();};return row;
  }));
 }
 async function openTrim(buffer,personal){
  const {mountTrimmer}=await import('./audio-trimmer.js');if(disposed)return;
  trimmer?.dispose();audio.stop();details.hidden=true;list.hidden=true;search.disabled=group.disabled=file.disabled=true;
  const previousSelection=selected?structuredClone(selected):null,previousPcm=sourcePcm;let preparedKey,preparedPcm;
  trimmer=mountTrimmer(trimHost,{buffer,startMs:personal?0:selected.startMs,endMs:personal?Math.min(10000,buffer.duration*1000):selected.endMs,volume:selected?.volume??1,
   onCancel:()=>{selected=previousSelection;sourcePcm=previousPcm;trimmer.dispose();trimmer=null;finishTrim();renderDetails();},
   onApply:async cut=>{
    if(personal){const key=`${cut.startMs}:${cut.endMs}`;if(preparedKey!==key){preparedPcm=cut.pcm();preparedKey=key;}sourcePcm=preparedPcm;}else selected={...selected,startMs:cut.startMs,endMs:cut.endMs};
    selected={...(personal?{kind:'audio'}:selected),volume:cut.volume};
    await applySelection(trimHost.querySelector('button.editor-primary'));
   }});
 }
 function finishTrim(){details.hidden=false;list.hidden=false;search.disabled=group.disabled=false;file.disabled=!catalog.createEnabled;}
 function renderDetails(){
  if(!selected){details.replaceChildren();return;}
  const info=selected.kind==='library'?catalog.assets.find(a=>a.id===selected.id&&a.version===selected.version):null;
  const level=node('input',{type:'range',min:0,max:1,step:.01,value:selected.volume}),trim=node('button',{type:'button'},t('sfx.trim')),apply=node('button',{type:'button',class:'editor-primary',disabled:!catalog.createEnabled},t('sfx.apply')),remove=node('button',{type:'button',disabled:!current},t('sfx.remove')),preview=node('button',{type:'button'},t('sfx.previewSegment')),stop=node('button',{type:'button'},t('sfx.stop'));
  details.replaceChildren(node('h3',{},info?name(info):t(selected.kind==='library'?'sfx.legacyLibrary':'sfx.personal')),field(t('sfx.volume'),level),node('p',{class:'editor-help'},t('sfx.textHint')),node('div',{class:'sfx-actions'},preview,stop,trim,apply,remove));
  level.oninput=()=>{selected.volume=Number(level.value);audio.stop();};stop.onclick=()=>audio.stop();
  preview.onclick=async()=>{
   if(sourcePcm){void audio.play(selected,{explicit:true,bytes:sourcePcm.bytes});return;}
   void audio.play(selected,{explicit:true});
  };
  async function trimCurrent(){
   audio.stop();busy=true;status.textContent=t('sfx.decoding');
   try{
    const {decodeSource}=await import('./audio-trimmer.js');let bytes;
    if(sourcePcm)bytes=sourcePcm.bytes;else{const r=await fetch(soundUrl(selected,assetUrl));if(!r.ok)throw new Error(t('sfx.playError'));bytes=await r.arrayBuffer();}
    const buffer=await decodeSource(new File([bytes],'segment.wav',{type:'audio/wav'}));if(!disposed)await openTrim(buffer,selected.kind==='audio');status.textContent='';
   }catch(error){status.textContent=error.message;}finally{busy=false;}
  }
  trim.onclick=trimCurrent;
  remove.onclick=()=>{onRemove();close();};
  apply.onclick=()=>applySelection(apply);
 }
 async function applySelection(apply){
   if(busy)return;busy=true;const previousFileDisabled=file.disabled;apply.disabled=exit.disabled=true;details.inert=list.inert=trimHost.inert=true;file.disabled=true;dialog.addEventListener('cancel',blockCancel,true);
   try{
    let sound=selected;
    if(sourcePcm){const asset=await upload(sourcePcm.bytes);sound={kind:'audio',assetId:asset.id,volume:selected.volume};}
    if(disposed)return;await onApply(sound);close();
   }catch(error){status.textContent=error.message;}finally{busy=false;apply.disabled=exit.disabled=false;details.inert=list.inert=trimHost.inert=false;file.disabled=previousFileDisabled;dialog.removeEventListener('cancel',blockCancel,true);}
 }
 function blockCancel(event){event.preventDefault();event.stopImmediatePropagation();}
 file.onchange=async()=>{
  if(!file.files?.[0]||busy)return;
  busy=true;status.textContent=t('sfx.decoding');
  try{const {decodeSource}=await import('./audio-trimmer.js');const buffer=await decodeSource(file.files[0]);if(disposed)return;await openTrim(buffer,true);status.textContent='';}
  catch(error){status.textContent=error.message;}finally{busy=false;file.value='';}
 };
 search.oninput=renderList;group.onchange=renderList;file.disabled=!catalog.createEnabled;
 if(!catalog.createEnabled)status.textContent=t('sfx.createDisabled');
 renderList();renderDetails();
 return {dialog,dispose:()=>{dispose();dialog.close();dialog.remove();}};
}
