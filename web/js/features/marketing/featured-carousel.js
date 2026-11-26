import {isInSeason,vietnamDay} from '../catalog/seasonal.js';
import {prioritizeTemplates} from '../../shared/template-order.js';
import {loadCoverImage} from '../../core/cover-loading.js';
import {marketingConnection,marketingShouldShowStatic} from './motion-preferences.js';

export function selectFeaturedTemplates(templates,day=vietnamDay()) {
  const seen=new Set();
  return prioritizeTemplates(templates.slice().sort((a,b)=>Number(isInSeason(b,day))-Number(isInSeason(a,day))||Number(Boolean(b.featured))-Number(Boolean(a.featured))))
    .filter(template=>{if(seen.has(template.id))return false;seen.add(template.id);return true;}).slice(0,15);
}

export function mountFeaturedCarousel(host) {
  const root=host.querySelector('[data-featured-carousel]');
  if(!root)return {dispose(){}};
  const viewport=root.querySelector('[data-featured-viewport]'),track=root.querySelector('[data-featured-track]');
  const lifetime=new AbortController(),options={signal:lifetime.signal};
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),reducedData=matchMedia('(prefers-reduced-data: reduce)');
  const connection=marketingConnection(globalThis.navigator);
  let timer=null,animation=null,busy=false,visible=false,pressed=false,disposed=false,generation=0,start=0,count=3,width=0;
  const cards=()=>[...track.children];
  const focused=()=>Boolean(root.querySelector(':focus-visible'));
  function allowed(){
    return !disposed&&visible&&!document.hidden&&!pressed&&!focused()&&!root.closest('[data-home-construction-running]')&&cards().length>count&&
      !document.querySelector('dialog[open]')&&!document.getElementById('modal-root')?.hasChildNodes()&&
      !marketingShouldShowStatic({reducedMotion:reduce.matches,reducedData:reducedData.matches,saveData:connection?.saveData});
  }
  function setWindow(){
    const all=cards();
    all.forEach((card,i)=>{card.inert=i>=count;card.setAttribute('aria-hidden',String(i>=count));});
    root.dataset.featuredStart=String(start);
    root.dataset.featuredVisible=String(count);
    root.dataset.featuredWindow=all.slice(0,count).map(card=>card.dataset.templateId).join(',');
  }
  async function preload(card){
    // Không tải trước ảnh ngoài cửa sổ khi carousel đã dừng.
    if(!card||!allowed())return;
    await Promise.all([...card.querySelectorAll('img')].map(async img=>{
      if(img.hasAttribute('data-cover-lazy'))loadCoverImage(img);
      img.loading='eager';
      img.fetchPriority='low';
      try{await img.decode();}catch{/* Keep the named card and its fallback when a cover fails. */}
    }));
  }
  function cancelMove(){
    ++generation;animation?.cancel();animation=null;busy=false;root.dataset.featuredPhase='idle';
  }
  function sync(){
    if(disposed)return;
    const running=allowed();root.dataset.featuredRunning=String(running);
    if(!running){if(timer!==null)clearInterval(timer);timer=null;animation?.pause();return;}
    if(animation?.playState==='paused')animation.play();
    if(timer===null)timer=setInterval(()=>{void advance();},5000);
  }
  async function advance(){
    if(busy||!allowed())return;
    busy=true;const request=++generation;
    try{
      await preload(cards()[count]);
      if(request!==generation||!allowed())return;
      const all=cards(),step=all[1].offsetLeft-all[0].offsetLeft;
      root.dataset.featuredPhase='sliding';
      const motion=animation=track.animate([{transform:'translateX(0)'},{transform:`translateX(-${step}px)`}],{duration:650,easing:'cubic-bezier(.22,.68,.2,1)',fill:'forwards'});
      await motion.finished;
      if(request!==generation||disposed)return;
      track.append(track.firstElementChild);
      start=(start+1)%all.length;
      animation=null;motion.cancel();setWindow();
      void preload(cards()[count]);
    }catch{/* A resize, focus change or route disposal cancels the in-flight slide. */}
    finally{if(request===generation){busy=false;root.dataset.featuredPhase='idle';sync();}}
  }
  function measure(){
    if(disposed)return;
    const next=Math.min(Number(getComputedStyle(root).getPropertyValue('--featured-columns'))||3,cards().length);
    if(width===viewport.clientWidth&&count===next)return;
    cancelMove();width=viewport.clientWidth;count=next;setWindow();sync();
  }
  root.addEventListener('focusin',()=>{if(focused())cancelMove();sync();},options);
  root.addEventListener('focusout',()=>queueMicrotask(sync),options);
  root.addEventListener('pointerdown',()=>{pressed=true;sync();},options);
  for(const name of ['pointerup','pointercancel'])document.addEventListener(name,()=>{pressed=false;sync();},options);
  document.addEventListener('visibilitychange',sync,options);
  for(const preference of [reduce,reducedData])preference.addEventListener('change',()=>{cancelMove();setWindow();sync();},options);
  connection?.addEventListener?.('change',()=>{cancelMove();setWindow();sync();},options);
  const resize=new ResizeObserver(measure);resize.observe(viewport);
  const intersection=new IntersectionObserver(entries=>{
    // Observer có thể đã xếp callback trước lúc component bị hủy.
    if(disposed||!entries.length)return;
    visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.15;
    if(allowed())void preload(cards()[count]);
    sync();
  },{threshold:[0,.15]});intersection.observe(viewport);
  const dialogs=new MutationObserver(sync);
  const main=root.closest('main');if(main)dialogs.observe(main,{subtree:true,attributes:true,attributeFilter:['open']});
  main?.addEventListener('home-construction:complete',sync,options);
  const modal=document.getElementById('modal-root');if(modal)dialogs.observe(modal,{subtree:true,childList:true});
  measure();setWindow();
  return {dispose(){if(disposed)return;disposed=true;lifetime.abort();if(timer!==null)clearInterval(timer);timer=null;cancelMove();root.dataset.featuredRunning='false';resize.disconnect();intersection.disconnect();dialogs.disconnect();}};
}
