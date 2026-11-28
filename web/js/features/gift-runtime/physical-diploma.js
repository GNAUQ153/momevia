import {paperCoilSvg,cylinderPaint,physicalDepth} from '../../shared/canvas/physical-paper.js';
import {studioRibbonSvg} from '../../shared/canvas/studio-art.js';
const span=css=>{const node=document.createElement('span');node.className=css;return node;};
const svg=source=>document.importNode(new DOMParser().parseFromString(source,'image/svg+xml').documentElement,true);
function cylinder(p,id,small=false){
 const root=span('gift-physical-paper-roll'+(small?' gift-physical-paper-roll-top':' gift-physical-paper-roll-bottom')),turn=span('gift-physical-paper-turn');
 for(let i=0;i<16;i++){const face=span('gift-physical-paper-facet');face.style.transform=`rotateX(${i*22.5}deg) translateZ(var(--physical-roll-radius))`;face.style.backgroundColor=cylinderPaint(p,i);turn.append(face);}
 for(const side of ['left','right']){const end=span('gift-physical-paper-end gift-physical-paper-end-'+side);end.append(svg(paperCoilSvg(p,id+'-'+side)));turn.append(end);}root.append(turn);root.setAttribute('aria-hidden','true');return root;
}
export function physicalDiploma(model,body){
 const p=model.props,stage=span('gift-studio-stage gift-paper-physical gift-physical-diploma'),assembly=span('gift-physical-scroll'),sheet=span('gift-physical-diploma-sheet'),ribbon=span('gift-studio-ribbon'),band=span('gift-studio-ribbon-band');stage.dataset.physicalDepth=String(physicalDepth(p));stage.style.setProperty('--physical-shade-opacity',String(physicalDepth(p)/16));stage.style.setProperty('--physical-paper',p.color||'#FFF8E8');stage.style.setProperty('--physical-accent',p.accentColor||'#B52E3D');
 body.classList.add('gift-studio-reading');body.dataset.studioProse='48';body.setAttribute('aria-hidden','true');sheet.append(body);ribbon.setAttribute('aria-hidden','true');band.setAttribute('aria-hidden','true');ribbon.append(svg(studioRibbonSvg(p,model.id+'-physical-bow')));assembly.append(sheet,cylinder(p,model.id+'-top',true),cylinder(p,model.id+'-bottom'),band,ribbon);stage.append(assembly);return stage;
}
