import { mountPlayer } from '../gift-runtime/index.js';
import { templatePreviewDocument } from '../../shared/canvas/index.js';

export function mountTemplatePreview(host, template) {
  const trigger = host.querySelector('[data-template-preview]'), dialog = host.querySelector('.template-preview-dialog');
  if (!trigger || !dialog) return { dispose() {} };
  const lifecycle = new AbortController(); let player = null;
  const close = () => { player?.dispose(); player = null; if (trigger.isConnected) trigger.focus(); };
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    player = mountPlayer(dialog.querySelector('.template-preview-player'), { document: templatePreviewDocument(template), mode: 'preview' });
    dialog.showModal(); dialog.querySelector('[data-template-close]').focus();
  }, { signal: lifecycle.signal });
  dialog.querySelector('[data-template-close]').addEventListener('click', () => dialog.close(), { signal: lifecycle.signal });
  dialog.querySelector('[data-template-reset]').addEventListener('click', () => player?.reset(), { signal: lifecycle.signal });
  dialog.addEventListener('close', close, { signal: lifecycle.signal });
  dialog.addEventListener('submit', event => event.stopPropagation(), { signal: lifecycle.signal });
  return { dispose() { lifecycle.abort(); player?.dispose(); player = null; if (dialog.open) dialog.close(); } };
}
