import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneProgress, createSceneNavigation } from '../../web/js/features/gift-runtime/scene-navigation.js';
import { translate, vi } from '../../web/js/shared/locale.js';
import en from '../../web/assets/locales/en.json' with { type: 'json' };

function createFixture(compact=false) {
  const handlers = {};
  const ownerDocument = { activeElement: null };
  ownerDocument.createElement = tagName => ({
    tagName: tagName.toUpperCase(),
    type: '',
    dataset: {},
    attrs: {},
    handlers: {},
    children: [],
    replaceChildren(...children) { this.children=children; },
    addEventListener(name,fn) { this.handlers[name]=fn; },
    offsetLeft: 0,
    offsetWidth: 100,
    setAttribute(name, value) { this.attrs[name] = value; },
    closest(selector) { return selector === 'button[data-scene-id]' ? this : null; },
    focus() { ownerDocument.activeElement = this; },
  });
  const navigation = {
    attrs: {'aria-label':'Các cảnh'},
    getAttribute(name) { return this.attrs[name]; },
    ownerDocument,
    children: [],
    clientWidth: 220,
    scrollLeft: 0,
    addEventListener(name, fn) { handlers[name] = fn; },
    contains(button) { return this.children.includes(button); },
    replaceChildren(...children) {
      this.children = children;
      children.forEach((button, index) => { button.offsetLeft = index * 100; });
    },
  };
  const progress = {};
  const chosen = [];
  const controller = new AbortController();
  const player = createSceneNavigation(navigation, progress, {
    onSelect: id => chosen.push(id),
    signal: controller.signal,
    compact,
  });
  const scenes = [
    { id: 'first', name: 'Mở thiệp' },
    { id: 'second', name: 'Lời nhắn' },
    { id: 'third', name: 'Lưu giữ' },
  ];
  return { navigation, progress, chosen, controller, player, scenes, handlers, ownerDocument };
}

test('Scene progress reports position without modifying the Canvas document', () => {
  const scenes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(sceneProgress(scenes, 'b'), { index: 2, total: 3 });
  assert.deepEqual(sceneProgress(scenes, 'invalid'), { index: 0, total: 3 });
  assert.deepEqual(sceneProgress([], 'a'), { index: 0, total: 0 });
  assert.deepEqual(sceneProgress(null, 'a'), { index: 0, total: 0 });
});

test('compact preview navigation keeps one accessible select and all scenes without a scrolling button rail',()=>{
 const f=createFixture(true);f.player.sync(f.scenes,'second');
 const select=f.navigation.children[0];assert.equal(select.tagName,'SELECT');assert.equal(select.value,'second');assert.equal(select.attrs['aria-label'],'Các cảnh');
 assert.deepEqual(select.children.map(e=>[e.value,e.textContent]),[['first','1. Mở thiệp'],['second','2. Lời nhắn'],['third','3. Lưu giữ']]);
 select.value='third';select.handlers.change();assert.deepEqual(f.chosen,['third']);
 f.navigation.attrs['aria-label']='Scenes';f.player.sync(f.scenes.map(s=>({...s,name:'English: '+s.name})),'third');
 assert.equal(f.navigation.children[0],select);assert.equal(select.attrs['aria-label'],'Scenes');assert.equal(select.children[0].textContent,'1. English: Mở thiệp');
 f.player.sync([f.scenes[0]],'first');assert.equal(f.navigation.hidden,true);assert.equal(f.progress.hidden,true);
});

test('Navigation preserves DOM buttons across scene changes and updates progress', () => {
  const f = createFixture();
  f.player.sync(f.scenes, 'first');
  const originalButtons = [...f.navigation.children];
  assert.equal(f.progress.value, 1);
  assert.equal(f.progress.max, 3);
  assert.equal(f.progress.hidden, false);
  assert.equal(originalButtons[0].attrs['aria-current'], 'step');
  f.player.sync(f.scenes, 'second');
  assert.equal(f.progress.value, 2);
  assert.deepEqual(f.navigation.children, originalButtons);
  assert.equal(originalButtons[1].attrs['aria-current'], 'step');
  assert.equal(originalButtons[0].attrs['aria-current'], 'false');
  assert.equal(f.navigation.scrollLeft, 0);
  f.player.sync(f.scenes, 'third');
  assert.equal(f.navigation.scrollLeft, 80);
});

test('Arrow keys/Home/End move focus without skipping a scene or activating gifts', () => {
  const f = createFixture();
  f.player.sync(f.scenes, 'first');
  const [one, two, three] = f.navigation.children;
  let prevented = 0;
  const press = (target, key) => f.handlers.keydown({
    target, key,
    preventDefault() { prevented++; },
  });
  press(one, 'ArrowRight');
  assert.equal(f.ownerDocument.activeElement, two);
  press(two, 'End');
  assert.equal(f.ownerDocument.activeElement, three);
  press(three, 'ArrowRight');
  assert.equal(f.ownerDocument.activeElement, three);
  press(three, 'Home');
  assert.equal(f.ownerDocument.activeElement, one);
  press(one, 'ArrowLeft');
  assert.equal(f.ownerDocument.activeElement, one);
  press(one, 'Enter');
  assert.equal(prevented, 5);
  assert.deepEqual(f.chosen, []);
  f.handlers.click({ target: two });
  assert.deepEqual(f.chosen, ['second']);
});

test('Preview localization updates scene names without recreating buttons', () => {
  const f = createFixture();
  f.player.sync(f.scenes, 'second');
  const saved = f.navigation.children[1];
  const localized = f.scenes.map(scene => ({ ...scene, name: 'English: ' + scene.name }));
  f.player.sync(localized, 'second');
  assert.equal(f.navigation.children[1], saved);
  assert.equal(saved.textContent, '2. English: Lời nhắn');
  assert.equal(f.progress.value, 2);
  f.player.sync([localized[0]], 'first');
  assert.equal(f.progress.hidden, true);
  assert.equal(f.navigation.children.length, 1);
});

test('Progress label is localized, while personal scene names are never auto-translated', () => {
  assert.equal(translate(en, 'en', 'gift.player.progressLabel'), 'Gift scene progress');
  assert.equal(translate(vi, 'vi', 'gift.player.progressLabel'), 'Tiến trình xem các cảnh');
  const f = createFixture();
  f.player.sync(f.scenes, 'first');
  assert.equal(f.navigation.children[0].textContent, '1. Mở thiệp');
});
