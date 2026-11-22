import {message} from './i18n.js';
let pending;
export function ensureFullStyles(){
 const initial=document.getElementById('app-fonts'),full=initial?.dataset.fullCss;
 if(!full||initial.getAttribute('href')===full||document.querySelector('[data-full-styles-ready]'))return Promise.resolve();
 return pending??=new Promise((resolve,reject)=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href=full;
  link.addEventListener('load',()=>{link.dataset.fullStylesReady='';resolve();},{once:true});
  link.addEventListener('error',()=>{link.remove();pending=null;reject(Object.assign(new Error('Unable to load page styles'),{translation:message('system.error.request')}));},{once:true});document.head.append(link);
 });
}
