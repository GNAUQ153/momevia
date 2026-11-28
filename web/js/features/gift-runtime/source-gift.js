import {sourceGiftData,sourceGiftFrame,sourceGiftDepth} from '../../shared/canvas/source-gift.js';
import {t} from '../../core/i18n.js';
let engine,sequence=0;
const svg=markup=>document.importNode(new DOMParser().parseFromString(markup,'image/svg+xml').documentElement,true);
export function decorateSourceGift(node,p,{signal,mode}){
 const id='source-gift-'+(++sequence),art=document.createElement('span'),label=document.createElement('span'),card=document.createElement('span');
 art.className='gift-source-art';art.setAttribute('aria-hidden','true');art.append(svg(sourceGiftFrame(p,id)));
 label.className='gift-drive-opening-label';label.textContent=t('drive.openNow');label.setAttribute('aria-hidden','true');
 card.className='gift-source-card';card.textContent=p.cardText||t('natural.cardText');card.setAttribute('aria-hidden','true');
 node.classList.add('gift-drive-opening','gift-object-opening','gift-object-source');node.style.setProperty('--drive-paper-color',p.paperColor||'#FFF3DC');node.style.setProperty('--source-card-radius',Math.min(12,(p.cornerRadius??22)*.4)+'px');node.replaceChildren(art,card,label);
 let player,loading,disposed=false,finish,reducedOpened=false;
 const load=()=>loading??=(async()=>{
  engine??=import('../../vendor/lottie-light.mjs');const {default:lottie}=await engine;if(disposed||signal?.aborted)return;
  const live=document.createElement('span');live.className='gift-source-live';art.append(live);
  player=lottie.loadAnimation({container:live,renderer:'svg',loop:false,autoplay:false,animationData:sourceGiftData(p),rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false}});
  await new Promise(resolve=>{const done=()=>{player?.removeEventListener('DOMLoaded',done);resolve();};player.addEventListener('DOMLoaded',done);signal?.addEventListener('abort',resolve,{once:true});});
  if(disposed||signal?.aborted)return;if(reducedOpened){player.destroy();player=undefined;return;}const root=live.querySelector('svg'),depth=sourceGiftDepth(p,id+'-live');if(depth){root.prepend(svg('<svg xmlns="http://www.w3.org/2000/svg">'+depth+'</svg>').firstChild);for(const group of root.querySelectorAll(':scope > g'))group.setAttribute('filter','url(#'+id+'-live-depth)');}art.querySelector(':scope > svg')?.remove();live.classList.add('is-ready');player.goToAndStop(0,true);
 })();
 node.playSourceGift=async({duration,motion,signal:intent})=>{
  const combined=signal?AbortSignal.any([signal,intent].filter(Boolean)):intent;
  if(combined?.aborted||disposed)return;
  if(motion?.enabled()===false||matchMedia('(prefers-reduced-motion: reduce)').matches){reducedOpened=true;player?.pause();art.replaceChildren(svg(sourceGiftFrame(p,id,true)));node.classList.add('is-opening','is-source-revealing');return;}
  try{await load();}catch{art.replaceChildren(svg(sourceGiftFrame(p,id,true)));node.classList.add('is-opening','is-source-revealing');return;}
  if(combined?.aborted||disposed||!player)return;
  if(motion?.enabled()===false||matchMedia('(prefers-reduced-motion: reduce)').matches){player.goToAndStop(49,true);node.classList.add('is-opening','is-source-revealing');return;}
  node.style.setProperty('--drive-duration',duration+'ms');node.classList.add('is-opening');
  await new Promise(resolve=>{
   let tail,fallback,releaseMotion,revealed=false;const stop=()=>{clearTimeout(tail);clearTimeout(fallback);releaseMotion?.();combined?.removeEventListener('abort',stop);player?.removeEventListener('complete',reveal);player?.pause();finish=undefined;resolve();};
   const reveal=()=>{if(combined?.aborted)return stop();if(revealed)return;revealed=true;clearTimeout(fallback);node.classList.add('is-source-revealing');tail=setTimeout(stop,duration*.34);};
   finish=stop;releaseMotion=motion?.track(()=>{if(!combined?.aborted){player?.goToAndStop(49,true);node.classList.add('is-source-revealing');}stop();});combined?.addEventListener('abort',stop,{once:true});player.addEventListener('complete',reveal);player.setSpeed(2000/(duration*.66));player.playSegments([0,49],true);fallback=setTimeout(reveal,duration*.8);
  });
 };
 node.updateNaturalCopy=props=>{card.textContent=props.cardText||t('natural.cardText');label.textContent=t('drive.openNow');};
 const dispose=()=>{disposed=true;finish?.();player?.destroy();player=undefined;};signal?.addEventListener('abort',dispose,{once:true});
 if(['preview','public'].includes(mode)){
  let start;node.style.touchAction='none';node.addEventListener('pointerdown',e=>{start={id:e.pointerId,x:e.clientX,y:e.clientY};void load().catch(()=>{});},{signal});
  node.addEventListener('pointerup',e=>{if(start?.id===e.pointerId&&(start.y-e.clientY>45||Math.abs(start.x-e.clientX)>60)){e.preventDefault();node.click();}start=null;},{signal});
  for(const event of ['pointercancel','lostpointercapture'])node.addEventListener(event,()=>{start=null;},{signal});
 }
}
