import { effectSpeed, CELEBRATION_IDS, defaultCelebrations, builtinPreset } from '../../shared/canvas/effects.js';
import { playParticleRecipe, playRecipe } from './recipe-runtime.js';
// Bounded bursts. Motion owns every animation and cancels them when
// the scene closes or reduced motion is enabled; no per-frame JS or layout loop.
const ns='http://www.w3.org/2000/svg';
function decoration(css) { const n=document.createElement('span');n.className=css;n.setAttribute('aria-hidden','true');return n; }
function wingArt(flower=false) {
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 60 44');
  const parts=flower ? [
    ['M30 24C4 23 7 1 23 8L30 20C31-3 51 1 45 16L34 25C58 14 65 35 45 36L33 29C35 52 14 48 20 33Z','#F4C9C4'],
    ['M30 17a7 7 0 1 0 0 14a7 7 0 1 0 0-14','#FFC857'],
  ] : [
    ['M29 24C0 1 2 34 25 32C4 52 31 41 30 26Z','#E998AD'],
    ['M31 24C60 1 58 34 35 32C56 52 29 41 30 26Z','#F6CE76'],
    ['M30 19L30 35M30 21L25 15M30 21L35 15','#6D3C51'],
  ];
  parts.forEach(([d,fill],i)=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill',i===2&&!flower?'none':fill);p.setAttribute('stroke',fill);p.setAttribute('stroke-width','1.5');if(!flower&&i<2)p.classList.add('gift-butterfly-wing');svg.append(p);});
  return svg;
}

export function celebrate(stage,preset,motion,signal) {
  preset = builtinPreset(preset);
  const custom = playParticleRecipe(stage, { ...preset, loop: false }, motion, signal) || playRecipe(stage, preset, motion, signal);
  if (custom) return custom;
  const layer=decoration('gift-ambience gift-celebration');stage.append(layer);
  const tasks=[],type=preset.id,count=preset.density==='sparse'?6:preset.density==='dense'?14:10;
  layer.dataset.giftEffect=type;
  const ms={fast:2300,normal:3000,slow:3800}[preset.speed||'normal'];
  const beat=effectSpeed[preset.speed||'normal'];
  const colors=['#FFD056','#F56C60','#79CEEF','#F4C9C4'];
  if(type==='B07') {
    for(let burst=0;burst<3;burst++)for(let i=0;i<count+2;i++) {
      const spark=decoration('gift-firework-spark');spark.style.left=`${[12,87,78][burst]}%`;spark.style.top=`${[24,48,10][burst]}%`;spark.style.backgroundColor=colors[(i+burst)%4];layer.append(spark);
      const angle=i/(count+2)*Math.PI*2,range=38+burst*13;
      tasks.push(motion.run(spark,[{transform:'translate(0,0) scale(.5)',opacity:0},{opacity:1,offset:.14},{transform:`translate(${Math.cos(angle)*range}px,${Math.sin(angle)*range+16}px) scale(.75)`,opacity:0}],{duration:beat*3,delay:burst*beat,fill:'backwards'},signal));
    }
  } else for(let i=0;i<count;i++) {
    const n=decoration(type==='B05'?'gift-bubble':type==='B06'?'gift-butterfly':'gift-bloom');
    n.style.left=`${i%2?83+(i%3)*4:3+(i%3)*3}%`;n.style.top=`${type==='B05'?70+(preset.density==='dense'?i%6:i)*4:12+(i*31)%70}%`;
    if(type!=='B05')n.append(wingArt(type==='B08'));
    const size=type==='B05'?18+i%3*7:type==='B06'?32+i%2*10:36+i%3*9;
    n.style.width=n.style.height=`${size}px`;layer.append(n);
    if(type==='B06')for(const wing of n.querySelectorAll('.gift-butterfly-wing'))
      tasks.push(motion.run(wing,[{transform:'scaleX(.5)'},{transform:'scaleX(1)'},{transform:'scaleX(.5)'}],{duration:effectSpeed.fast,iterations:Math.ceil(ms/effectSpeed.fast)},signal));
    const end=type==='B05'?`translate(${i%2?-22:22}px,-240px) scale(1.13)`:
      type==='B06'?`translate(${i%2?-52:52}px,-95px) rotate(${i%2?-12:12}deg)`:'translate(0,-10px) rotate(28deg) scale(1.28)';
    tasks.push(motion.run(n,[{transform:type==='B08'?'scale(.6) rotate(-20deg)':'translate(0,0) scale(.95)',opacity:0},{opacity:.85,offset:.22},{transform:end,opacity:0}],{duration:ms,delay:i*95,fill:'backwards'},signal));
  }
  return Promise.all(tasks).finally(()=>layer.remove());
}

export function playCelebrations(stage,settings,motion,signal) {
  const stops=[],defaults=defaultCelebrations();
  for (const id of CELEBRATION_IDS) {
    const preset={...defaults[id],...settings?.[id]};
    if (!preset?.enabled || !motion.enabled() || signal?.aborted) continue;
    let stopped=false,cycle=null,timer,untrack=()=>{};
    const stop=()=>{
      if (stopped) return;
      stopped=true;clearTimeout(timer);cycle?.abort();
      document.removeEventListener('visibilitychange',visible);
      signal?.removeEventListener('abort',stop);untrack();
    };
    const start=()=>{
      clearTimeout(timer);
      if (stopped || cycle || signal?.aborted || !motion.enabled()) return;
      if (!stage.isConnected) return stop();
      if (document.hidden) return;
      const active=cycle=new AbortController();
      void celebrate(stage,{id,...preset},motion,active.signal).finally(()=>{
        if (cycle===active) cycle=null;
        if (stopped) return;
        if (preset.loop===false) return stop();
        if (!document.hidden) timer=setTimeout(start,effectSpeed[preset.speed||'normal']);
      });
    };
    const visible=()=>{clearTimeout(timer);if(document.hidden)cycle?.abort();else start();};
    document.addEventListener('visibilitychange',visible);
    signal?.addEventListener('abort',stop,{once:true});untrack=motion.track(stop);
    queueMicrotask(start);stops.push(stop);
  }
  return ()=>stops.forEach(stop=>stop());
}

export async function photoFragments(node,preset,motion,signal) {
  const img=node.querySelector('img');if(!img)return;
  const opacity=img.style.opacity;img.style.opacity='0';let overlay;
  try {
    await img.decode().catch(()=>{});
    if(signal?.aborted||!img.isConnected||!motion.enabled())return;
    const width=img.clientWidth,height=img.clientHeight;if(!width||!height)return;
    overlay=decoration('gift-photo-fragments');node.append(overlay);
    const tasks=[],dissolve=preset.id==='E06';
    for(let r=0;r<3;r++)for(let c=0;c<4;c++) {
      const tile=decoration('gift-photo-fragment'),picture=img.cloneNode();
      Object.assign(tile.style,{left:`${c*25}%`,top:`${r*100/3}%`,width:'25.1%',height:'33.5%'});
      Object.assign(picture.style,{position:'absolute',width:`${width}px`,height:`${height}px`,maxWidth:'none',left:`${-c*width/4}px`,top:`${-r*height/3}px`,opacity:'1'});
      tile.append(picture);overlay.append(tile);
      const i=r*4+c,dx=(c-1.5)*(dissolve?12:30),dy=(r-1)*(dissolve?12:38);
      const rank=dissolve?[7,0,10,4,2,9,5,11,3,8,1,6][i]:i;
      tasks.push(motion.run(tile,[{transform:`translate(${dx}px,${dy}px) rotate(${dissolve?0:(i%2?14:-14)}deg) scale(.95)`,opacity:0},{transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1}],{duration:effectSpeed[preset.speed||'normal']*(dissolve?1:2),delay:(preset.delay||0)+rank*30,fill:'both'},signal));
    }
    await Promise.all(tasks);
  }finally{img.style.opacity=opacity;overlay?.remove();}
}
