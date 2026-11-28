import test from'node:test';import assert from'node:assert/strict';
import{createDocument}from'../../web/js/shared/canvas/presets.js';import{driveBlockModels,driveElementCards}from'../../web/js/shared/canvas/drive-elements.js';
import{naturalizeObject,addObjectAssets,OBJECT_MEDIA,naturalObjectFrame}from'../../web/js/shared/canvas/natural-objects.js';
import{validateDocument,duplicateDocument,assetIds,publicDocument}from'../../web/js/shared/canvas/schema.js';import{photoSlots}from'../../web/js/shared/canvas/interactions.js';import{canonicalText}from'../../web/js/shared/locale.js';
test('natural opening reuses declared reviewed artwork while legacy presets remain unchanged',()=>{
 const classic=driveBlockModels('santa-gift-box')[0];assert.equal(classic.props.preset,'lid-card-v1');
 const doc=createDocument(),model=naturalizeObject(classic,canonicalText);doc.schemaVersion=doc.registryVersion=2;doc.elements=[model];doc.scenes[0].elementIds=[model.id];addObjectAssets(doc);assert.equal(model.props.assetId,undefined);assert.doesNotThrow(()=>validateDocument(doc));assert.deepEqual(assetIds(duplicateDocument(doc)),[]);assert.equal(model.props.preset,'lid-source-v6');
 model.props.assetId='undeclared-owned-image';assert.throws(()=>validateDocument(doc),/khai báo/);
});
test('all five reusable natural objects carry image references through save and public projection',()=>{
 for(const id of['santa-gift-box','soiree-envelope','camera-print','ribbon-diploma','cap-toss']){
  const model=driveElementCards().find(c=>c.id==='drive-'+id).create()[0],doc=createDocument();doc.schemaVersion=doc.registryVersion=2;doc.elements=[model];doc.scenes[0].elementIds=[model.id];addObjectAssets(doc);
  const refs=assetIds(doc);if(['camera-print','santa-gift-box'].includes(id))assert.equal(refs.length,0);else assert(refs.length);assert(refs.every(id=>doc.assets.some(a=>a.assetId===id)));assert.deepEqual(assetIds(publicDocument(doc)),refs);assert.doesNotThrow(()=>duplicateDocument(doc));
 }
});
test('image materialization writes both the object and wax seal back into the actual model',()=>{
 const model=naturalizeObject(driveBlockModels('soiree-envelope')[0],canonicalText),slots=photoSlots(model);assert.equal(slots.length,2);slots[0].assetId='owned-object';slots[1].assetId='owned-seal';assert.equal(model.props.assetId,'owned-object');assert.equal(model.props.sealAssetId,'owned-seal');
});
test('parts retain one physical aspect at tall, wide and compact owner sizes',()=>{
 for(const [width,height]of[[338,340],[600,230],[230,600],[150,150]])for(const preset of['lid-card-natural-v3','wax-letter-natural-v3']){
  const f=naturalObjectFrame({preset},width,height);assert(f.x>=0&&f.y>=0);assert(f.x+f.width<=width+.001);assert(f.y+f.height<=height-44+.001);assert(Math.abs(f.width/f.height-(preset.startsWith('lid')?1:700/490))<.0001);
 }
});
test('explicit legacy photo style remains a photo reveal while new insertions use the volume model',()=>{
 const model=driveBlockModels('santa-gift-box')[0];model.props.preset='lid-card-natural-v3';naturalizeObject(model,canonicalText,{previousPreset:'classic'});assert.equal(model.props.preset,'lid-card-natural-v3');assert.equal(model.props.assetId,OBJECT_MEDIA.gift);
});
