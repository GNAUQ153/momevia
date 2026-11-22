import { usesSound } from '../../web/js/shared/canvas/sound.js';
import { EVENT_CLUSTER_IDS } from '../../web/js/shared/canvas/event-clusters.js';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, matchesBlock, sampleBindings } from '../../web/js/features/canvas-editor/library.js';
import { assetIds, createDocument, duplicateDocument, publicDocument, validateDocument } from '../../web/js/shared/canvas/index.js';
import { requiresCanvasV2 } from '../../web/js/shared/canvas/schema.js';
import { effectFamilies, effectsFor } from '../../web/js/shared/canvas/effects.js';
import { eventTimeFromLocal, interactionKinds, localEventTime, photoSlots } from '../../web/js/shared/canvas/interactions.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { cleanGiftLayout } from '../../web/js/shared/canvas/clean-layout.js';

const cards = catalog.flatMap(({items}) => items);
const originalCards = cards.filter(card => card.id!=='sound-button' && !EVENT_CLUSTER_IDS.includes(card.id) && !card.id.startsWith("m54-") && !card.id.startsWith("m55-"));

test('the pre-expansion V1 fixture round-trips without a document upgrade', () => {
  const document = JSON.parse(fs.readFileSync(new URL('../fixtures/canvas-v1.json',import.meta.url),'utf8'));
  assert.equal(document.schemaVersion,1);
  assert.equal(document.registryVersion,1);
  assert.equal(requiresCanvasV2(document),false);
  assert.deepEqual(validateDocument(document),document);
  assert.equal(publicDocument(document).schemaVersion,1);
  assert.match(previewSvg(document),/Mở món quà/);
});
function forCard(id) {
  const document = sampleBindings(createDocument({ presetId: 'envelope-basic' }));
  const elements = cards.find(card => card.id === id).create();
  document.elements.push(...elements);
  document.scenes[0].elementIds.push(...elements.map(item => item.id));
  if (requiresCanvasV2(document)) document.schemaVersion = document.registryVersion = 2;
  if(usesSound(document))document.schemaVersion=document.registryVersion=3;
  return { document, elements };
}

test('100 original library IDs match the approved 72 additions and the 28 original IDs', () => {
  const plan = fs.readFileSync(new URL('../../docs/CANVAS_100_ELEMENTS_PLAN.md',import.meta.url),'utf8');
  const planned = Array.from(plan.matchAll(/^\| (\d{2,3}) \| `([^\x60]+)` \| ([^|]+) \|/gm), ([,n,id,label]) => [Number(n),id,label.trim()]);
  assert.deepEqual(planned.map(([n])=>n),Array.from({length:72},(_,i)=>i+29));
  const baseline = ['heading','paragraph','greeting','recipient','signature','photo','rounded-photo','polaroid',
    'rectangle','rounded','ellipse','circle','divider','heart','star','flower','sparkles','balloon','cake','gift',
    'flowers','leaves','stars','envelope','gift-box','continue','replay','reply'];
  assert.deepEqual(originalCards.map(card=>card.id).sort(), [...baseline,...planned.map(([,id])=>id)].sort());
  assert.deepEqual(catalog.filter(group => !group.label.startsWith("Kho trang trí · ")).map(group=>group.items.length),[15,14,15,21,12,17,16]);
  for (const [,id,label] of planned) assert.equal(cards.find(card=>card.id===id).title,label);
  for (const card of cards) assert(matchesBlock(card, card.title),card.id);
  assert(matchesBlock(cards.find(card=>card.id==='wax-seal'),'con dau'));
  assert(matchesBlock(cards.find(card=>card.id==='hero-collage'),'anh ghep'));
});

test('all 172 factories survive draft, duplicate, public projection and static cover render', () => {
  for (const card of cards) {
    const { document,elements } = forCard(card.id);
    assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(document))),document,card.id);
    const duplicate = duplicateDocument(document);
    assert.equal(duplicate.elements.length,document.elements.length,card.id);
    for (const element of elements) {
      for (const [i,action] of (element.actions || []).entries())
        if (action.type === 'goToScene') action.targetSceneId = document.scenes[i+1].id;
      for (const [i,photo] of photoSlots(element).entries()) {
        if (element.type === 'image' && element.props.optional) continue;
        const assetId = `test-asset-${i}`;
        photo.assetId = assetId;
        if (element.type === 'interaction') Object.assign(photo,{alt:`Ảnh ${i+1}`,caption:`Khoảnh khắc ${i+1}`});
        if (!document.assets.some(asset=>asset.assetId===assetId)) document.assets.push({assetId,kind:'image'});
      }
      if (element.props.kind === 'event-countdown') element.props.eventAt = '2026-11-18T07:00:00.000Z';
    }
    const snapshot = publicDocument(document);
    assert.deepEqual(assetIds(snapshot), assetIds(document),card.id);
    assert.deepEqual(validateDocument(snapshot,{mode:'publish'}),snapshot,card.id);
    assert.match(previewSvg(snapshot), /^<svg /,card.id);
  }
});

