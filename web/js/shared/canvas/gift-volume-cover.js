import{giftVolumeGeometry,projectGiftPoint,shadeHex}from'./gift-volume.js';
import{naturalObjectFrame,objectTint}from'./natural-objects.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function giftVolumeCover(node,images,caption){
 const p=node.props,{width:w,height:h}=node.layout,f=naturalObjectFrame(p,w,h),g=giftVolumeGeometry(f.width),s=g.unit,d=g.depth/2,t=g.lid,color=p.color||'#183E35',ribbon=p.sealColor||'#C69A60',project=a=>projectGiftPoint(a,g,f),pts=a=>a.map(v=>{const q=project(v);return q.x.toFixed(3)+','+q.y.toFixed(3);}).join(' '),poly=(a,fill)=>`<polygon points="${pts(a)}" fill="${fill}" stroke="#00000025" stroke-width=".7"/>`;
 let out=poly([[0,0,d],[s,0,d],[s,g.height,d],[0,g.height,d]],color)+poly([[s,0,d],[s,0,-d],[s,g.height,-d],[s,g.height,d]],shadeHex(color,-.18));
 out+=poly([[s*.44,0,d+.2],[s*.56,0,d+.2],[s*.56,g.height,d+.2],[s*.44,g.height,d+.2]],ribbon)+poly([[s+.2,0,d*.12],[s+.2,0,-d*.12],[s+.2,g.height,-d*.12],[s+.2,g.height,d*.12]],shadeHex(ribbon,-.12));
 out+=poly([[-4,-t,d+4],[s+4,-t,d+4],[s+4,0,d+4],[-4,0,d+4]],color)+poly([[s+4,-t,d+4],[s+4,-t,-d-4],[s+4,0,-d-4],[s+4,0,d+4]],shadeHex(color,-.15));
 out+=poly([[-4,-t,d+4],[s+4,-t,d+4],[s+4,-t,-d-4],[-4,-t,-d-4]],shadeHex(color,.15));
 out+=poly([[s*.44,-t-.2,d+4],[s*.56,-t-.2,d+4],[s*.56,-t-.2,-d-4],[s*.44,-t-.2,-d-4]],ribbon)+poly([[-4,-t-.3,d*.14],[s+4,-t-.3,d*.14],[s+4,-t-.3,-d*.14],[-4,-t-.3,-d*.14]],ribbon);
 const bow=images.get(p.assetId);if(bow){const a=project([s*.05,-t-3,d*.85]),b=project([s*.95,-t-3,d*.85]),c=project([s*.05,-t-3,-d*.85]),filter='volume-bow-'+node.id,tint=objectTint(ribbon,'seal');out+=`<defs><filter id="${filter}" color-interpolation-filters="sRGB"><feColorMatrix type="${tint.type}" values="${tint.values}"/></filter></defs><image href="${esc(bow.url)}" width="100" height="100" preserveAspectRatio="none" filter="url(#${filter})" transform="matrix(${(b.x-a.x)/100} ${(b.y-a.y)/100} ${(c.x-a.x)/100} ${(c.y-a.y)/100} ${a.x} ${a.y})"/>`;}
 return out+`<rect x="${w*.22}" y="${h-40}" width="${w*.56}" height="36" rx="18" fill="${p.paperColor||'#FFF3DC'}" stroke="#B49B70"/><text x="${w*.5}" y="${h-17}" text-anchor="middle" fill="#27394B" font-family="sans-serif" font-size="14">${esc(caption)}</text>`;
}
