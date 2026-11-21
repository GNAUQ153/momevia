import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, validateDocument, duplicateDocument, publicDocument } from '../../web/js/shared/canvas/index.js';
import { CELEBRATION_IDS, defaultCelebrations, celebrationSettings } from '../../web/js/shared/canvas/effects.js';

test('each celebration independently round-trips enabled, speed, density and repeat through V2/public/duplicate', () => {
  const d=createDocument({template:{id:'birthday-radiance'}}),settings=d.scenes[0].effects.celebrations;
  Object.assign(settings.B05,{enabled:true,speed:'fast',density:'dense',loop:true});
  Object.assign(settings.B06,{enabled:false,speed:'slow',density:'sparse',loop:false});
  Object.assign(settings.B07,{enabled:true,speed:'normal',density:'normal',loop:true});
  for(const b of Object.values(d.bindings))b.value='Nội dung riêng';
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(d)),{mode:'publish'}),d);
  assert.deepEqual(publicDocument(d).scenes[0].effects.celebrations,settings);
  assert.deepEqual(duplicateDocument(d).scenes[0].effects.celebrations,settings);
  assert.notDeepEqual(settings.B05,settings.B06);
});

test('all three starters repeat their chosen atmospheres and expose separate settings for all four effects', () => {
  for(const id of ['birthday-radiance','hai-phong-bi','proud-of-you']) {
    const d=createDocument({template:{id}}),active=new Set();
    for(const s of d.scenes) {
      assert.deepEqual(Object.keys(s.effects.celebrations),CELEBRATION_IDS);
      for(const [effect,p]of Object.entries(s.effects.celebrations)){assert.equal(p.loop,true);if(p.enabled)active.add(effect);}
    }
    assert.deepEqual(active,new Set(CELEBRATION_IDS));
  }
});

test('legacy one-shot atmospheres remain unchanged when read and migrate without losing their intent', () => {
  const old={ambience:{id:'B06',speed:'slow',density:'normal'}},before=structuredClone(old);
  const settings=celebrationSettings(old);
  assert.deepEqual(old,before);
  assert.deepEqual(settings.B06,{enabled:true,speed:'slow',density:'normal',loop:false});
  assert.equal(settings.B05.enabled,false);
  assert.equal(celebrationSettings({ambience:{id:'B05'}}).B05.density,'normal','legacy omitted density keeps its original medium default');
  const independent=defaultCelebrations();independent.B05.enabled=true;
  assert.equal(independent.B06.enabled,false);
  const legacy=createDocument({presetId:'envelope-basic'});legacy.schemaVersion=legacy.registryVersion=2;
  legacy.scenes[0].effects=old;
  assert.deepEqual(validateDocument(legacy).scenes[0].effects,old);
});

test('celebration settings fail closed for unknown IDs, fields, types and unsupported values', () => {
  const changes=[x=>{x.B09=x.B05;},x=>{x.B05.enabled='yes';},x=>{x.B05.loop=1;},x=>{x.B05.density='unlimited';},x=>{x.B05.speed='instant';},x=>{x.B05.url='https://example.test';}];
  for(const mutate of changes) {
    const d=createDocument({template:{id:'birthday-radiance'}});mutate(d.scenes[0].effects.celebrations);assert.throws(()=>validateDocument(d));
  }
  const d=createDocument({template:{id:'birthday-radiance'}});
  d.elements[0].effects={celebrations:defaultCelebrations()};assert.throws(()=>validateDocument(d),'scene-only settings cannot be injected into elements');
});
