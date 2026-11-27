import {createElement} from './registry.js';
import {canonicalText} from '../locale.js';
export const LOCAL_VIDEO_KIND='local-video';
let available=false;
export const localVideoAvailable=()=>available;
export const setLocalVideoAvailable=value=>{available=value===true;};
export function localVideoModels(localize=canonicalText){return[createElement('interaction',{layout:{x:0,y:0,width:326,height:260},props:{kind:LOCAL_VIDEO_KIND,videoAssetId:null,color:'#FFF8ED',optional:true,entries:[{heading:localize('video.title'),body:localize('video.caption')}]}})];}
