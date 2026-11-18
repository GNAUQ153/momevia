import { mountPlayer } from '../gift-runtime/index.js';
import { templatePreviewDocument } from '../../shared/canvas/index.js';

export function mountTemplatePreview(host, template, { api, onError } = {}) {
  const trigger = host.querySelector('[data-template-preview]'), dialog = host.querySelector('.template-preview-dialog');
  if (!trigger || !dialog) return { dispose() {} };
  const lifecycle = new AbortController(); let player = null;
  const close = () => { player?.dispose(); player = null; if (trigger.isConnected) trigger.focus(); };
  trigger.addEventListener('click', async () => {
    if (dialog.open || trigger.disabled) return;
    trigger.disabled = true;
    try {
      const endpoint = `/catalog/templates/${encodeURIComponent(template.id)}/versions/${encodeURIComponent(template.versionId)}`;
      const version = template.versionId ? (await api.get(endpoint, { signal: lifecycle.signal })).version : null;
      if (lifecycle.signal.aborted) return;
      player = mountPlayer(dialog.querySelector('.template-preview-player'), {
        document: version?.document || templatePreviewDocument(template), mode: 'preview',
        assetUrl: id => `/api${endpoint}/assets/${encodeURIComponent(id)}`,
      });
      dialog.showModal(); dialog.querySelector('[data-template-close]').focus();
    } catch (error) {
      if (!lifecycle.signal.aborted) onError?.(error);
    } finally { trigger.disabled = false; }
  }, { signal: lifecycle.signal });
  dialog.querySelector('[data-template-close]').addEventListener('click', () => dialog.close(), { signal: lifecycle.signal });
  dialog.querySelector('[data-template-reset]').addEventListener('click', () => player?.reset(), { signal: lifecycle.signal });
  dialog.addEventListener('close', close, { signal: lifecycle.signal });
  dialog.addEventListener('submit', event => event.stopPropagation(), { signal: lifecycle.signal });
  // Chỉ mở nút khi trình phát đã sẵn sàng, tránh click rơi vào khoảng tải module.
  trigger.disabled = false;
  return { dispose() { lifecycle.abort(); player?.dispose(); player = null; if (dialog.open) dialog.close(); } };
}
