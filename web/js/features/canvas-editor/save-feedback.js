import { canonicalText } from '../../shared/locale.js';

const tones = {
  clean: 'saved',
  dirty: 'pending',
  saving: 'saving',
  offline: 'warning',
  error: 'warning',
  conflict: 'danger',
  'session-expired': 'danger',
  'asset-pending': 'pending',
  publishing: 'saving',
};

export function describeSaveFeedback(
  { status, revision, recoveryPersisted = false, lastSavedAt = null } = {},
  localize = canonicalText,
) {
  const state = Object.hasOwn(tones, status) ? status : 'unknown';
  const hasRevision = Number.isSafeInteger(revision) && revision >= 0;
  const label = state === 'clean' && !hasRevision
    ? localize('editor.saveFeedback.saved')
    : localize(`editor.status.${state}`, state === 'clean' ? { revision } : undefined);
  let detail = '';
  if (state === 'clean') {
    detail = Number.isFinite(lastSavedAt) && lastSavedAt > 0
      ? localize('editor.saveFeedback.confirmedAt', {
        time: { format: 'date', value: lastSavedAt, options: { hour: '2-digit', minute: '2-digit' } },
      })
      : localize('editor.saveFeedback.serverCopy');
  } else if (['dirty', 'saving', 'offline', 'error', 'conflict', 'session-expired'].includes(state)) {
    detail = localize(recoveryPersisted ? 'editor.saveFeedback.localCopy' : 'editor.saveFeedback.noLocalCopy');
  }
  return { status: state, label, detail, tone: tones[state] ?? 'warning' };
}
