import{naturalOpeningParts,objectTint,naturalObjectFrame}from'./natural-objects.js';
import{EVENT_MEDIA}from'./event-media.js';
import{VOLUME_GIFT_PRESET}from'./gift-volume.js';
import{giftVolumeCover}from'./gift-volume-cover.js';
import{SOURCE_GIFT_PRESET,sourceGiftFrame}from'./source-gift.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function naturalOpeningCover(node,images,caption){
 if(node.props.preset===SOURCE_GIFT_PRESET){const p=node.props,{width:w,height:h}=node.layout,f=naturalObjectFrame(p,w,h);return `<g transform="translate(${f.x} ${f.y}) scale(${f.width/120})">${sourceGiftFrame(p,'source-'+node.id)}</g><rect x="${w*.22}" y="${h-40}" width="${w*.56}" height="36" rx="18" fill="${p.paperColor||'#FFF3DC'}" stroke="#B49B70"/><text x="${w*.5}" y="${h-17}" text-anchor="middle" fill="#27394B" font-family="sans-serif" font-size="14">${esc(caption)}</text>`;}
 if(node.props.preset===VOLUME_GIFT_PRESET)return giftVolumeCover(node,images,caption);
 const p=node.props,{width:w,height:h}=node.layout,box=p.preset.startsWith('lid-card'),assembly=naturalOpeningParts(p),source=images.get(p.assetId);if(!source)return '';
 const frame=naturalObjectFrame(p,w,h),aspect=EVENT_MEDIA[assembly.parts[0].image.mediaId].width/EVENT_MEDIA[assembly.parts[0].image.mediaId].height,tint=objectTint(p.color||(box?'#183E35':'#773447'),box?'gift':'envelope'),filter='object-'+node.id;
 const parts=assembly.parts.map((part,i)=>`<clipPath id="${filter}-clip-${i}"><path d="${esc(part.clip.d)}" clip-rule="evenodd"/></clipPath><g clip-path="url(#${filter}-clip-${i})"><image href="${esc(source.url)}" width="100" height="100" preserveAspectRatio="none" filter="url(#${filter})"/></g>`).join('');
 let result=`<svg x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${100*aspect} 100"><defs><filter id="${filter}" color-interpolation-filters="sRGB"><feColorMatrix type="${tint.type}" values="${tint.values}"/></filter></defs><g transform="scale(${aspect} 1)">${parts}</g></svg>`;
 if(!box){const seal=images.get(p.sealAssetId),sealFilter='seal-'+node.id,t=objectTint(p.sealColor||'#D7B67C','seal');if(seal)result+=`<defs><filter id="${sealFilter}" color-interpolation-filters="sRGB"><feColorMatrix type="${t.type}" values="${t.values}"/></filter></defs><image href="${esc(seal.url)}" x="${frame.x+frame.width*.39}" y="${frame.y+frame.height*.55}" width="${frame.width*.22}" height="${frame.width*.22}" filter="url(#${sealFilter})"/><text x="${w*.5}" y="${frame.y+frame.height*.55+frame.width*.13}" text-anchor="middle" fill="#FFF3DC" font-family="serif" font-size="18" font-style="italic">${esc(p.label)}</text>`;}
 return result+`<rect x="${w*.22}" y="${h-40}" width="${w*.56}" height="36" rx="18" fill="${p.paperColor||'#FFF3DC'}" stroke="#B49B70"/><text x="${w*.5}" y="${h-17}" text-anchor="middle" fill="#27394B" font-family="sans-serif" font-size="14">${esc(caption)}</text>`;
}
