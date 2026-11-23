import {EVENT_MEDIA,eventMediaUrl} from '../../shared/canvas/event-media.js';
import {photoSlots} from '../../shared/canvas/interactions.js';

// Treat library artwork as immutable data. Only a local, allowlisted media URL
// can be read; saving uses the same authenticated image upload as a file input.
export async function materializeInsertionMedia(models,{fetchMedia=fetch,upload,signal,namespace='',cache=new Map()}){
 const copies=structuredClone(models),aliases=new Map(),assets=[];
 for(const model of copies)for(const slot of photoSlots(model)){
  const original=slot.assetId;if(!original)continue;const spec=Object.hasOwn(EVENT_MEDIA,original)?EVENT_MEDIA[original]:null;
  if(!spec||spec.previewOnly)throw new Error('Only reviewed distributable library media can be inserted');
  const cacheKey=namespace+':'+original;
  if(!aliases.has(original)&&cache.has(cacheKey))aliases.set(original,cache.get(cacheKey));
  if(!aliases.has(original)){
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   const response=await fetchMedia(eventMediaUrl(original),{signal});if(!response.ok)throw new Error('Artwork unavailable');
   const bytes=await response.arrayBuffer();
   const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(sha!==spec.sha256)throw new Error('Artwork integrity mismatch');
   let mutationId=crypto.randomUUID();
   if(namespace){
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(namespace+'\0'+original+'\0'+spec.sha256)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    mutationId=`${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
   }
   const asset=await upload(new Blob([bytes],{type:'image/webp'}),mutationId);
   if(asset.status!=='ready')throw new Error('Artwork upload not ready');
   aliases.set(original,asset.id);cache.set(cacheKey,asset.id);
  }
  slot.assetId=aliases.get(original);
  if(!assets.some(ref=>ref.assetId===slot.assetId))assets.push({assetId:slot.assetId,kind:'image'});
 }
 return {models:copies,assets};
}
