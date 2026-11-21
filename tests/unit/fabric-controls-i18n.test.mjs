import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { translate, vi } from '../../web/js/shared/locale.js';
import { selectLocale } from '../../web/js/core/i18n.js';
import {
  mountFabricQuickbar, quickbarUiError,
} from '../../web/js/features/canvas-editor/fabric-quickbar.js';
import {
  mountFabricProperties, propertiesUiError,
} from '../../web/js/features/canvas-editor/fabric-properties.js';

class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.attributes = [];
    this.dataset = {};
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.classList = { toggle() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) {
    const existing = this.attributes.find(item => item.name === name);
    if (existing) existing.value = String(value);
    else this.attributes.push({ name, value: String(value) });
  }
  getAttribute(name) { return this.attributes.find(item => item.name === name)?.value ?? null; }
  removeAttribute(name) { this.attributes = this.attributes.filter(item => item.name !== name); }
  addEventListener(event, handler) { this.listeners.set(event, handler); }
  removeEventListener(event) { this.listeners.delete(event); }
  contains(target) { return this === target || this.children.some(item => item.contains?.(target)); }
  closest(selector) {
    if (selector === '[data-fabric-style]' && this.dataset.fabricStyle) return this;
    if (selector === '[data-quickbar-action]' && this.dataset.quickbarAction) return this;
    return null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(item => [
      ...(selector === 'button' && item.tagName === 'BUTTON' ? [item] : []),
      ...(item.querySelectorAll?.(selector) ?? []),
    ]);
  }
}

function installDOM() {
  const previous = {
    document: globalThis.document, fetch: globalThis.fetch,
    Node: globalThis.Node, NodeFilter: globalThis.NodeFilter,
  };
  const root = new MockElement('html');
  globalThis.document = {
    documentElement: root,
    createElement(tag) { return new MockElement(tag); },
    querySelectorAll() { return []; },
    createTreeWalker(target) {
      const nodes = [];
      const visit = node => { nodes.push(node); node.children.forEach(visit); };
      visit(target);
      let index = -1;
      return {
        currentNode: null,
        nextNode() {
          index += 1;
          this.currentNode = nodes[index];
          return index < nodes.length;
        },
      };
    },
  };
  globalThis.Node = { COMMENT_NODE: 8, TEXT_NODE: 3 };
  globalThis.NodeFilter = { SHOW_ELEMENT: 1, SHOW_COMMENT: 128, SHOW_TEXT: 4 };
  globalThis.fetch = async url => {
    assert.equal(url, '/assets/locales/en.json');
    return { ok: true, async json() { return en; } };
  };
  return {
    root,
    restore() { for (const [key, value] of Object.entries(previous)) globalThis[key] = value; },
  };
}

function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

const display = (lang, value) => translate(lang === 'en' ? en : vi, lang, value.key, value.params);

