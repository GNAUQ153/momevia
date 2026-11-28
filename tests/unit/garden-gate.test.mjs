import test from 'node:test';
import assert from 'node:assert/strict';
import { playGardenGate, playInlineGardenGate } from '../../web/js/features/gift-runtime/garden-gate.js';

class Layer {
  constructor(id, x = 0, y = 0, w = 195, h = 844) {
    this.dataset = id ? { runtimeElement: id } : {};
    this.style = { left: x + '%', top: y + 'px', width: w + '%', height: h + 'px', minHeight: h + 'px', zIndex: '2', perspective: '', opacity: '1' };
    Object.assign(this, { offsetLeft: x, offsetTop: y, offsetWidth: w, offsetHeight: h, clientWidth: 390 });
    this.children = [];
  }
  append(node) { node.remove(); node.parent = this; this.children.push(node); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setAttribute() {}
  closest() { return this.parent; }
}
test('standalone Canvas doors animate both hinges and restore their pose when canceled', async () => {
  const nodes=['is-left','is-right','gift-botanical-seal'].map(name=>({style:{transform:'',opacity:'1'},classList:{contains:q=>q===name}}));
  const control={querySelectorAll:()=>nodes},controller=new AbortController(),runs=[];
  const motion={enabled:()=>true,run(node,frames,options,signal){runs.push({frames,options});return new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));}};
  const opening=playInlineGardenGate(control,motion,controller.signal);
  assert.deepEqual(runs.slice(0,2).map(r=>r.frames[1].transform),['rotateY(-92deg)','rotateY(92deg)']);
  assert.equal(runs[2].options.duration,320);assert.equal(runs[0].options.delay,130);
  controller.abort();await opening;
  assert(nodes.every(n=>n.style.transform===''&&n.style.opacity==='1'));
  assert.equal(playInlineGardenGate(control,{enabled:()=>false},new AbortController().signal),undefined);
});
function fixture() {
  const content = new Layer(); content.style.perspective = '300px';
  const models = [], children = [];
  for (const [side, x] of [['left', 0], ['right', 195]]) for (let i = 0; i < 4; i++) {
    const id = side + '-' + i;
    models.push({ id, groupId: side + '-0', type: 'shape', props: { kind: i ? 'ellipse' : `garden-door-${side}-v1` } });
    const node = new Layer(id, x + i, i * 40, i ? 20 : 195, i ? 40 : 844);
    content.append(node); children.push(node);
  }
  const control = new Layer('open'); content.append(control); children.push(control);
  const pending = [], runs = [];
  const motion = { enabled: () => true, run(node, frames, options, signal) {
    runs.push({ node, frames, options });
    return new Promise(resolve => { pending.push(resolve); signal.addEventListener('abort', resolve, { once: true }); });
  } };
  return { content, control, children, models, motion, pending, runs };
}
test('opening moves two complete door planes instead of separately animating the editable layers', async () => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => new Layer() };
  try {
    const f = fixture(), controller = new AbortController();
    const opened = playGardenGate(f.control, { elements: f.models }, f.motion, controller.signal);
    const planes = f.content.children.filter(n => n.className === 'gift-garden-door-plane');
    assert.equal(planes.length, 2); assert(planes.every(p => p.children.length === 4));
    assert.equal(f.runs.length, 3, 'two door animations and one seal fade');
    assert.equal(f.content.dataset.gardenOpening, '');
    f.pending.forEach(resolve => resolve()); await opened;
    assert.deepEqual(planes.map(p => p.style.transform), ['rotateY(-92deg)', 'rotateY(92deg)']);
    controller.abort();
    assert.equal(f.content.children.filter(n => n.className === 'gift-garden-door-plane').length, 2, 'outgoing scene keeps its open pose during crossfade');
  } finally { globalThis.document = original; }
});
test('canceling an opening restores the original layer order, coordinates and layout measurement', async () => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => new Layer() };
  try {
    const f = fixture(), controller = new AbortController();
    const before = f.children.map(node => ({ ...node.style }));
    const opened = playGardenGate(f.control, { elements: f.models }, f.motion, controller.signal);
    controller.abort(); await opened;
    assert.deepEqual(f.content.children, f.children);
    assert.deepEqual(f.children.map(node => node.style), before);
    assert.equal(f.content.style.perspective, '300px');
    assert.equal(f.content.dataset.gardenOpening, undefined);
  } finally { globalThis.document = original; }
});

test('canceling removes the next-scene underlay and restores the cover wording', async () => {
  const original = globalThis.document;
  globalThis.document = { createElement: () => new Layer() };
  try {
    const f = fixture(), controller = new AbortController(), copy = new Layer('cover-sender');
    f.content.append(copy);
    const order = [...f.content.children], below = new Layer();
    const opened = playGardenGate(f.control, { elements: f.models }, f.motion, controller.signal, () => {
      f.content.append(below); return below;
    });
    assert.equal(copy.style.opacity, '0');
    controller.abort(); await opened;
    assert.equal(copy.style.opacity, '1');
    assert.deepEqual(f.content.children, order);
    assert.equal(below.parent, null);
  } finally { globalThis.document = original; }
});
test('adding a fixed footer to the cover keeps the opening planes inside the body and freezes the full scene',async()=>{
 const original=globalThis.document;globalThis.document={createElement:()=>new Layer()};
 try{
  const f=fixture(),body=new Layer(),viewport=new Layer(),footer=new Layer('footer'),controller=new AbortController();
  for(const node of f.children)body.append(node);viewport.append(body);f.content.append(viewport);f.content.append(footer);
  f.control.closest=selector=>selector==='.gift-scene-body-content'?body:f.content;
  const before=[...body.children],opening=playGardenGate(f.control,{elements:f.models},f.motion,controller.signal);
  assert.equal(f.content.dataset.gardenOpening,'');assert.equal(body.children.filter(e=>e.className==='gift-garden-door-plane').length,2);
  assert.equal(footer.parent,f.content);controller.abort();await opening;
  assert.equal(f.content.dataset.gardenOpening,undefined);assert.deepEqual(body.children,before);assert.equal(footer.parent,f.content);
 }finally{globalThis.document=original;}
});
