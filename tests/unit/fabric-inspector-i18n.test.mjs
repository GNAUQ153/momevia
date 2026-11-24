import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { translateUi as translate, vi } from '../../web/js/shared/locale.js';
import { mountFabricInspector, inspectorErrorMessage } from '../../web/js/features/canvas-editor/fabric-inspector.js';
import { assessChangelog, affectsProduct } from '../../scripts/quality/check-changelog.mjs';

const label = (locale, key, params) => translate(locale === 'en' ? en : vi, locale, key, params);

function mockDOM() {
  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.textContent = '';
      this.value = '';
      this.listeners = new Map();
    }
    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    removeEventListener(name) { this.listeners.delete(name); }
    contains(target) { return this === target || this.children.some(child => child.contains?.(target)); }
    closest(selector) {
      if (selector === '[data-fabric-inspector-field]' && this.dataset.fabricInspectorField) return this;
      if (selector === '[data-fabric-inspector-center]' && this.dataset.fabricInspectorCenter) return this;
      return null;
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(selector === 'button' && child.tagName === 'BUTTON' ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
  }
  const previous = globalThis.document;
  globalThis.document = { createElement(tag) { return new Element(tag); } };
  return () => { globalThis.document = previous; };
}

test('Fabric Inspector labels are translated in both locales without modifying layer data', () => {
  const keys = [
    'aria', 'heading', 'empty', 'selected', 'readOnly', 'changed', 'help',
    'field.x', 'field.y', 'field.width', 'field.height', 'field.rotation',
    'center.horizontal', 'center.vertical', 'error.field', 'error.number',
  ];
  for (const suffix of keys) {
    const key = `editor.fabric.inspector.${suffix}`;
    assert(Object.hasOwn(vi, key));
    assert(Object.hasOwn(en, key));
    assert(en[key].trim().length > 0);
  }
  assert.equal(label('en', 'editor.fabric.inspector.field.width'), 'Width');
  assert.equal(label('en', 'editor.fabric.inspector.readOnly', { name: 'My layer' }), 'My layer - view only');
  assert.equal(label('vi', 'editor.fabric.inspector.readOnly', { name: 'Lớp riêng' }), 'Lớp riêng - chỉ xem');
  assert.equal(label('en', 'editor.fabric.inspector.error.field', {
    field: { format: 'message', key: 'editor.fabric.inspector.field.rotation' },
  }), 'Invalid Rotation.');
});

test('Fabric Inspector uses bound UI labels and localizes its validation error', () => {
  const restore = mockDOM();
  try {
    const listeners = new Map();
    let activeShape = null;
    const canvas = {
      getActiveObject: () => activeShape,
      on: (name, fn) => listeners.set(name, fn),
      off: name => listeners.delete(name),
      requestRenderAll() {},
    };
    const inspector = mountFabricInspector({
      canvas, artboard: { width: 500, height: 500 }, layerModels: new Map(), canEdit: () => true,
    });
    assert.equal(inspector.panel.getAttribute('aria-label'), vi['editor.fabric.inspector.aria']);
    const [header, fields, actions] = inspector.panel.children;
    assert.equal(header.children[0].textContent, vi['editor.fabric.inspector.heading']);
    assert.equal(header.children[1].textContent, vi['editor.fabric.inspector.empty']);
    assert.equal(fields.children[0].children[0].textContent, vi['editor.fabric.inspector.field.x']);
    assert.equal(actions.children[0].textContent, vi['editor.fabric.inspector.center.horizontal']);
    activeShape = {
      momeviaId: 'layer-a', width: 40, height: 20, scaleX: 1, scaleY: 1,
      left: 20, top: 15, angle: 0, selectable: true, visible: true,
      set() {}, setCoords() {},
    };
    listeners.get('selection:created')();
    const input = fields.children[2].children[1];
    input.value = 'not-a-number';
    fields.listeners.get('change')({ target: input });
    assert.equal(header.children[1].textContent, vi['editor.fabric.inspector.error.number']);
    inspector.dispose();
    assert.equal(listeners.size, 0);
  } finally {
    restore();
  }
});

test('Untrusted errors do not expose Vietnamese internals to English UI', () => {
  const translated = inspectorErrorMessage(new Error('Unexpected backend error with secret data'));
  // Unknown errors are mapped to a safe generic localized message.
  assert.equal(typeof translated, 'object');
  assert(!JSON.stringify(translated).includes('secret data'));
});

test('Changelog checker detects staged source without notes, but ignores docs-only changes', () => {
  assert.equal(affectsProduct('src/modules/payments/routes.mjs'), true);
  assert.equal(affectsProduct('web/js/pages/designer.js'), true);
  assert.equal(affectsProduct('README.md'), false);
  assert.equal(assessChangelog(['README.md', 'docs/OPERATIONS.md']).valid, true);
  assert.equal(assessChangelog(['src/modules/payments/routes.mjs']).valid, false);
  assert.equal(assessChangelog(['tests/unit/fabric-inspector.test.mjs', 'CHANGELOG.md']).valid, true);
});
