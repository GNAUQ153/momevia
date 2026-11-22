import { t } from '../../core/i18n.js';
import { RESTYLE_PAIRS } from '../../shared/canvas/template-slots.js';
import { eventMediaUrl } from '../../shared/canvas/event-media.js';
import { mountPlayer } from '../gift-runtime/index.js';

// One player for Catalog trial and existing-draft restyling.
export async function openTemplateTrial({templateId,request,navigate,sourceDesign,save,signal}) {
 const targets=RESTYLE_PAIRS[templateId];if(!targets)return;
 const opener=document.activeElement,dialog=document.createElement('dialog');dialog.className='template-preview-dialog';
 const heading=document.createElement('h2');heading.textContent=t(sourceDesign?'restyle.title':'restyle.trial');
 const controls=document.createElement('div');controls.className='template-preview-toolbar';
 const select=document.createElement('select');select.setAttribute('aria-label',t('restyle.target'));
 for(const id of sourceDesign?targets:[templateId,...targets]){const o=document.createElement('option');o.value=id;o.textContent=t(`templates.${id}.title`);select.append(o);}
 const close=document.createElement('button');close.className='btn btn--outline';close.type='button';close.textContent=t('common.actions.close');
 controls.append(select,close);
 const review=document.createElement('button');review.type='button';review.className='btn btn--outline';review.textContent=t('restyle.review');controls.append(review);
 const form=document.createElement('div');form.className='template-trial-fields';
 const bindings={};
 for(const key of ['recipientName','senderName','message']){
  const label=document.createElement('label');label.textContent=t(`catalog.personalization.${key}`);
  const input=document.createElement(key==='message'?'textarea':'input');input.maxLength=key==='message'?1000:60;input.dataset.trialBinding=key;
  bindings[key]=input;label.append(input);form.append(label);
 }
 if(sourceDesign)form.hidden=true;
 const status=document.createElement('p');status.setAttribute('role','status');
 const losses=document.createElement('label'),accept=document.createElement('input');accept.type='checkbox';losses.hidden=true;losses.append(accept,document.createTextNode(t('restyle.acceptMissing')));
 const host=document.createElement('div'),confirm=document.createElement('button');confirm.className='btn btn--dark';confirm.type='button';confirm.textContent=t('restyle.create');
 dialog.append(heading,controls,form,status,losses,confirm,host);document.body.append(dialog);
 let player,attempt=0,preview,pending=false,typingTimer,mutationId=crypto.randomUUID();
 const cacheKey='momevia:template-trial:birthday-paper-v1';
 try{const values=JSON.parse(sessionStorage.getItem(cacheKey)||'{}');for(const [key,input]of Object.entries(bindings))input.value=values[key]||'';}catch{/* Optional cache. */}
 function dispose(){clearTimeout(typingTimer);attempt++;player?.dispose();dialog.remove();if(opener?.isConnected)opener.focus();}
 close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',dispose,{once:true});signal?.addEventListener('abort',()=>dialog.close(),{once:true});
 async function load(){
  const generation=++attempt;player?.dispose();confirm.disabled=true;status.textContent=t('catalog.detail.previewLoading');
  try{
   let loaded;
   if(sourceDesign){await save();const current=await request(`/designs/designs/${sourceDesign.id}`);const d=current.design;
    loaded=await request(`/designs/designs/${d.id}/restyle/preview`,{targetTemplateId:select.value,expectedRevision:d.revision,expectedDocumentHash:d.documentHash});
   }else loaded=await request('/designs/template-trial',{templateId:select.value});
   if(generation!==attempt||!dialog.open)return;
   preview=loaded;
   const doc=structuredClone(preview.document);if(!sourceDesign)for(const [key,input]of Object.entries(bindings))doc.bindings[key].value=input.value;
   player=mountPlayer(host,{document:doc,mode:'preview',assetUrl:id=>eventMediaUrl(id)||(sourceDesign?`/api/designs/designs/${sourceDesign.id}/assets/${encodeURIComponent(id)}`:null)});
   status.textContent=sourceDesign?t('restyle.carried',{count:preview.carried.length}):t('restyle.session');
   if(preview.missing?.length){losses.hidden=false;status.textContent+=' '+t('restyle.missing',{slots:preview.missing.join(', ')});}else losses.hidden=true;
   confirm.disabled=false;
  }catch(error){if(generation===attempt)status.textContent=error.message;}
 }
 review.addEventListener('click',()=>{mutationId=crypto.randomUUID();accept.checked=false;load();});
 select.addEventListener('change',()=>{mutationId=crypto.randomUUID();accept.checked=false;load();});
 for(const input of Object.values(bindings))input.addEventListener('input',()=>{mutationId=crypto.randomUUID();try{sessionStorage.setItem(cacheKey,JSON.stringify(Object.fromEntries(Object.entries(bindings).map(([key,i])=>[key,i.value]))));}catch{/* Optional cache. */}clearTimeout(typingTimer);confirm.disabled=true;attempt++;typingTimer=setTimeout(load,150);});
 confirm.addEventListener('click',async()=>{
  if(pending||confirm.disabled)return;pending=true;confirm.disabled=true;
  try{
   let result;
   if(sourceDesign){result=await request(`/designs/designs/${sourceDesign.id}/restyle`,{targetTemplateId:select.value,targetTemplateVersionId:preview.plan.targetVersion,expectedRevision:preview.plan.sourceRevision,expectedDocumentHash:preview.plan.sourceHash,planHash:preview.planHash,acceptMissing:accept.checked,mutationId});}
   else result=await request('/designs/designs',{source:preview.source,mutationId,trialBindings:Object.fromEntries(Object.entries(bindings).map(([key,i])=>[key,i.value]))});
   dialog.close();navigate(`/design/${result.design.id}?mode=quick`);
  }catch(error){status.textContent=error.message;confirm.disabled=false;if(error.status===401){const login=document.createElement('a');login.href='/login';login.textContent=t('shell.pages.login');status.append(' ',login);}}finally{pending=false;}
 });
 dialog.showModal();close.focus();await load();
}
