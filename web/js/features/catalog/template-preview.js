import { attr, createLocaleControl, onLocaleChange, text, t } from '../../core/i18n.js';
import { isSystemTemplate } from '../../shared/template-copy.js';
import { templateField, templateValue } from './template-copy.js';
import { eventMediaUrl } from '../../shared/canvas/event-media.js';

export function templatePreviewDialog(template) {
  return `<dialog class="template-preview-dialog" ${attr('aria-label', 'catalog.detail.previewLabel', { title: templateValue(template, 'title') })}>
    <div class="template-preview-toolbar"><h2>${templateField(template, 'title')}</h2><button class="btn btn--outline" type="button" data-template-reset hidden>${text('catalog.detail.replay')}</button><button class="btn btn--dark" type="button" data-template-close>${text('common.actions.close')}</button></div>
    <p class="template-preview-note">${text('catalog.detail.previewNote')}</p>
    <p role="status" data-template-loading hidden>${text('catalog.detail.previewLoading')}</p>
    <div data-template-error hidden><p role="alert">${text('catalog.detail.previewError')}</p><button class="btn btn--outline" type="button" data-template-retry>${text('common.actions.retry')}</button></div>
    <div class="template-preview-player"></div>
  </dialog>`;
}

export function mountTemplatePreview(host, template, { api, onOpen }) {
  const dialog = host.querySelector('.template-preview-dialog');
  const close = dialog.querySelector('[data-template-close]');
  const reset = dialog.querySelector('[data-template-reset]');
  const note = dialog.querySelector('.template-preview-note');
  const loading = dialog.querySelector('[data-template-loading]');
  const errorPanel = dialog.querySelector('[data-template-error]');
  const retry = dialog.querySelector('[data-template-retry]');
  const playerHost = dialog.querySelector('.template-preview-player');
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  let opener, attempt, player, localizedPreview;
  const endpoint = template.versionId && `/catalog/templates/${encodeURIComponent(template.id)}/versions/${encodeURIComponent(template.versionId)}`;
  const removeLocaleListener = onLocaleChange(() => {
    if (dialog.open && player && localizedPreview) player.updatePreviewCopy(localizedPreview(template, t));
  });
  dialog.querySelector('.template-preview-toolbar').prepend(createLocaleControl());

  function clear() {
    attempt?.abort();
    player?.dispose();
    player = null;
    playerHost.replaceChildren();
  }

  async function load() {
    clear();
    const { signal } = attempt = new AbortController();
    loading.hidden = false;
    note.hidden = false;
    errorPanel.hidden = true;
    reset.hidden = true;
    playerHost.setAttribute('aria-busy', 'true');
    try {
      const [{ mountPlayer }, source] = await Promise.all([
        import('../gift-runtime/index.js'),
        endpoint
          ? api.get(endpoint, { signal }).then(({ version }) => version.document)
          : import('../../shared/canvas/presets.js'),
      ]);
      if (signal.aborted || !dialog.open) return;
      localizedPreview = isSystemTemplate(template) ? source.templatePreviewDocument : null;
      player = mountPlayer(playerHost, {
        document: endpoint ? source : source.templatePreviewDocument(template, isSystemTemplate(template) ? t : undefined),
        mode: 'preview',
        assetUrl: endpoint ? id => `/api${endpoint}/assets/${encodeURIComponent(id)}` : eventMediaUrl,
      });
      reset.hidden = false;
      note.hidden = true;
    } catch {
      if (signal.aborted || !dialog.open) return;
      errorPanel.hidden = false;
    } finally {
      if (!signal.aborted) {
        loading.hidden = true;
        playerHost.removeAttribute('aria-busy');
      }
    }
  }

  for (const trigger of host.querySelectorAll('[data-template-preview]')) {
    trigger.addEventListener('click', () => {
      if (dialog.open) return;
      opener = trigger;
      onOpen?.();
      dialog.showModal();
      close.focus();
      load();
    }, options);
  }
  close.addEventListener('click', () => dialog.close(), options);
  reset.addEventListener('click', () => player?.reset(), options);
  retry.addEventListener('click', () => { close.focus(); load(); }, options);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    clear();
    if (opener?.isConnected) opener.focus();
  }, options);
  dialog.addEventListener('submit', event => event.stopPropagation(), options);
  return { dispose() { removeLocaleListener(); lifecycle.abort(); clear(); if (dialog.open) dialog.close(); } };
}
