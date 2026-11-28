export const isPaperTransition = preset => ['T07','T08'].includes(preset?.id)&&(!preset.definition||preset.definition.animation?.engine==='builtin');
export const sceneDirection = (scenes,from,to) => Math.sign(scenes.findIndex(s=>s.id===to)-scenes.findIndex(s=>s.id===from))||1;

// Move the reading area while the frame and shared navigation remain still.
// Each transition owns its temporary outgoing layer and restores it on abort.
export function playPaperTransition(stage,incoming,previous,preset,motion,signal,direction=1){
  if(signal?.aborted||!motion.enabled())return;
  const nextBody=incoming.querySelector('.gift-scene-body'),oldBody=previous.querySelector('.gift-scene-body');
  const fixed=Boolean(nextBody&&oldBody),target=fixed?nextBody:incoming,outgoing=fixed?oldBody:previous;
  const origin=target.style.transformOrigin,oldOrigin=outgoing.style.transformOrigin;
  const oldColor=previous.style.backgroundColor,newColor=stage.style.backgroundColor;
  stage.dataset.sceneTransition=preset.id;stage.dataset.sceneDirection=String(direction);
  let cleaned=false;
  const cleanup=()=>{
    if(cleaned)return;cleaned=true;previous.remove();
    target.style.transformOrigin=origin;outgoing.style.transformOrigin=oldOrigin;
    delete stage.dataset.sceneTransition;delete stage.dataset.sceneDirection;
    signal?.removeEventListener('abort',cleanup);
  };
  previous.classList.add('gift-transition-layer');previous.dataset.giftEffect=preset.id;
  previous.setAttribute('aria-hidden','true');previous.inert=true;
  if(fixed){
    for(const child of [...previous.children])if(child!==oldBody)child.remove();
    previous.style.backgroundColor='transparent';
  }
  target.style.transformOrigin=direction>0?'0% 50%':'100% 50%';
  outgoing.style.transformOrigin=direction>0?'100% 50%':'0% 50%';
  stage.append(previous);signal?.addEventListener('abort',cleanup,{once:true});
  const turn=preset.id==='T08',start=turn?`perspective(1400px) translateX(${direction*16}px) rotateY(${direction*-6}deg)`:`translateX(${direction*28}px)`;
  const end=turn?`perspective(1400px) translateX(${direction*-12}px) rotateY(${direction*4}deg)`:`translateX(${direction*-18}px)`;
  const resting=turn?'perspective(1400px) translateX(0px) rotateY(0deg)':'translateX(0px)';
  const ms=Math.round(({slow:450,normal:320,fast:180}[preset.speed||'normal'])*(turn?1.6:1.35));
  const options={duration:ms,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'};
  const jobs=[
    motion.run(target,[{opacity:0,transform:start},{opacity:1,transform:resting}],options,signal),
    motion.run(outgoing,[{opacity:1,transform:resting},{opacity:0,transform:end,offset:.75},{opacity:0,transform:end}],options,signal),
  ];
  if(fixed&&oldColor&&newColor&&oldColor!==newColor)jobs.push(motion.run(stage,[{backgroundColor:oldColor},{backgroundColor:newColor}],options,signal));
  return Promise.all(jobs).finally(cleanup);
}
