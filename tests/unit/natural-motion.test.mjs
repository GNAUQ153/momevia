import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {naturalElementCards} from '../../web/js/shared/canvas/natural-elements.js';
import {validateAnimation,validatePortableEffect} from '../../web/js/shared/canvas/library-contract.js';
import {playRecipe} from '../../web/js/features/gift-runtime/recipe-runtime.js';
import {eventRecipe} from '../../web/js/shared/canvas/event-recipes.js';
test('all six motion cards carry infinite emphasis through JSON without changing one-shot recipes',()=>{
 const cards=naturalElementCards('animation');assert.equal(cards.length,6);
 for(const card of cards){const [model]=card.create(),preset=JSON.parse(JSON.stringify(model.effects.emphasis));assert.equal(preset.definition.animation.iterations,'infinite');assert(!model.effects.entrance);validatePortableEffect(preset.definition,'emphasis',model);}
 assert.equal(eventRecipe('keepsake-sway-v1').definition.animation.iterations,3);assert.equal(eventRecipe('paper-unfold-natural-v1').definition.animation.iterations,1);
});
test('infinite animation is an explicit JSON value restricted to keyframe emphasis',async()=>{
 const preset=naturalElementCards('animation')[0].create()[0].effects.emphasis,a=preset.definition.animation;
 validateAnimation(a,'emphasis');assert.throws(()=>validateAnimation(a,'entrance'));
 assert.throws(()=>validateAnimation({...a,iterations:Infinity},'emphasis'));assert.throws(()=>validateAnimation({...a,iterations:'Infinity'},'emphasis'));
 let timing;await playRecipe({dataset:{}},preset,{run:async(n,k,options)=>{timing=options;}},new AbortController().signal);assert.equal(timing.iterations,Infinity);
});
test('motion release preserves the six prior definitions for CAS and rollback',()=>{
 const bundle=JSON.parse(fs.readFileSync(new URL('../../database/updates/natural-motion-loop-20261123-v1.json',import.meta.url)));assert.equal(bundle.changes.length,6);
 for(const c of bundle.changes){assert.equal(c.before.revision,1);assert.equal(c.next.revision,2);assert.equal(c.before.id,c.next.id);assert.equal(c.next.definition.elements[0].effects.emphasis.definition.animation.iterations,'infinite');assert.notEqual(c.before.definition.elements[0].effects.emphasis?.definition?.animation.iterations,'infinite');}
});

