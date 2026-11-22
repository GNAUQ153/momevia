import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { journeySwipeDirection, journeySteps, mountJourney } from '../../web/js/features/marketing/journey.js';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Vuốt chỉ nhận ý định ngang rõ ràng, bỏ qua cuộn dọc và tọa độ sai', () => {
  const origin = { x: 200, y: 80 };
  assert.equal(journeySwipeDirection(origin, { x: 130, y: 85 }), 1);
  assert.equal(journeySwipeDirection(origin, { x: 265, y: 79 }), -1);
  assert.equal(journeySwipeDirection(origin, { x: 158, y: 80 }), 0);
  assert.equal(journeySwipeDirection(origin, { x: 90, y: 220 }), 0);
  assert.equal(journeySwipeDirection(origin, { x: Infinity, y: 80 }), 0);
  assert.equal(journeySwipeDirection(null, { x: 0, y: 0 }), 0);
});

test('Vuốt đổi bước, không vòng qua hai đầu, bỏ qua đa chạm và dọn listener', () => {
  const buttons = journeySteps.map(id => ({
    dataset: { mktStep: id },
    attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
  }));
  const panels = journeySteps.map(id => ({ dataset: { mktPanel: id }, hidden: false }));
  const scene = new EventTarget();
  scene.dataset = {};
  const listeners = new Map();
  const host = {
    querySelectorAll: selector => selector === '[data-mkt-step]' ? buttons : panels,
    querySelector: () => scene,
    contains: button => buttons.includes(button),
    addEventListener: (key, callback) => listeners.set(key, callback),
  };
  const dispose = mountJourney({ querySelector: () => host });
  const emitTouch = (type, points, id = 10) => {
    const touch = points.map(([x, y], index) => ({ identifier: id + index, clientX: x, clientY: y }));
    const event = new Event(type);
    Object.defineProperty(event, type === 'touchstart' ? 'touches' : 'changedTouches', { value: touch });
    scene.dispatchEvent(event);
  };
  assert.equal(scene.dataset.stage, 'create');
  assert.deepEqual(buttons.map(b => b.attrs.tabindex), ['0', '-1', '-1', '-1', '-1']);
  emitTouch('touchstart', [[200, 90]]);
  emitTouch('touchend', [[110, 94]]);
  assert.equal(scene.dataset.stage, 'share');
  assert.equal(buttons[1].scrolled, true);
  assert.deepEqual(buttons.map(b => b.attrs.tabindex), ['-1', '0', '-1', '-1', '-1']);
  emitTouch('touchstart', [[200, 90]]);
  emitTouch('touchend', [[80, 250]]);
  assert.equal(scene.dataset.stage, 'share', 'cuộn dọc không đổi cảnh');
  emitTouch('touchstart', [[200, 90], [220, 90]]);
  emitTouch('touchend', [[110, 92]]);
  assert.equal(scene.dataset.stage, 'share', 'đa chạm không đổi cảnh');
  listeners.get('click')({ target: { closest: () => buttons[4] } });
  emitTouch('touchstart', [[220, 100]]);
  emitTouch('touchend', [[100, 100]]);
  assert.equal(scene.dataset.stage, 'keep', 'không tự quay về đầu khi vuốt ở cuối');
  emitTouch('touchstart', [[200, 95]]);
  scene.dispatchEvent(new Event('touchcancel'));
  emitTouch('touchend', [[100, 95]]);
  assert.equal(scene.dataset.stage, 'keep', 'touchcancel không kích hoạt');
  dispose();
  emitTouch('touchstart', [[100, 100]]);
  emitTouch('touchend', [[220, 100]]);
  assert.equal(scene.dataset.stage, 'keep', 'không cập nhật sau dispose');
});

test('Ngôn ngữ và CSS mobile có hướng dẫn vuốt và thanh điều hướng dễ đọc', () => {
  const vi = JSON.parse(source('../../web/assets/locales/vi.json'));
  const en = JSON.parse(source('../../web/assets/locales/en.json'));
  const css = source('../../web/css/marketing-journey.css');
  const page = source('../../web/js/pages/home.js');
  assert.notEqual(vi['home.journey.swipeHint'], en['home.journey.swipeHint']);
  assert.match(page, /home\.journey\.swipeHint/);
  assert.match(css, /grid-auto-columns: minmax\(112px, 1fr\)/);
  assert.match(css, /font-size: 13px/);
  assert.match(css, /touch-action: pan-y/);
  assert.match(css, /scroll-snap-type: x proximity/);
  assert.deepEqual(css.split('\n').filter(line => /;\s*[\w-]+\s*:/.test(line)), []);
});
