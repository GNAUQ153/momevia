import test from'node:test';import assert from'node:assert/strict';
import{driveBlockModels,driveElementCards}from'../../web/js/shared/canvas/drive-elements.js';import{softenElement,softDuration}from'../../web/js/shared/canvas/drive-soft.js';import{applySoftAppearance}from'../../web/js/features/gift-runtime/soft-appearance.js';
import{createDocument}from'../../web/js/shared/canvas/presets.js';import{duplicateDocument,validateDocument}from'../../web/js/shared/canvas/schema.js';
test('legacy models remain classic until the soft variant is explicitly chosen',()=>{
 const classic=driveBlockModels('santa-gift-box')[0];assert.equal(classic.props.preset,'lid-card-v1');assert.equal(classic.effects,undefined);
 assert.equal(applySoftAppearance({classList:{add(){throw new Error('legacy must not be changed');}}},{}),false);
 softenElement(classic,{paper:'#FFF3DC',ink:'#183E35',accent:'#983F4E',detail:'#BB8050'});assert.equal(classic.props.preset,'lid-card-v2');assert.equal(classic.effects.reaction.id,'R02');
});
test('soft library variants keep editable corner, pace and color fields through duplication',()=>{
 assert.equal(driveBlockModels('calendar-peel',undefined,{soft:true})[0].props.appearance,'soft-v2');const model=driveElementCards().find(c=>c.id==='drive-calendar-peel').create()[0];assert.equal(model.props.appearance,'object-crafted-v4');model.props.cornerRadius=32;model.props.motionSpeed='slow';model.props.accentColor='#773447';
 const doc=createDocument();doc.schemaVersion=doc.registryVersion=2;doc.elements=[model];doc.scenes[0].elementIds=[model.id];const copy=duplicateDocument(doc);assert.equal(copy.elements[0].props.cornerRadius,32);assert.equal(copy.elements[0].props.motionSpeed,'slow');assert.equal(copy.elements[0].props.accentColor,'#773447');
 model.props.cornerRadius=49;assert.throws(()=>validateDocument(doc));assert(softDuration('fast')<softDuration('slow'));
});
test('all six new documents keep the existing scene paths and an optional video slot without large embedded bytes',()=>{
 for(const[id,count]of[['garden-tea',9],['secret-santa-invitation',9],['midnight-soiree',9],['graduation-countdown',8],['graduation-mixtape',9],['the-last-chapter-v2',10]]){
  const d=createDocument({template:{id}});assert.equal(d.scenes.length,count,id);assert.equal(d.elements.filter(e=>e.props.kind==='local-video').length,1,id);assert(d.elements.filter(e=>e.props.kind==='local-video').every(e=>e.props.videoAssetId===null&&e.props.optional));assert(Buffer.byteLength(JSON.stringify(d))<262144,id);
  assert.doesNotThrow(()=>validateDocument(duplicateDocument(d)),id);
 }
});
