import {calendarMonth}from'./drive-data.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function driveInteractionSvg(node,images,photoSvg,labelSvg,event){
 const {width,height}=node.layout;
 return '<svg width="'+width+'" height="'+height+'" viewBox="0 0 338 450" preserveAspectRatio="xMidYMid meet">'+driveContentSvg({...node,layout:{width:338,height:450}},images,photoSvg,labelSvg,event)+'</svg>';
}
function driveContentSvg(node,images,photoSvg,labelSvg,event){
 const p=node.props,{width:w,height:h}=node.layout;
 const background=`<rect width="${w}" height="${h}" rx="${['soft-v2','object-crafted-v4'].includes(p.appearance)?(p.cornerRadius??24):8}" fill="${p.color}"/>`;
 if(p.kind==='calendar-peel'){
  const month=calendarMonth(p.clockSource==='invitation'?event?.eventAt:p.eventAt,p.clockSource==='invitation'?event?.timeZone:p.timeZone);
  if(!month)return background+labelSvg(p.entries[0].heading,16,45,w-32,24);
  const size=(w-28)/7,top=97;let cells='';
  for(let day=1;day<=month.days;day++){const cell=month.offset+day-1,x=14+cell%7*size,y=top+Math.floor(cell/7)*size;if(day===month.day)cells+=`<rect x="${x}" y="${y-24}" width="${size-2}" height="${size-2}" rx="5" fill="#EAC572" transform="rotate(-6 ${x+size/2} ${y})"/>`;cells+=`<text x="${x+size/2}" y="${y}" text-anchor="middle" fill="#27394B" font-size="18">${day}</text>`;}
  return background+labelSvg(month.title,18,40,w-36,23,'#7D3854')+cells;
 }
 if(p.kind==='camera-print')return background+`<rect x="20" y="30" width="${w-40}" height="120" rx="20" fill="#272936" stroke="#A8B9C9" stroke-width="8"/><circle cx="${w/2}" cy="86" r="37" fill="#141B32" stroke="#A8B9C9" stroke-width="9"/><rect x="${w/2-89}" y="133" width="178" height="211" fill="#FFF8E8"/><g transform="translate(${w/2-80} 143)">${photoSvg({...p.photos[0],optional:true},images.get(p.photos[0].assetId),160,159,node.id+'-camera')}</g>`+labelSvg(p.entries[0].heading,18,h-30,w-36,18);
 if(p.kind==='focus-photo')return background+`<circle cx="${w/2}" cy="${h/2-20}" r="111" fill="#29445D"/><clipPath id="drive-lens-${node.id}"><circle cx="${w/2}" cy="${h/2-20}" r="95"/></clipPath><g clip-path="url(#drive-lens-${node.id})" transform="translate(${w/2-95} ${h/2-115})">${photoSvg({...p.photos[0],optional:true},images.get(p.photos[0].assetId),190,190,node.id+'-focus')}</g>`+labelSvg(p.entries[0].heading,16,h-25,w-32,20);
 if(p.kind==='four-choice-quiz')return background+labelSvg(p.question||p.entries[0].heading,18,40,w-36,22)+p.entries.map((entry,i)=>`<rect x="16" y="${95+i*75}" width="${w-32}" height="60" rx="5" fill="#FFF9EC"/>`+labelSvg(`${String.fromCharCode(65+i)}. ${entry.heading}`,28,125+i*75,w-56,17)).join('');
 return background+labelSvg(p.entries[0].heading,18,42,w-36,24)+labelSvg(p.entries[0].body,18,110,w-36,18);
}
export function driveOpeningSvg(p,w,h){
 const box=p.preset.startsWith('lid-card'),body=p.color,seal=p.sealColor||'#D7B67C';
 return `<rect x="${w*.08}" y="${h*.4}" width="${w*.84}" height="${h*.47}" rx="4" fill="${body}" stroke="#BB8050"/>`+(box?`<rect x="${w*.05}" y="${h*.32}" width="${w*.9}" height="${h*.12}" fill="${body}" stroke="#BB8050"/><path d="M${w*.5} ${h*.34}C${w*.14} ${h*.1} ${w*.3} ${h*.1} ${w*.5} ${h*.33}C${w*.7} ${h*.1} ${w*.88} ${h*.1} ${w*.5} ${h*.34}V${h*.87}" fill="none" stroke="#BB8050" stroke-width="12"/>`:`<path d="M${w*.08} ${h*.4}L${w*.5} ${h*.68}L${w*.92} ${h*.4}" fill="none" stroke="${seal}"/><circle cx="${w*.5}" cy="${h*.64}" r="${w*.085}" fill="${seal}"/><text x="${w*.5}" y="${h*.66}" text-anchor="middle" fill="#141B32" font-family="serif" font-size="18">${escape(p.label)}</text>`);
}
