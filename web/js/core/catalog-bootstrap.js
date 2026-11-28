// Only anonymous, public Catalog GETs may be shared with the app. No identity,
// draft, gift, reply, entitlement or purchase response belongs in this cache.
import { BUILTIN_COVER_REVISION, COVER_WIDTHS, CATALOG_COVER_SIZES } from '../shared/cover-images.js';
import { prioritizeTemplates } from '../shared/template-order.js';
const covers=new Map();
export const catalogCoverRevision=id=>covers.get(id);
export function rememberCatalogMetadata(data){
 if(Array.isArray(data?.templates)){covers.clear();for(const row of data.templates)if(row.coverRevision)covers.set(row.id,row.coverRevision);}
 else if(data?.template){if(data.template.coverRevision)covers.set(data.template.id,data.template.coverRevision);else covers.delete(data.template.id);}
 return data;
}
export function takeCatalogBootstrap(endpoint){
 const tag=document.getElementById('public-catalog-bootstrap');if(!tag)return;
 try{const value=JSON.parse(tag.textContent);if(value.endpoint!==endpoint)return;tag.remove();return Promise.resolve(rememberCatalogMetadata(value.data));}catch{tag.remove();}
}
export function startCatalogBootstrap(){
 const match=location.pathname.match(/^\/template\/([^/]+)\/?$/),catalog=/^\/explore\/?$/.test(location.pathname);
 if(!catalog&&!match)return;
 // Chỉ bỏ preload dự đoán; ảnh hiển thị vẫn được tải theo luồng bình thường.
 const connection=globalThis.navigator?.connection||globalThis.navigator?.mozConnection||globalThis.navigator?.webkitConnection;
 if(connection?.saveData||globalThis.matchMedia?.('(prefers-reduced-data: reduce)')?.matches)return;
 let locale='vi';try{if(localStorage.getItem('momevia-locale')==='en')locale='en';}catch{/* Storage may be blocked. */}
 const endpoint=match?`/catalog/templates/${match[1]}`:'/catalog/templates';
 try{
  const tag=document.getElementById('public-catalog-bootstrap');if(!tag)return;const value=JSON.parse(tag.textContent);if(value.endpoint!==endpoint)return;const data=value.data;
  const templates=match?[data.template]:location.search?[]:prioritizeTemplates(data.templates).slice(0,2);
  for(const template of templates){
   if(!template?.systemOwned&&!template?.thumbnail)continue;
   const id=encodeURIComponent(template.id);
   const coverSrc=template.systemOwned
    ? (template.coverRevision
      ? `/api/designs/library/templates/${id}/cover?locale=${locale}&v=${encodeURIComponent(template.coverRevision)}${match?'':'&variant=catalog'}`
      : `/assets/basic-templates/${locale==='en'?'en/':''}${id}${match?'':'-catalog'}.svg?v=${BUILTIN_COVER_REVISION}`)
    : template.thumbnail;
   const link=document.createElement('link');link.rel='preload';link.as='image';
   if(template.systemOwned&&!match){
    const thumbnail=template.coverRevision?coverSrc:`/api/designs/library/templates/${id}/thumbnail?locale=${locale}&v=${BUILTIN_COVER_REVISION}&variant=catalog`;
    link.imageSrcset=COVER_WIDTHS.map(width=>`${thumbnail}&width=${width} ${width}w`).join(', ');
    link.imageSizes=CATALOG_COVER_SIZES;link.href=thumbnail+'&width=320';
   }else link.href=coverSrc;
   link.fetchPriority='high';document.head.append(link);
  }
 }catch{/* Missing data retains the app's normal API path. */}
}
