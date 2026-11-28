import {craftObject} from './crafted-objects.js';
import {STUDIO_APPEARANCE,STUDIO_KINDS,ENVELOPE_SOURCE_PRESET} from './studio-constants.js';
export function studioObject(model,localize){
 craftObject(model,localize);const p=model.props;
 if(model.type==='interaction'&&STUDIO_KINDS.includes(p.kind)){p.appearance=STUDIO_APPEARANCE;delete p.objectAssetId;if(p.kind==='camera-print')p.zoom??=true;}
 if(model.type==='envelope'&&p.preset?.startsWith('wax-letter')){p.preset=ENVELOPE_SOURCE_PRESET;delete p.assetId;}
 if((model.type==='envelope'&&p.preset===ENVELOPE_SOURCE_PRESET)||(model.type==='interaction'&&p.kind==='ribbon-diploma'&&p.appearance===STUDIO_APPEARANCE)){p.paperRelief??=true;p.objectDepth??=10;p.paperConstruction??='physical-v2';}
 return model;
}
export function studioDriveDocument(doc,id,localize){
 if(!['garden-tea','secret-santa-invitation','midnight-soiree','graduation-countdown','graduation-mixtape','the-last-chapter-v2'].includes(id))return doc;
 for(const model of doc.elements){studioObject(model,localize);if(model.props.kind==='cap-toss'&&model.effects?.reaction?.id==='R03')delete model.effects.reaction;}
 for(const scene of doc.scenes){
  if(scene.id==='scene-programme')for(const e of doc.elements.filter(e=>scene.elementIds.includes(e.id)&&e.id.startsWith('programme-dot-'))){e.props.color='#F3C566';e.props.strokeColor='#FFF3DA';e.props.strokeWidth=1;}
  if(scene.background.color==='#174C83')for(const e of doc.elements.filter(e=>scene.elementIds.includes(e.id)&&e.id.includes('notebook-rule-')))e.opacity=.32;
 }
 return doc;
}
