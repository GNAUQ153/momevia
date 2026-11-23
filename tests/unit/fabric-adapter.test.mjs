import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement, validateDocument } from '../../web/js/shared/canvas/index.js';
import {
  fabricView, canFabricEdit, displayText, fabricDiff, applyFabricDiff, layoutFromFabric,
} from '../../web/js/features/canvas-editor/fabric-adapter.js';

function source() {
  const document = createDocument({ presetId: 'envelope-basic' });
  document.bindings.recipientName.value = 'Hà My';
  document.bindings.message.value = 'Chúc bạn một ngày vui';
  document.elements.push(createElement('shape', {
    id: 'shape-personal',
    props: { kind: 'rectangle', color: '#AABBCC' },
    layout: { x: 40, y: 60, width: 140, height: 90, rotation: 0 },
  }));
  document.scenes[0].elementIds.push('shape-personal');
  return validateDocument(document);
}

test('Fabric leaves subpixel geometry intact when another layer is changed',()=>{
 const doc=source(),element=doc.elements.find(e=>e.id==='shape-personal');
 Object.assign(element.layout,{x:120.3125,y:293.0390625,width:139.9140625,height:162.890625});
 const {x,y,width,height,rotation}=element.layout;
 const shape={momeviaId:element.id,left:x+width/2,top:y+height/2,width,height,scaleX:1,scaleY:1,angle:rotation};
 assert.deepEqual(fabricDiff(doc,doc.entrySceneId,[shape]),[]);
 shape.left+=3;const [change]=fabricDiff(doc,doc.entrySceneId,[shape]);
 assert.equal(change.layout.x,Math.round((x+3)*100)/100);assert.equal(change.layout.y,y);assert.equal(change.layout.width,width);assert.equal(change.layout.height,height);
});

test('Fabric view preserves scene order, bindings, and original document', () => {
  const document = source();
  const before = structuredClone(document);
  const view = fabricView(document, document.entrySceneId);
  assert.deepEqual(view.elements.map(item => item.id), document.scenes[0].elementIds);
  assert.equal(view.elements.find(item => item.id === 'text-recipient').text, 'Hà My');
  assert.equal(view.elements.find(item => item.id === 'shape-personal').editable, true);
  assert.equal(view.elements.find(item => item.id === 'open-gift').editable, false);
  assert.deepEqual(document, before);
});

test('Fabric uses center coordinates but saves top-left layout without drift', () => {
  const element = source().elements.find(item => item.id === 'shape-personal');
  const geometry = { momeviaId: element.id, width: 140, height: 90, scaleX: 1, scaleY: 1, left: 110, top: 105, angle: 0 };
  assert.deepEqual(layoutFromFabric(element, geometry), element.layout);
  assert.deepEqual(layoutFromFabric(element, { ...geometry, left: 132, top: 132, scaleX: 1.1, angle: 45 }), {
    x: 55, y: 87, width: 154, height: 90, rotation: 45,
  });
});

test('Fabric diff updates one editable layer and preserves interactions', () => {
  const document = source();
  const current = document.elements.find(item => item.id === 'shape-personal');
  const shapes = [{ momeviaId: 'shape-personal', width: 140, height: 90, scaleX: 1, scaleY: 1, left: 160, top: 115, angle: 0 }];
  const updates = fabricDiff(document, document.entrySceneId, shapes);
  assert.equal(updates.length, 1);
  const next = applyFabricDiff(document, document.entrySceneId, updates);
  assert.equal(next.elements.find(item => item.id === current.id).layout.x, 90);
  assert.deepEqual(next.elements.find(item => item.id === 'open-gift').actions, document.elements.find(item => item.id === 'open-gift').actions);
  assert.deepEqual(validateDocument(next), next);
  assert.deepEqual(document, source());
});

test('Binding text, locked layers and creator template policy cannot be modified', () => {
  const document = source();
  const bound = document.elements.find(item => item.id === 'text-recipient');
  assert.equal(displayText(bound, document), 'Hà My');
  const attempt = { id: bound.id, layout: bound.layout, text: 'Bị sửa' };
  assert.throws(() => applyFabricDiff(document, document.entrySceneId, [attempt]), /khóa/);
  const policy = { kind: 'creator-template', lockedElements: {} };
  assert.equal(canFabricEdit(document.elements.find(item => item.id === 'shape-personal'), policy), false);
  assert.throws(() => applyFabricDiff(document, document.entrySceneId, [{ id: 'shape-personal', layout: { x: 0, y: 0, width: 10, height: 10, rotation: 0 } }], policy), /khóa/);
  assert.throws(() => applyFabricDiff(document, document.entrySceneId, [{ id: 'open-gift', layout: { x: 0, y: 0, width: 10, height: 10, rotation: 0 } }]), /khóa/);
});

test('Text editing is allowed for literal text but never for bound text', () => {
  const document = source();
  const literal = document.elements.find(item => item.id === 'text-intro');
  const next = applyFabricDiff(document, document.entrySceneId, [{ id: literal.id, layout: literal.layout, text: 'Mùa lễ Việt Nam' }]);
  assert.equal(next.elements.find(item => item.id === literal.id).props.text, 'Mùa lễ Việt Nam');
  assert.equal(next.elements.find(item => item.id === 'text-recipient').props.textBinding, 'recipientName');
  assert.deepEqual(validateDocument(next), next);
});

test('Reject invalid numbers and edits to other scenes', () => {
  const document = source();
  const e = document.elements.find(item => item.id === 'shape-personal');
  assert.throws(() => applyFabricDiff(document, document.entrySceneId, [{ id: e.id, layout: { x: Infinity, y: 0, width: 10, height: 10, rotation: 0 } }]), /không hợp lệ/);
  assert.throws(() => applyFabricDiff(document, 'scene-surprise', [{ id: e.id, layout: e.layout }]), /khóa/);
  assert.deepEqual(fabricDiff(document, document.entrySceneId, [{ momeviaId: '__proto__', left: 0, top: 0, width: 10, height: 10, scaleX: 1, scaleY: 1, angle: 0 }]), []);
});
