import { message, t } from '../../core/i18n.js';
import { node, field } from './dom.js';
import { RECIPIENT_MODES } from '../../shared/recipient-naming.js';

export function mountRecipientOptions(host, { store, commit, policy, signal }) {
  const locked = policy?.kind === 'creator-template' && !policy.editableBindings.includes('recipientName');
  const group = node('fieldset', { class: 'recipient-options' }, node('legend', {}, message('recipient.title')));
  const choices = node('div', { class: 'recipient-mode-choices' });
  for (const mode of RECIPIENT_MODES) {
    const radio = node('input', { type: 'radio', name: 'recipient-mode', value: mode, disabled: locked && mode !== 'manual' });
    choices.append(node('label', {}, radio, node('span', {}, message(`recipient.mode.${mode}`))));
    radio.addEventListener('change', () => commit(next => {
      next.document.personalization = { ...(next.document.personalization || { version: 1 }), mode };
    }, t('recipient.title')), { signal });
  }
  group.append(choices, node('p', { class: 'editor-help' }, message('recipient.variableHint', { nameToken: '{người nhận}' })));
  if (locked) group.append(node('p', { class: 'editor-help' }, message('recipient.locked')));
  const upload = node('input', { type: 'file', accept: '.xlsx,.csv', 'data-recipient-file': '' });
  const status = node('p', { role: 'status', 'aria-live': 'polite', class: 'recipient-import-status' });
  const table = node('div', { class: 'recipient-list-preview' });
  const confirm = node('button', { type: 'button', class: 'btn btn--outline', hidden: true }, message('recipient.confirmList'));
  const template = node('a', { href: '/assets/recipient-template.csv', download: 'momevia-nguoi-nhan.csv' }, message('recipient.template'));
  const list = node('div', {}, node('p', { class: 'editor-help' }, message('recipient.fileHint')), template, field(message('recipient.file'), upload), status, table, confirm);
  const self = node('p', { class: 'editor-help' }, message('recipient.selfHint'));
  group.append(list, self);
  host.append(group);
  let preview = null, generation = 0;
  upload.addEventListener('change', async () => {
    const current = ++generation;
    confirm.hidden = true; table.replaceChildren(); preview = null;
    commit(next => { next.document.personalization = { version: 1, mode: 'list', names: [] }; }, t('recipient.file'));
    status.textContent = t('recipient.reading');
    try {
      const { readRecipientFile } = await import('../gifts/recipient-import.js');
      const result = await readRecipientFile(upload.files[0]);
      if (signal.aborted || current !== generation) return;
      preview = result;
      status.textContent = t('recipient.previewCount', { count: result.names.length, errors: result.errors.length });
      const lines = result.names.slice(0, 8).map(item => node('p', {}, `${item.row}. ${item.name}`));
      table.replaceChildren(...lines, ...result.errors.slice(0, 20).map(error => node('p', { class: 'recipient-field-error' }, t('recipient.rowError', { row: error.row, error: t(error.key) }))));
      confirm.hidden = result.errors.length > 0 || !result.names.length;
    } catch (error) { if (current === generation) status.textContent = t(error.message.startsWith('recipient.') ? error.message : 'recipient.error.file'); }
  }, { signal });
  confirm.addEventListener('click', () => {
    if (!preview || preview.errors.length) return;
    commit(next => { next.document.personalization = { version: 1, mode: 'list', names: preview.names }; }, t('recipient.confirmList'));
    confirm.hidden = true;
  }, { signal });
  function sync() {
    const settings = store.get().document.personalization || { mode: 'manual' };
    for (const radio of choices.querySelectorAll('input')) radio.checked = radio.value === settings.mode;
    list.hidden = settings.mode !== 'list'; self.hidden = settings.mode !== 'self';
    const recipient = host.querySelector('[data-editor-field="binding.recipientName"]');
    if (recipient) recipient.closest('label').hidden = settings.mode !== 'manual';
    if (settings.names?.length && settings.mode === 'list') {
      status.textContent = t('recipient.listSaved', { count: settings.names.length });
      table.replaceChildren(...settings.names.slice(0, 8).map(item => node('p', {}, `${item.row}. ${item.name}`)));
    }
  }
  // Place the group before the required-name control.
  host.prepend(group); sync();
  return { sync };
}
