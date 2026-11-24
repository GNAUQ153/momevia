import {createDocument} from '../../shared/canvas/presets.js';
import {pinDocumentArtwork} from '../../shared/canvas/library-materialize.js';
import {photoSlots} from '../../shared/canvas/interactions.js';
export function motionLibraryPreview(block){
 const doc=createDocument({presetId:'blank'}),models=block.create();
 doc.elements=models;doc.scenes[0].elementIds=models.map(e=>e.id);
 for(const e of models){e.layout.x=(390-e.layout.width)/2;e.layout.y=100;for(const p of photoSlots(e))if(p.assetId&&!doc.assets.some(a=>a.assetId===p.assetId))doc.assets.push({assetId:p.assetId,kind:'image'});}
 return pinDocumentArtwork(doc);
}
