import {attr,text} from '../core/i18n.js';
import {icon} from './icons.js';

export const FLOATING_CREATE_URL='/design/new';
export const FLOATING_EXPLORE_URL='/explore';
export const isEditingRoute=pathname=>/^\/(?:design|create)\/[^/]+\/?$/.test(pathname)||/^\/admin\/library\/?$/.test(pathname);

// Non-modal: it never takes focus or copies a gift/invite URL into either action.
export function mountFloatingCta(){
 const panel=document.createElement('aside');panel.className='floating-cta';panel.dataset.floatingCta='';
 panel.innerHTML=`<nav ${attr('aria-label','floatingCta.label')}>
  <a class="floating-cta__create" href="${FLOATING_CREATE_URL}" data-link data-floating-action="create" referrerpolicy="no-referrer">${icon('pencil',18)}<span>${text('floatingCta.create')}</span></a>
  <a class="floating-cta__explore" href="${FLOATING_EXPLORE_URL}" data-link data-floating-action="explore" referrerpolicy="no-referrer">${icon('layers',18)}<span>${text('floatingCta.explore')}</span></a>
 </nav>`;document.body.append(panel);
 const measure=()=>{const height=panel.getBoundingClientRect().height;if(height>0)document.body.style.setProperty('--floating-cta-height',`${Math.ceil(height)}px`);};
 const resize=new ResizeObserver(measure);resize.observe(panel);
 let pointerActivation=false;
 document.addEventListener('pointerdown',()=>{pointerActivation=true;},true);
 for(const name of ['click','pointercancel','keydown'])document.addEventListener(name,()=>{pointerActivation=false;},true);
 document.addEventListener('focusin',event=>{
  // Scrolling during pointerdown moves the control before pointerup and can
  // swallow its click. Keyboard/programmatic focus still reveals covered controls.
  const control=event.target;if(pointerActivation||panel.hidden||panel.contains(control)||!control.matches?.('input,textarea,select,button,a[href]'))return;
  const box=control.getBoundingClientRect(),dock=panel.getBoundingClientRect();
  if(box.bottom>dock.top-12&&box.top<dock.bottom&&box.right>dock.left&&box.left<dock.right)control.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
 });
 return {sync(pathname){panel.hidden=isEditingRoute(pathname);document.body.classList.toggle('has-floating-cta',!panel.hidden);if(!panel.hidden)measure();}};
}
