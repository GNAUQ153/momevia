import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveSession } from '../../web/js/features/canvas-editor/session.js';
import { createEditorStore } from '../../web/js/features/canvas-editor/store.js';
import { describeSaveFeedback } from '../../web/js/features/canvas-editor/save-feedback.js';

const design = () => ({
  id: 'draft-1', title: 'Một món quà', revision: 1, documentHash: 'sha256:before',
  document: { schemaVersion: 1, text: 'Thông tin riêng' },
});
function cache(blocked = false) {
  const map = new Map();
  return {
    getItem(key) { if (blocked) throw Error('denied'); return map.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error('denied'); map.set(key, value); },
    removeItem(key) { if (blocked) throw Error('denied'); map.delete(key); },
  };
}
function sessionFor({ online = () => true, request, recoveryStorage = cache(), debounceMs = 10 } = {}) {
  const initial = design();
  const store = createEditorStore(initial);
  const reports = [];
  const session = createSaveSession({
    design: initial, store, userId: 'u-1', storage: cache(), recoveryStorage,
    isOnline: online, debounceMs, makeId: () => 'mutation-one',
    tabEventTarget: null, onStatus: report => reports.push(report),
    request: request || (async (url, body) => ({
      mutationId: body.mutationId, savedRevision: body.expectedRevision + 1,
      documentHash: 'sha256:saved',
    })),
  });
  return { store, session, reports };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Offline autosave does not issue request, preserves copy, explicit retry after reconnect', async () => {
  let online = false;
  let calls = 0;
  const { store, session, reports } = sessionFor({ online: () => online, request: async (url, body) => {
    calls++;
    return { mutationId: body.mutationId, savedRevision: body.expectedRevision + 1, documentHash: 'sha256:ack' };
  } });
  store.update(value => { value.document.text = 'Bản chưa đồng bộ'; });
  await sleep(35);
  assert.equal(calls, 0);
  assert.equal(session.status, 'offline');
  assert.equal(session.recoveryPersisted, true);
  assert.equal(reports.at(-1).recoveryPersisted, true);
  assert.ok(session.readRecovery());
  online = true;
  await session.save();
  assert.equal(calls, 1);
  assert.equal(session.status, 'clean');
  assert.equal(session.recoveryPersisted, false);
  assert.ok(Number.isFinite(session.lastSavedAt));
  assert.equal(session.readRecovery(), null);
  session.dispose();
});

test('Network failure never repeatedly autosaves while typing, and explicit retry retains idempotent pending payload', async () => {
  const calls = [];
  let fail = true;
  const { store, session } = sessionFor({ request: async (url, body) => {
    calls.push(structuredClone(body));
    if (fail) throw Object.assign(Error('Network down'), { status: 0 });
    return { mutationId: body.mutationId, savedRevision: body.expectedRevision + 1, documentHash: 'sha256:ack' };
  } });
  store.update(value => { value.document.text = 'Bản đầu'; });
  await assert.rejects(session.save(), /Network down/);
  assert.equal(session.status, 'offline');
  store.update(value => { value.document.text = 'Bản tiếp theo'; });
  await sleep(40);
  assert.equal(calls.length, 1, 'No uncontrolled repeated autosave during failure');
  assert.equal(session.status, 'offline');
  fail = false;
  await session.save();
  assert.equal(calls.length, 3, 'First replay exact pending; then save fresh edits');
  assert.deepEqual(calls[1], calls[0]);
  assert.notEqual(calls[2].document.text, calls[0].document.text);
  session.dispose();
});

test('Blocked local storage does not falsely claim an offline backup exists', async () => {
  const { store, session, reports } = sessionFor({
    online: () => false, recoveryStorage: cache(true),
  });
  store.update(value => { value.document.text = 'Riêng tư'; });
  assert.equal(session.recoveryPersisted, false);
  assert.equal(reports.at(-1).recoveryPersisted, false);
  assert.match(describeSaveFeedback(reports.at(-1)).detail, /Tránh đóng tab/);
  session.dispose();
});

test('Vietnamese UI distinguishes confirmed server ACK from unsynced local work', () => {
  const saved = describeSaveFeedback({ status: 'clean', revision: 12, lastSavedAt: Date.UTC(2026, 10, 20) });
  assert.match(saved.label, /Đã lưu trên máy chủ.*r12/);
  assert.match(saved.detail, /Lần lưu được xác nhận/);
  for (const status of ['offline', 'error', 'conflict', 'session-expired']) {
    const pending = describeSaveFeedback({ status, recoveryPersisted: true });
    assert.match(pending.detail, /bản nháp tạm/);
    assert.doesNotMatch(pending.label, /Đã lưu trên máy chủ/);
  }
  assert.equal(describeSaveFeedback({ status: 'saving' }).tone, 'saving');
});
