import test from 'node:test';
import assert from 'node:assert/strict';
import { reflowSceneNodes,growReadingSurfaces } from '../../web/js/features/gift-runtime/reflow.js';

test('long prose keeps its authored reading surface behind the final line without changing stored layouts',()=>{
 const paper={model:{type:'shape',props:{kind:'rectangle'},layout:{x:20,y:100,width:350,height:240}},node:{style:{top:'100px',height:'240px'}}};
 const prose={model:{type:'text',accessibility:{},layout:{x:40,y:130,width:300,height:180}},node:{style:{top:'130px'},offsetHeight:350}};
 const before=structuredClone(paper.model);growReadingSurfaces([paper,prose],1);assert.equal(paper.node.style.height,'396px');assert.deepEqual(paper.model,before);
});

const layer = (type, y, plannedHeight, actualHeight, props = {}) => ({
  model: { type, layout: { y, height: plannedHeight }, props, accessibility: {} },
  node: { style: {}, getBoundingClientRect() { return { bottom: parseFloat(this.style.top) + actualHeight }; } },
});
test('long content preserves intentional overlaps and pushes the following control once', () => {
  const first = layer('text', 0, 100, 140), overlap = layer('text', 50, 40, 25), button = layer('button', 120, 50, 50);
  const result = reflowSceneNodes([first, overlap, button], 1, 0);
  assert.equal(first.node.style.top, '0px');
  assert.equal(overlap.node.style.top, '50px');
  assert.equal(button.node.style.top, '160px');
  assert.equal(result.actualEnd, 210);
});
test('RSVP uses actual form height and retains the navigation gap without a scaled empty panel', () => {
  const form = layer('reply', 64, 650, 400, { replyMode: 'attendance' }), next = layer('button', 744, 58, 58);
  const result = reflowSceneNodes([form, next], 1, 0);
  assert.equal(next.node.style.top, '494px');
  assert.equal(result.actualEnd, 552);
  assert.equal(result.intrinsicReply, true);
});
test('existing reply cards keep their authored spacing', () => {
  const form = layer('reply', 64, 650, 400), next = layer('button', 744, 58, 58);
  const result = reflowSceneNodes([form, next], 1, 0);
  assert.equal(next.node.style.top, '744px');
  assert.equal(result.intrinsicReply, false);
});
