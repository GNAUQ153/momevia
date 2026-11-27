import {t} from '../../core/i18n.js';
export function renderLocalVideo(model,{mode,signal,url}){
 const root=document.createElement('section');root.className='gift-local-video';root.style.backgroundColor=model.props.color;
 const title=document.createElement('h3');title.textContent=model.props.entries[0].heading;root.append(title);
 if(['preview','public'].includes(mode)&&url){
  const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',model.props.entries[0].heading);video.src=url;
  const status=document.createElement('p');status.setAttribute('role','status');status.hidden=true;video.addEventListener('error',()=>{status.hidden=false;status.textContent=t('video.playError');},{signal});
  signal?.addEventListener('abort',()=>{video.pause();video.removeAttribute('src');video.load();},{once:true});root.append(video,status);
 }else{const placeholder=document.createElement('p');placeholder.className='gift-local-video-placeholder';placeholder.textContent=t(model.props.videoAssetId?'video.ready':'video.choose');root.append(placeholder);}
 const caption=document.createElement('p');caption.textContent=model.props.entries[0].body;caption.hidden=!model.props.entries[0].body;root.append(caption);return root;
}
