import test from 'node:test';
import assert from 'node:assert/strict';
import {craftObject,CRAFT_APPEARANCE} from '../../web/js/shared/canvas/crafted-objects.js';
import {sourceGiftData,sourceGiftFrame} from '../../web/js/shared/canvas/source-gift.js';
import {driveBlockModels,driveElementCards} from '../../web/js/shared/canvas/drive-elements.js';
import {naturalizeObject,addObjectAssets} from '../../web/js/shared/canvas/natural-objects.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {validateDocument,duplicateDocument,assetIds} from '../../web/js/shared/canvas/schema.js';
import {canonicalText} from '../../web/js/shared/locale.js';

test('crafted blocks round-trip the full declared artwork graph without changing primitive defaults',()=>{
 for(const id of ['calendar-peel','camera-print','focus-photo','grade-stamp','ribbon-diploma','four-choice-quiz','peel-letter','tear-ticket','cap-toss']){
  const legacy=driveBlockModels(id)[0];assert.equal(legacy.props.appearance,undefined);
  const model=craftObject(legacy,canonicalText),doc=createDocument();doc.schemaVersion=doc.registryVersion=2;doc.elements=[model];doc.scenes[0].elementIds=[model.id];addObjectAssets(doc);
  assert.equal(model.props.appearance,CRAFT_APPEARANCE);assert.doesNotThrow(()=>validateDocument(doc));assert.deepEqual(assetIds(duplicateDocument(doc)),assetIds(doc));
 }
});
test('old volume style is selectable, keeps owned ribbon and validates independently of new default',()=>{
 const model=driveElementCards().find(c=>c.id==='drive-santa-gift-box').create()[0];assert.equal(model.props.preset,'lid-source-v6');model.props.preset='lid-volume-v4';naturalizeObject(model,canonicalText,{previousPreset:'lid-source-v6'});assert.equal(model.props.preset,'lid-volume-v4');model.props.assetId='owned-ribbon';naturalizeObject(model,canonicalText,{previousPreset:'lid-volume-v4'});assert.equal(model.props.assetId,'owned-ribbon');
});
test('source animation remains vector-only, immutable and has the same palette in its closed cover',()=>{const p={color:'#2D6B53',sealColor:'#C69A60',paperColor:'#FFF3DC'};const a=sourceGiftData(p),b=sourceGiftData(p);assert.deepEqual(a,b);assert.equal(a.assets.length,0);assert.equal(a.op,50);a.layers[0].nm='changed';assert.notEqual(sourceGiftData(p).layers[0].nm,'changed');assert(sourceGiftFrame(p).includes('rgb(45,107,83)'));assert(!sourceGiftFrame(p).includes('style='));});
