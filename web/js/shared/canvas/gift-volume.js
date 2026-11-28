export const VOLUME_GIFT_PRESET='lid-volume-v4';
export function giftVolumeGeometry(width){const unit=width*.58;return{unit,height:unit*.8,depth:unit*.55,lid:unit*.07,perspective:width*3,left:(width-unit)/2,top:width*.42};}
export function shadeHex(color,amount){return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*(1+amount)))).toString(16).padStart(2,'0')).join('');}
// Coordinates are shared with the SVG cover; the live component uses real faces.
export function projectGiftPoint(point,g,frame){
 const ry=-28*Math.PI/180,rx=-24*Math.PI/180,[x,y,z]=point,a=x-g.unit/2,b=y-g.height/2,xr=Math.cos(ry)*a+Math.sin(ry)*z,zr=-Math.sin(ry)*a+Math.cos(ry)*z,yr=Math.cos(rx)*b-Math.sin(rx)*zr,zz=Math.sin(rx)*b+Math.cos(rx)*zr,s=g.perspective/(g.perspective-zz);
 return{x:frame.x+frame.width/2+(g.left+g.unit/2+xr-frame.width/2)*s,y:frame.y+frame.height/2+(g.top+g.height/2+yr-frame.height/2)*s};
}
