import {decorateSourceGift} from './source-gift.js';
import {sourceEnvelopeData,sourceEnvelopeFrame} from '../../shared/canvas/source-envelope.js';
import {envelopeSeal} from './envelope-seal.js';
import {physicalPaper} from '../../shared/canvas/physical-paper.js';
import {decoratePhysicalEnvelope} from './physical-envelope.js';
import {paperReliefEnabled,envelopeReliefDepth} from '../../shared/canvas/paper-relief.js';
export function decorateSourceEnvelope(node,p,options){
 if(physicalPaper(p))return decoratePhysicalEnvelope(node,p,options);
 const relief=paperReliefEnabled(p);decorateSourceGift(node,p,{...options,profile:{frame:sourceEnvelopeFrame,data:sourceEnvelopeData,endFrame:40,timelineMs:40/29.9700012207031*1000,viewBox:'252 168 210 210',repeatable:true,...(relief?{depth:envelopeReliefDepth,leadRatio:.18,playbackRatio:.62,tailRatio:.2}:{})}});node.classList.add('gift-source-envelope');const originalPlay=node.playSourceGift;node.playSourceGift=args=>{node.classList.toggle('is-source-instant',args.motion?.enabled()===false);return originalPlay(args);};
 const {seal,monogram}=envelopeSeal(p,options.assetUrl);node.append(seal);
 if(relief){node.classList.add('gift-paper-relief');node.style.setProperty('--paper-depth',String((p.objectDepth??8)/8));const rig=document.createElement('span');rig.className='gift-envelope-relief-rig';rig.setAttribute('aria-hidden','true');rig.append(node.querySelector('.gift-source-art'),node.querySelector('.gift-source-card'),seal);node.append(rig);}
 const update=props=>{monogram.textContent=props.label;monogram.style.fontSize=Math.max(8,18-Math.max(0,Array.from(props.label||'').length-2)*1.2)+'px';seal.title=props.label;node.style.setProperty('--source-envelope-copy-size',Math.max(8,14-Math.max(0,Array.from(props.cardText||'').length-16)/12)+'px');};update(p);const copy=node.updateNaturalCopy;node.updateNaturalCopy=props=>{copy(props);update(props);};
}
