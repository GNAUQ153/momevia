import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestFrameScheduler } from '../../web/js/features/marketing/latest-frame.js';
import { marketingPointerGeometry, mountMarketingMotion } from '../../web/js/features/marketing/scene-motion.js';

function createClock() {
  let nextId = 0;
  const scheduled = new Map();
  const canceled = [];
  return {
    scheduled,
    canceled,
    requestFrame: callback => { const id = ++nextId; scheduled.set(id, callback); return id; },
    cancelFrame: id => { canceled.push(id); scheduled.delete(id); },
    flush: () => { const tasks = [...scheduled.values()]; scheduled.clear(); tasks.forEach(task => task()); },
  };
}

test('Gom 100 sự kiện chuột thành đúng một frame và dùng vị trí mới nhất', () => {
  const clock = createClock();
  const rendered = [];
  const scheduler = createLatestFrameScheduler({ ...clock, render: point => rendered.push(point) });
  for (let x = 0; x < 100; x++) scheduler.enqueue({ clientX: x, clientY: 200 });
  assert.equal(clock.scheduled.size, 1);
  assert.deepEqual(rendered, []);
  clock.flush();
  assert.deepEqual(rendered, [{ clientX: 99, clientY: 200 }]);
  scheduler.enqueue({ clientX: 105, clientY: 100 });
  clock.flush();
  assert.deepEqual(rendered.at(-1), { clientX: 105, clientY: 100 });
});

test('Không xử lý tọa độ không hợp lệ hoặc đo layout trước animation frame', () => {
  const clock = createClock();
  let layoutReads = 0;
  const scheduler = createLatestFrameScheduler({ ...clock, render: point => {
    layoutReads++;
    assert.deepEqual(marketingPointerGeometry(point, { left: 0, top: 0, width: 200, height: 100 }), {
      tiltX: '0.00deg', tiltY: '0.00deg', glowX: '50.0%', glowY: '50.0%',
    });
  } });
  assert.equal(scheduler.enqueue({ clientX: Infinity, clientY: 20 }), false);
  assert.equal(scheduler.enqueue(null), false);
  for (let i = 0; i < 10; i++) scheduler.enqueue({ clientX: 100, clientY: 50 });
  assert.equal(layoutReads, 0);
  clock.flush();
  assert.equal(layoutReads, 1);
});

test('Rời vùng tương tác hủy tác vụ và ngăn callback đã bị hủy tác động UI', () => {
  const clock = createClock();
  const rendered = [];
  const scheduler = createLatestFrameScheduler({ ...clock, render: point => rendered.push(point) });
  scheduler.enqueue({ clientX: 20, clientY: 30 });
  const lateCallback = [...clock.scheduled.values()][0];
  scheduler.clear();
  assert.equal(clock.scheduled.size, 0);
  lateCallback();
  assert.deepEqual(rendered, []);
  scheduler.enqueue({ clientX: 40, clientY: 50 });
  clock.flush();
  assert.deepEqual(rendered, [{ clientX: 40, clientY: 50 }]);
});

test('Dispose chặn frame trễ và các sự kiện tiếp theo', () => {
  const clock = createClock();
  const rendered = [];
  const scheduler = createLatestFrameScheduler({ ...clock, render: point => rendered.push(point) });
  scheduler.enqueue({ clientX: 1, clientY: 2 });
  const lateCallback = [...clock.scheduled.values()][0];
  scheduler.dispose();
  lateCallback();
  assert.equal(scheduler.enqueue({ clientX: 3, clientY: 4 }), false);
  clock.flush();
  assert.deepEqual(rendered, []);
});

test('Module 3D hỗ trợ mounting không có DOM và giữ phép đo hình học cũ', () => {
  assert.equal(typeof mountMarketingMotion(null), 'function');
  assert.equal(marketingPointerGeometry({ clientX: 20, clientY: 30 }, {
    left: 0, top: 0, width: 0, height: 20,
  }), null);
});


test('Tích hợp DOM: 50 pointermove chỉ đo kích thước một lần trong RAF, rồi dọn khi ẩn tab', () => {
  const clock = createClock();
  const ownerDocument = new EventTarget();
  ownerDocument.hidden = false;
  const stage = new EventTarget();
  let reads = 0;
  const values = new Map();
  stage.ownerDocument = ownerDocument;
  stage.style = {
    setProperty: (name, value) => values.set(name, value),
    removeProperty: name => values.delete(name),
  };
  stage.getBoundingClientRect = () => {
    reads++;
    return { left: 0, top: 0, width: 400, height: 200 };
  };
  stage.setAttribute = () => {};
  stage.removeAttribute = () => {};
  const root = {
    querySelector: selector => selector === '[data-mkt-tilt]' ? stage : null,
    querySelectorAll: () => [],
    removeAttribute: () => {},
  };
  const media = new EventTarget();
  media.matches = false;
  const pointer = new EventTarget();
  pointer.matches = true;
  const previousWindow = globalThis.window;
  globalThis.window = {
    matchMedia: query => query.includes('reduced') ? media : pointer,
    requestAnimationFrame: clock.requestFrame,
    cancelAnimationFrame: clock.cancelFrame,
  };
  let dispose;
  try {
    dispose = mountMarketingMotion(root);
    for (let x = 0; x < 50; x++) {
      stage.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x * 2, clientY: 100, pointerType: 'mouse' }));
    }
    assert.equal(reads, 0, 'Không đọc kích thước DOM trong pointermove');
    assert.equal(clock.scheduled.size, 1, 'Chỉ một frame được lên lịch');
    clock.flush();
    assert.equal(reads, 1, 'Chỉ đo layout một lần trong frame');
    assert.equal(values.get('--mkt-glow-x'), '24.5%');
    stage.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 120, clientY: 100, pointerType: 'mouse' }));
    const late = [...clock.scheduled.values()][0];
    ownerDocument.hidden = true;
    ownerDocument.dispatchEvent(new Event('visibilitychange'));
    late();
    assert.equal(reads, 1, 'Frame bị hủy không đọc layout');
    assert.equal(values.size, 0, 'Tab ẩn xóa giá trị 3D đã gán');
  } finally {
    dispose?.();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
