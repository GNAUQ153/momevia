import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecoveryEnvelope } from '../../web/js/features/canvas-editor/recovery-guards.js';
import { createEditorStore } from '../../web/js/features/canvas-editor/store.js';
import { createSaveSession } from '../../web/js/features/canvas-editor/session.js';

const design = { id: 'draft-one', revision: 2, documentHash: 'sha256:v2', title: 'Thiệp', document: { schemaVersion: 1, text: 'Chúc mừng' } };
const context = { userId: 'A', designId: 'draft-one' };
const recovery = () => ({ ownerId: 'A', designId: 'draft-one', revision: 2, schemaVersion: 1,
  value: { title: 'Thiệp', document: { schemaVersion: 1, text: 'Sửa' } }, pending: null });

test('không nhận phục hồi chéo chủ sở hữu, thiết kế hoặc phiên bản schema', () => {
  assert.equal(isRecoveryEnvelope(recovery(), context), true);
  assert.equal(isRecoveryEnvelope({ ...recovery(), ownerId: 'B' }, context), false);
  assert.equal(isRecoveryEnvelope({ ...recovery(), designId: 'other' }, context), false);
  assert.equal(isRecoveryEnvelope({ ...recovery(), schemaVersion: 2 }, context), false);
  assert.equal(isRecoveryEnvelope(null, context), false);
  assert.equal(isRecoveryEnvelope({ ...recovery(), value: {} }, context), false);
  assert.equal(isRecoveryEnvelope({ ...recovery(), revision: NaN }, context), false);
});

test('pending replay cần mutationId và expectedRevision khớp envelope', () => {
  const pending = { expectedRevision: 2, mutationId: 'id-abc', title: 'Thiệp', document: { schemaVersion: 1 } };
  assert.equal(isRecoveryEnvelope({ ...recovery(), pending }, context), true);
  assert.equal(isRecoveryEnvelope({ ...recovery(), pending: { ...pending, expectedRevision: 1 } }, context), false);
  assert.equal(isRecoveryEnvelope({ ...recovery(), pending: { ...pending, mutationId: '' } }, context), false);
  assert.equal(isRecoveryEnvelope({ ...recovery(), pending: { ...pending, document: null } }, context), false);
});

test('restore không sửa Store nếu envelope không hợp lệ', () => {
  const store = createEditorStore(design);
  const session = createSaveSession({ design, store, userId: 'A', storage: null,
    request: async () => { throw new Error('Không được gọi API'); }, debounceMs: 100000 });
  const before = structuredClone(store.get());
  assert.throws(() => session.restore({ ...recovery(), schemaVersion: 99 }), /không hợp lệ/);
  assert.deepEqual(store.get(), before);
  assert.equal(session.status, 'clean');
  session.dispose();
});

test('lịch sử Undo/Redo được đặt lại khi nhận bản authoritative không ghi history', () => {
  const store = createEditorStore(design);
  store.update(value => { value.title = 'Sửa A'; });
  store.update(value => { value.title = 'Sửa B'; });
  store.undo();
  assert.equal(store.canRedo, true);
  store.replace({ title: 'Bản máy chủ', document: structuredClone(design.document) }, 'Đồng bộ', { record: false });
  assert.equal(store.canUndo, false);
  assert.equal(store.canRedo, false);
  assert.equal(store.undo(), false);
  store.update(value => { value.title = 'Sửa tiếp'; });
  assert.equal(store.undo(), true);
  assert.equal(store.get().title, 'Bản máy chủ');
});