test('Fabric quickbar and appearance panels switch VI/EN in place without changing design data', async () => {
  const dom = installDOM();
  try {
    await selectLocale('vi', { persist: false });
    const model = {
      id: 'my-note', name: 'Lời chúc riêng', type: 'text', opacity: 1,
      props: { color: '#102030', fontToken: 'body', fontSize: 24, align: 'left', lineHeight: 1.4 },
    };
    const shape = {
      momeviaId: model.id, selectable: true, visible: true,
      width: 100, height: 40, left: 90, top: 80, angle: 0, scaleX: 1, scaleY: 1,
      set(values) { Object.assign(this, values); },
      setCoords() {},
    };
    const events = new Map();
    const canvas = {
      getActiveObject: () => shape,
      on(type, fn) {
        if (!events.has(type)) events.set(type, new Set());
        events.get(type).add(fn);
      },
      off(type, fn) { events.get(type)?.delete(fn); },
      fire(type) { for (const fn of events.get(type) ?? []) fn(); },
      requestRenderAll() {},
    };
    const dialog = new MockElement('dialog');
    const layerModels = new Map([[model.id, model]]);
    const options = { canvas, layerModels, canEdit: () => true };
    const quickbar = mountFabricQuickbar({ ...options, artboard: { width: 400, height: 300 }, dialog });
    const properties = mountFabricProperties(options);
    dialog.append(quickbar.panel, properties.panel);
    dom.root.append(dialog);
    const control = find(quickbar.panel, item => item.dataset.quickbarAction === 'move-left');
    const button = find(properties.panel, item => item.tagName === 'BUTTON');
    const option = find(properties.panel, item => item.tagName === 'OPTION' && item.value === 'serif');
    assert.equal(control.textContent, 'Trái');
    assert.equal(option.textContent, 'Thanh lịch');
    assert.equal(quickbar.panel.getAttribute('aria-label'), 'Chỉnh nhanh lớp đang chọn');

    await selectLocale('en', { persist: false });
    assert.equal(control.textContent, 'Left');
    assert.equal(control.getAttribute('title'), 'Move layer left');
    assert.equal(control.getAttribute('aria-label'), 'Move layer left');
    assert.equal(quickbar.panel.getAttribute('aria-label'), 'Quick edit selected layer');
    assert.equal(option.textContent, 'Elegant');
    assert.equal(button.textContent, 'Show properties');
    assert(find(properties.panel, item => item.textContent === 'Font style'));
    assert(find(properties.panel, item => item.textContent === 'Text: Lời chúc riêng'));
    assert.equal(model.name, 'Lời chúc riêng'); // Nội dung người dùng không tự dịch.

    const controls = find(quickbar.panel, item => item.className === 'fabric-quickbar__controls');
    controls.listeners.get('click')({ target: control });
    assert.equal(shape.left, 89);
    assert(find(quickbar.panel, item => item.textContent === 'Edited · not yet applied to design'));

    const fields = find(properties.panel, item => item.className === 'fabric-properties__grid');
    const fontInput = find(fields, item => item.dataset.fabricStyle === 'fontSize');
    fontInput.value = '32';
    fields.listeners.get('change')({ target: fontInput });
    assert.equal(shape.fontSize, 32);
    assert.equal(model.props.fontSize, 24);
    assert.deepEqual(properties.changes(), [{ id: model.id, fields: { fontSize: 32 } }]);
    fontInput.value = '';
    fields.listeners.get('change')({ target: fontInput });
    assert(find(properties.panel, item => item.textContent === 'Enter a valid number.'));

    await selectLocale('vi', { persist: false });
    assert.equal(control.textContent, 'Trái');
    assert.equal(find(properties.panel, item => item.tagName === 'OPTION' && item.value === 'serif').textContent, 'Thanh lịch');
    assert.equal(shape.fontSize, 32);
    properties.dispose();
    quickbar.dispose();
    assert([...events.values()].every(items => items.size === 0));
  } finally {
    await selectLocale('vi', { persist: false });
    dom.restore();
  }
});

test('Every Fabric Quickbar and Appearance user-facing key has a distinct English translation', () => {
  const keys = [
    'editor.fabric.quickbar.aria', 'editor.fabric.quickbar.heading', 'editor.fabric.quickbar.empty',
    'editor.fabric.quickbar.hint', 'editor.fabric.quickbar.changed',
    'editor.fabric.properties.heading', 'editor.fabric.properties.toggle.open',
    'editor.fabric.properties.toggle.close', 'editor.fabric.properties.changed',
    ...['move-left', 'move-right', 'move-up', 'move-down', 'rotate-left',
      'rotate-right', 'center-x', 'center-y'].flatMap(action =>
      [`editor.fabric.quickbar.action.${action}.label`, `editor.fabric.quickbar.action.${action}.description`]),
    ...['color', 'fontToken', 'fontSize', 'align', 'lineHeight',
      'strokeColor', 'strokeWidth', 'radius', 'opacity'].map(field =>
      `editor.fabric.properties.field.${field}`),
  ];
  for (const key of keys) {
    assert(Object.hasOwn(vi, key), `Missing VI ${key}`);
    assert(Object.hasOwn(en, key), `Missing EN ${key}`);
    assert.notEqual(vi[key], en[key], `Not translated: ${key}`);
  }
  assert.equal(display('en', quickbarUiError(new Error('Unexpected password detail'))),
    'Could not complete the quick edit.');
  assert.equal(display('en', propertiesUiError(new Error('Unexpected password detail'))),
    'Invalid appearance value.');
});
