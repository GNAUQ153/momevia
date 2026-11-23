import { RESTYLE_PAIRS } from '../../shared/canvas/template-slots.js';
import {ensureFullStyles} from '../../core/client-styles.js';
import { attr, createLocaleControl, message, onLocaleChange, setAttr, text, t } from '../../core/i18n.js';
import { isSystemTemplate } from '../../shared/template-copy.js';
import { templateField, templateValue } from './template-copy.js';
import { eventMediaUrl } from '../../shared/canvas/event-media.js';
import { templateCreateUrl } from './template-create-url.js';

export function templatePreviewDialog(template) {
  return `<dialog class="template-preview-dialog" ${attr('aria-label', 'catalog.detail.previewLabel', { title: templateValue(template, 'title') })}>
    <div class="template-preview-toolbar"><h2>${templateField(template, 'title')}</h2><button class="btn btn--outline" type="button" data-template-reset hidden>${text('catalog.detail.replay')}</button><a class="btn btn--dark template-preview-use" href="${templateCreateUrl(template)}" data-template-use data-link>${text('catalog.detail.use')}</a><button class="btn btn--outline" type="button" data-template-close>${text('common.actions.close')}</button></div>
    <p class="template-preview-note">${text('catalog.detail.previewNote')}</p>
    <p role="status" data-template-loading hidden>${text('catalog.detail.previewLoading')}</p>
    <div data-template-error hidden><p role="alert">${text('catalog.detail.previewError')}</p><button class="btn btn--outline" type="button" data-template-retry>${text('common.actions.retry')}</button></div>
    <div class="template-preview-player"></div>
  </dialog>`;
}

export function mountTemplatePreview(host, template, { api, onOpen, autoOpen = false, getTemplate = () => template }) {
  if (RESTYLE_PAIRS[template.id]) {
    const button=document.createElement('button');button.className='btn btn--outline';button.textContent=t('restyle.trial');
    host.querySelector('.detail-start-actions')?.append(button);
    button.addEventListener('click',async()=>{const [{openTemplateTrial}]=await Promise.all([import('./template-trial.js'),ensureFullStyles()]);await openTemplateTrial({templateId:template.id,request:(url,body)=>body?api.post(url,body):api.get(url),navigate:path=>{location.href=path;}});});
  }
  const dialog = host.querySelector('.template-preview-dialog');
  const close = dialog.querySelector('[data-template-close]');
  const useTemplate = dialog.querySelector('[data-template-use]');
  const reset = dialog.querySelector('[data-template-reset]');
  const note = dialog.querySelector('.template-preview-note');
  const loading = dialog.querySelector('[data-template-loading]');
  const errorPanel = dialog.querySelector('[data-template-error]');
  const retry = dialog.querySelector('[data-template-retry]');
  const playerHost = dialog.querySelector('.template-preview-player');
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  let opener, attempt, player, localizedPreview;
  let activeTemplate = template;
  const removeLocaleListener = onLocaleChange(() => {
    if (dialog.open && player && localizedPreview) player.updatePreviewCopy(localizedPreview(activeTemplate, t));
  });
  dialog.querySelector('.template-preview-toolbar').prepend(createLocaleControl());

  function clear() {
    attempt?.abort();
    player?.dispose();
    player = null;
    localizedPreview = null;
    playerHost.replaceChildren();
  }

  async function load() {
    clear();
    const template = activeTemplate;
    const endpoint = template.versionId && `/catalog/templates/${encodeURIComponent(template.id)}/versions/${encodeURIComponent(template.versionId)}`;
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
          : api.get(`/designs/library/templates/${encodeURIComponent(template.id)}/preview`,{signal}),
        ensureFullStyles(),
      ]);
      if (signal.aborted || !dialog.open) return;
      const previewCopy=()=>structuredClone(source.documents[document.documentElement.lang==='en'?'en':'vi']);
      localizedPreview = !endpoint&&isSystemTemplate(template) ? previewCopy : null;
      player = mountPlayer(playerHost, {
        document: endpoint ? source : previewCopy(),
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
      activeTemplate = getTemplate();
      // Hero tự đổi mẫu: CTA phải trỏ đến mẫu đang mở, không phải mẫu mặc định.
      useTemplate.setAttribute('href', templateCreateUrl(activeTemplate));
      dialog.querySelector('.template-preview-toolbar h2').innerHTML = templateField(activeTemplate, 'title');
      setAttr(dialog, 'aria-label', message('catalog.detail.previewLabel', { title: templateValue(activeTemplate, 'title') }));
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
  if (autoOpen) queueMicrotask(() => { if (!lifecycle.signal.aborted) host.querySelector('[data-template-preview]')?.click(); });
  return { dispose() { removeLocaleListener(); lifecycle.abort(); clear(); if (dialog.open) dialog.close(); } };
}
