import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../../web/js/features/canvas-editor/store.js';
import { createSaveSession } from '../../web/js/features/canvas-editor/session.js';
import {
  createTabRevisionSync,
  readRevisionNotice,
  revisionNoticeKey,
} from '../../web/js/features/canvas-editor/tab-sync.js';

const initial = () => ({
  id: 'thiệp 1',
  title: 'Lời chúc riêng',
  revision: 1,
  documentHash: 'sha256:initial',
  document: { schemaVersion: 1, message: 'Nội dung riêng tư' },
});

function crossTabStorage() {
  const data = new Map();
  const listeners = new Set();
  const eventTarget = {
    addEventListener(type, callback) { if (type === 'storage') listeners.add(callback); },
    removeEventListener(type, callback) { if (type === 'storage') listeners.delete(callback); },
  };
  const storage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) {
      data.set(key, value);
      // Thử cả sự kiện vào tab hiện tại: actor phải tự lọc.
      for (const callback of [...listeners]) callback({ key, newValue: value, storageArea: storage });
    },
    removeItem(key) { data.delete(key); },
  };
  return { storage, eventTarget, data, listeners };
}

function privateRecoveryStorage() {
  const data = new Map();
  return {
    data,
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

const request = async (path, body) => ({
  mutationId: body.mutationId,
  savedRevision: body.expectedRevision + 1,
  documentHash: 'sha256:saved',
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function sessionFor(context, options = {}) {
  const design = initial();
  const store = createEditorStore(design);
  const statuses = [];
  const session = createSaveSession({
    design,
    store,
    userId: options.userId ?? 'owner-1',
    storage: context.storage,
    recoveryStorage: options.recoveryStorage ?? privateRecoveryStorage(),
    tabEventTarget: context.eventTarget,
    makeTabId: () => options.actor ?? 'actor-12345678',
    debounceMs: 60_000,
    request: options.request ?? request,
    onStatus(info) { statuses.push(info); },
  });
  return { session, store, statuses };
}

test('Chỉ đồng bộ revision; không đưa nội dung thiệp hoặc token vào thông báo giữa các tab', async () => {
  const context = crossTabStorage();
  const a = sessionFor(context, { actor: 'actor-aaaaaaaa' });
  const b = sessionFor(context, { actor: 'actor-bbbbbbbb' });
  b.store.update(value => { value.document.message = 'Chúc bạn mạnh khỏe'; });
  await b.session.save();
  const key = revisionNoticeKey('owner-1', 'thiệp 1');
  const raw = context.data.get(key);
  assert.equal(JSON.parse(raw).revision, 2);
  assert.equal(raw.includes('Chúc bạn'), false);
  assert.equal(raw.includes('Nội dung'), false);
  assert.equal(a.session.status, 'conflict');
  assert.equal(b.session.status, 'clean');
  assert.equal(a.session.readRecovery(), null, 'Tab sạch không tạo recovery cũ giả');
  await assert.rejects(a.session.save(), /Xung đột|tab khác/);
  a.session.dispose();
  b.session.dispose();
});

test('Tab có chỉnh sửa cục bộ giữ nguyên nội dung, không âm thầm ghi đè sau thông báo', async () => {
  const context = crossTabStorage();
  const recoveryA = privateRecoveryStorage();
  const recoveryB = privateRecoveryStorage();
  const a = sessionFor(context, { actor: 'actor-aaaaaaaa', recoveryStorage: recoveryA });
  const b = sessionFor(context, { actor: 'actor-bbbbbbbb', recoveryStorage: recoveryB });
  a.store.update(value => { value.document.message = 'Bản A chưa lưu'; });
  b.store.update(value => { value.document.message = 'Bản B đã lưu'; });
  await b.session.save();
  assert.equal(a.session.status, 'conflict');
  assert.equal(a.store.get().document.message, 'Bản A chưa lưu');
  assert.equal(a.session.readRecovery().value.document.message, 'Bản A chưa lưu');
  assert.equal(b.session.readRecovery(), null);
  assert.equal(JSON.stringify([...context.data.values()]).includes('Bản A chưa lưu'), false);
  await assert.rejects(a.session.save(), /tab khác|Xung đột/);
  a.session.dispose();
  b.session.dispose();
  // sessionStorage của tab A sống qua reload, không phụ thuộc tab B.
  const reopenedA = sessionFor(context, { actor: 'actor-aaaa-new', recoveryStorage: recoveryA });
  assert.equal(reopenedA.session.readRecovery().value.document.message, 'Bản A chưa lưu');
  reopenedA.session.dispose();
});

test('ACK đến trễ không được xóa thông báo xung đột có revision mới hơn', async () => {
  const context = crossTabStorage();
  const wait = deferred();
  const a = sessionFor(context, {
    actor: 'actor-aaaaaaaa',
    request: async (path, body) => { await wait.promise; return request(path, body); },
  });
  const b = sessionFor(context, { actor: 'actor-bbbbbbbb' });
  a.store.update(value => { value.document.message = 'Bản A đang ghi'; });
  const inFlight = a.session.save();
  b.store.update(value => { value.document.message = 'Bản B lưu'; });
  await b.session.save(); // revision 2
  const third = createTabRevisionSync({
    userId: 'owner-1', designId: 'thiệp 1', storage: context.storage,
    eventTarget: context.eventTarget, createId: () => 'actor-cccccccc',
  });
  third.announce(3);
  wait.resolve();
  await assert.rejects(inFlight, /tab khác/);
  assert.equal(a.session.status, 'conflict');
  assert.equal(a.session.readRecovery().pending.expectedRevision, 1);
  third.dispose();
  a.session.dispose();
  b.session.dispose();
});

test('Thông báo sai schema, tab tự gửi, khác owner hoặc revision cũ đều được bỏ qua', () => {
  const context = crossTabStorage();
  const received = [];
  const monitor = createTabRevisionSync({
    userId: 'owner-1', designId: 'design-1', storage: context.storage,
    eventTarget: context.eventTarget, createId: () => 'actor-aaaaaaaa',
    onRevision(value) { received.push(value); },
  });
  assert.equal(monitor.announce(2), true);
  assert.deepEqual(received, []);
  context.storage.setItem(revisionNoticeKey('owner-2', 'design-1'), JSON.stringify({
    version: 1, actor: 'actor-bbbbbbbb', revision: 3,
  }));
  context.storage.setItem(monitor.key, '{invalid');
  context.storage.setItem(monitor.key, JSON.stringify({ version: 1, actor: 'x', revision: 7 }));
  assert.deepEqual(received, []);
  assert.deepEqual(readRevisionNotice(JSON.stringify({ version: 1, actor: 'actor-bbbbbbbb', revision: 4 })), {
    actor: 'actor-bbbbbbbb', revision: 4,
  });
  context.storage.setItem(monitor.key, JSON.stringify({ version: 1, actor: 'actor-bbbbbbbb', revision: 2 }));
  assert.deepEqual(received, [2]);
  monitor.dispose();
  context.storage.setItem(monitor.key, JSON.stringify({ version: 1, actor: 'actor-bbbbbbbb', revision: 9 }));
  assert.deepEqual(received, [2]);
});

test('Storage bị chặn vẫn có thể lưu lên server; dispose tháo listener', async () => {
  const listeners = new Set();
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const eventTarget = {
    addEventListener(type, cb) { if (type === 'storage') listeners.add(cb); },
    removeEventListener(type, cb) { listeners.delete(cb); },
  };
  const a = sessionFor({ storage, eventTarget });
  a.store.update(value => { value.title = 'Có thể lưu'; });
  await a.session.save();
  assert.equal(a.session.status, 'clean');
  assert.equal(listeners.size, 1);
  a.session.dispose();
  assert.equal(listeners.size, 0);
});


test('Đọc nháp V1 cũ để cho phép phục hồi tường minh khi nâng cấp', () => {
  const context = crossTabStorage();
  const legacy = {
    designId: 'thiệp 1', ownerId: 'owner-1', revision: 1,
    schemaVersion: 1, pending: null,
    value: { title: 'Lời chúc', document: { schemaVersion: 1, message: 'Khôi phục V1' } },
  };
  context.storage.setItem('momevia:canvas:recovery:v1:owner-1:thiệp 1', JSON.stringify(legacy));
  const a = sessionFor(context);
  assert.equal(a.session.readRecovery().value.document.message, 'Khôi phục V1');
  a.session.clearRecovery();
  assert.equal(a.session.readRecovery(), null);
  a.session.dispose();
});
