import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecoveryExport, recoveryOverview } from '../../web/js/features/canvas-editor/recovery-center.js';

function session(status = 'clean', overrides = {}) {
  return {
    status, revision: 12, lastSavedAt: 1700000000000,
    recoveryPersisted: false, dirty: false,
    readRecovery: () => null, ...overrides,
  };
}

test('Clean state never claims browser backup or unsaved work', () => {
  const result = recoveryOverview(session());
  assert.equal(result.status, 'clean');
  assert.equal(result.hasUnsaved, false);
  assert.equal(result.hasRecovery, false);
  assert.equal(result.revision, 12);
  assert.equal(result.canCompare, false);
});

test('Dirty/offline/error status invites retry but never claims server save', () => {
  for (const status of ['dirty', 'offline', 'error']) {
    const result = recoveryOverview(session(status));
    assert.equal(result.hasUnsaved, true);
    assert.equal(result.canRetry, true);
  }
});

test('Conflict has server comparison but no optimistic retry', () => {
  const result = recoveryOverview(session('conflict', { dirty: true }));
  assert.equal(result.canRetry, false);
  assert.equal(result.canCompare, true);
  assert.equal(result.tone, 'danger');
});

test('A valid recovery timestamp is exposed without reading its content', () => {
  const cached = { savedAt: 1690000000000, value: { title: 'bí mật' } };
  const result = recoveryOverview(session('offline', { readRecovery: () => cached }));
  assert.equal(result.hasRecovery, true);
  assert.equal(result.recoverySavedAt, 1690000000000);
  assert.equal(JSON.stringify(result).includes('bí mật'), false);
});

test('Storage unavailable is shown as no backup instead of crashing', () => {
  const result = recoveryOverview(session('dirty', { readRecovery: () => { throw Error('SecurityError'); } }));
  assert.equal(result.hasRecovery, false);
});

test('Failed session injection and invalid revisions are handled conservatively', () => {
  assert.throws(() => recoveryOverview(null), /Thiếu phiên/);
  assert.equal(recoveryOverview(session('saving', { revision: Number.NaN })).revision, null);
  assert.equal(recoveryOverview(session('session-expired')).canRetry, false);
});

test('JSON export is explicitly scoped to title/document and contains no pending tokens', () => {
  const draft = {
    title: 'Một lời chúc', document: { scenes: [{ id: 'a' }], privateNote: '<script>hi</script>' },
    pending: { mutationId: 'do-not-export' }, token: 'secret', userId: 'private',
  };
  const { json, filename } = makeRecoveryExport({
    designId: 'draft-31', revision: 7, draft, now: new Date('2026-11-20T00:00:00.000Z'),
  });
  const result = JSON.parse(json);
  assert.equal(filename, 'momevia-ban-nhap-2026-11-20.json');
  assert.equal(result.version, 1);
  assert.equal(result.revision, 7);
  assert.equal(result.title, draft.title);
  assert.deepEqual(result.document, draft.document);
  assert.deepEqual(Object.keys(result), ['format', 'version', 'notice', 'exportedAt', 'designId', 'revision', 'title', 'document']);
  for (const sensitive of ['do-not-export', '"token"', '"userId"']) assert.equal(json.includes(sensitive), false);
});

test('Refuse malformed export to avoid accidental secret dump', () => {
  const valid = { title: 'OK', document: { scenes: [] } };
  assert.throws(() => makeRecoveryExport({ designId: '../password', draft: valid }), /Mã thiết kế/);
  assert.throws(() => makeRecoveryExport({ designId: 'abc', draft: { title: 'Hi' } }), /Nội dung/);
  assert.throws(() => makeRecoveryExport({ designId: 'abc', draft: valid, now: new Date(NaN) }), /Ngày xuất/);
  assert.throws(() => makeRecoveryExport({ designId: 'abc', draft: { title: 'x', document: { body: 'x'.repeat(8 * 1024 * 1024) } } }), /8 MB/);
});
