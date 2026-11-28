import {dimensionalCapSvg,capUndersideSvg} from '../../shared/canvas/dimensional-art.js';
import {objectDepth} from '../../shared/canvas/object-construction.js';
const span=css=>{const el=document.createElement('span');el.className=css;return el;};
const svg=source=>{const parsed=new DOMParser().parseFromString(source,'image/svg+xml');if(parsed.querySelector('parsererror'))throw Error('Invalid dimensional object');return document.importNode(parsed.documentElement,true);};
export function depthCap(model,body){
 const p=model.props,stage=document.createElement('div'),cap=span('gift-drive-cap gift-studio-cap'),spin=span('gift-depth-cap-spin'),front=span('gift-depth-cap-face gift-depth-cap-front'),under=span('gift-depth-cap-face gift-depth-cap-under'),art=svg(dimensionalCapSvg(p,model.id+'-front')),cord=document.createElementNS('http://www.w3.org/2000/svg','svg');cord.setAttribute('viewBox','0 0 128 128');cord.classList.add('gift-depth-tassel-free');for(const group of art.querySelectorAll('.studio-cap-tassel'))cord.append(group);stage.className='gift-studio-stage gift-depth-cap-stage';stage.style.setProperty('--object-edge',objectDepth(p)*.16+'px');front.append(art);under.append(svg(capUndersideSvg(p,model.id+'-under')));spin.append(front,under);cap.setAttribute('aria-hidden','true');cap.append(spin,cord);body.classList.add('gift-studio-reading');body.dataset.studioProse='100';body.setAttribute('aria-hidden','true');stage.append(cap,body);return stage;
}
export function depthCameraRig(camera,well){const rig=document.createElement('div');rig.className='gift-depth-camera-rig';rig.append(camera,well);return rig;}
export function waitForPrint(print,root,signal,ready){
 if(getComputedStyle(print).animationName==='none'){ready();return ()=>{};}
 const animation=print.getAnimations?.().find(a=>a.animationName==='depth-print-feed');if(!animation){ready();return ()=>{};}let active=true;const finish=()=>{if(active&&!signal?.aborted&&root.isConnected&&root.dataset.complete)ready();active=false;};void animation.finished.then(finish,finish);return ()=>{active=false;};
}
export function depthCalendar(calendar){
 const stack=span('gift-depth-calendar-stack'),rings=span('gift-depth-calendar-rings');stack.setAttribute('aria-hidden','true');rings.setAttribute('aria-hidden','true');for(let i=1;i<=3;i++){const page=span('gift-depth-calendar-leaf');page.style.setProperty('--leaf-index',String(i));stack.append(page);}rings.append(span('gift-depth-calendar-ring'),span('gift-depth-calendar-ring'));calendar.prepend(stack,rings);
 const sticker=calendar.querySelector('.gift-drive-date-sticker');if(sticker){const text=sticker.textContent;sticker.dataset.dayLabel=text;const rig=span('gift-depth-sticker-paper'),front=span('gift-depth-sticker-front'),back=span('gift-depth-sticker-back');rig.setAttribute('aria-hidden','true');front.textContent=text;rig.append(front,back);sticker.replaceChildren(rig);}
}