test('photo and action publish blockers identify the slot, and layout reuse clears personal data', () => {
  for (const id of ['swipe-album','photo-comparison']) {
    const {document,elements:[element]} = forCard(id);
    assert.throws(()=>publicDocument(document), error => error.code==='INTERACTION_PHOTO_REQUIRED' && error.details[0].path.endsWith('photos.0.assetId'));
    for (const [i,photo] of element.props.photos.entries()) {
      Object.assign(photo,{assetId:`private-${i}`,alt:'Ảnh riêng',caption:'Chú thích riêng',focalPoint:{x:.18,y:.77}});
      document.assets.push({assetId:photo.assetId,kind:'image'});
    }
    const snapshot = publicDocument(document);
    assert.deepEqual(snapshot.elements.at(-1).props.photos,element.props.photos);
    assert.deepEqual(duplicateDocument(snapshot).elements.at(-1).props.photos,element.props.photos);
    assert.deepEqual(assetIds(cleanGiftLayout(snapshot)),[]);
    assert(!JSON.stringify(cleanGiftLayout(snapshot)).includes('Ảnh riêng'));
  }
  const {document,elements:[doors]} = forCard('scene-choices');
  doors.actions.forEach(action => {action.targetSceneId=document.scenes[1].id;});
  assert.throws(()=>publicDocument(document),error=>error.code==='ACTION_TARGET');
  doors.actions[1].targetSceneId=document.scenes[2].id;
  const copy=duplicateDocument(document);
  assert.deepEqual(copy.elements.at(-1).actions.map(action=>action.targetSceneId),copy.scenes.slice(1).map(scene=>scene.id));
});

test('33 effect IDs have compatible validated, persisted and public configurations', () => {
  const ids = new Set();
  for (const [family,{presets}] of Object.entries(effectFamilies)) {
    for (const id of Object.keys(presets)) {
      ids.add(id);
      const elementId = {E03:'heading',E04:'wave-line',E05:'arch-photo',E06:'arch-photo',A02:'arch-photo',A04:'quote-block',A05:'arch-photo',R01:'envelope',R02:'gift-box',R04:'light-a-candle'}[id]
        || (family==='surface' ? 'rectangle' : 'continue');
      const {document,elements} = forCard(elementId);
      const model = ['transition','ambience'].includes(family) ? document.scenes[0] :
        elements.find(item=>effectsFor(family,item).some(([option])=>option===id));
      for (const element of elements) for (const action of element.actions || [])
        if (action.type==='goToScene') action.targetSceneId=document.scenes[1].id;
      model.effects = {[family]:{id}};
      assert.throws(()=>validateDocument({...document,schemaVersion:1,registryVersion:1}),/phiên bản 2/);
      document.schemaVersion = document.registryVersion = 2;
      assert.deepEqual(validateDocument(document),document,id);
      const publicModel = [...publicDocument(document).elements,...publicDocument(document).scenes].find(item=>item.id===model.id);
      assert.equal(publicModel.effects[family].id,id);
    }
  }
  assert.equal(ids.size,33);
  assert.equal(Object.keys(interactionKinds).length,11);
});

test('countdown accepts a real absolute local time, including DST gap and overlap', () => {
  assert.equal(eventTimeFromLocal('2026-11-19T18:30','Asia/Ho_Chi_Minh'),'2026-11-19T11:30:00.000Z');
  assert.equal(localEventTime('2026-11-19T11:30:00.000Z','Asia/Ho_Chi_Minh'),'2026-11-19T18:30');
  assert.throws(()=>eventTimeFromLocal('2026-03-08T02:30','America/New_York'),/không tồn tại/);
  assert.equal(eventTimeFromLocal('2026-11-01T01:30','America/New_York'),'2026-11-01T05:30:00.000Z');
});
