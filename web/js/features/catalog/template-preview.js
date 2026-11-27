import { RESTYLE_PAIRS } from '../../shared/canvas/restyle-pairs.js';
import {ensureFullStyles} from '../../core/client-styles.js';
import { attr, createLocaleControl, message, onLocaleChange, setAttr, text, t } from '../../core/i18n.js';
import { isSystemTemplate } from '../../shared/template-copy.js';
import { templateField, templateValue } from './template-copy.js';
import { templateCreateUrl } from './template-create-url.js';
import { templatePriceText, templatePriceTier } from './price.js';

export function templatePreviewDialog(template) {
  return `<dialog class="template-preview-dialog" data-preview-state="idle" ${attr('aria-label', 'catalog.detail.previewLabel', { title: templateValue(template, 'title') })}>
    <div class="template-preview-toolbar"><h2>${templateField(template, 'title')}</h2><div class="template-preview-actions"><button class="btn btn--outline" type="button" data-template-reset hidden>${text('catalog.detail.replay')}</button><a class="btn btn--dark template-preview-use" href="${templateCreateUrl(template)}" data-template-use data-link>${text('catalog.detail.use')}</a><button class="btn btn--outline" type="button" data-template-close>${text('common.actions.close')}</button></div></div>
    <div class="catalog-price-summary" data-template-preview-price data-price-tier="${templatePriceTier(template.price)}"><small>${text('catalog.price.label')}</small><strong>${templatePriceText(template.price)}</strong></div>
    <p class="catalog-price-note">${text('catalog.price.scope')}</p>
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
  const previewPrice = dialog.querySelector('[data-template-preview-price]');
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
  const toolbar = dialog.querySelector('.template-preview-toolbar');
  toolbar.querySelector('.template-preview-actions').prepend(createLocaleControl());
  // Locale, zoom and a visible Replay action can change the sticky toolbar's
  // height. Reserve its measured space when focusing content in the player.
  const syncScrollPadding = () => {
    if (dialog.open) dialog.style.scrollPaddingTop = `${Math.ceil(toolbar.getBoundingClientRect().height) + 12}px`;
  };
  const toolbarSize = globalThis.ResizeObserver ? new ResizeObserver(syncScrollPadding) : null;
  toolbarSize?.observe(toolbar);

  // Một nguồn trạng thái cho giao diện, không để trạng thái tải tồn tại sau khi đóng.
  function setPreviewState(state) {
    dialog.dataset.previewState = state;
    loading.hidden = state !== 'loading';
    errorPanel.hidden = state !== 'error';
    reset.hidden = state !== 'ready';
    if (state === 'loading') playerHost.setAttribute('aria-busy', 'true');
    else playerHost.removeAttribute('aria-busy');
  }

  function clear() {
    attempt?.abort();
    attempt = null;
    player?.dispose();
    player = null;
    localizedPreview = null;
    playerHost.replaceChildren();
    setPreviewState('idle');
  }

  async function load() {
    clear();
    const template = activeTemplate;
    const endpoint = template.versionId && `/catalog/templates/${encodeURIComponent(template.id)}/versions/${encodeURIComponent(template.versionId)}`;
    const { signal } = attempt = new AbortController();
    setPreviewState('loading');
    try {
      const [{ mountPlayer }, source, {eventMediaUrl}] = await Promise.all([
        import('../gift-runtime/index.js'),
        endpoint
          ? api.get(endpoint, { signal }).then(({ version }) => version.document)
          : api.get(`/designs/library/templates/${encodeURIComponent(template.id)}/preview`,{signal}),
        import('../../shared/canvas/event-media.js'),
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
      // Ghi chú mô phỏng luôn hiển thị, kể cả khi player đã sẵn sàng.
      setPreviewState('ready');
      syncScrollPadding();
    } catch {
      if (signal.aborted || !dialog.open) return;
      clear();
      setPreviewState('error');
      syncScrollPadding();
    }
  }

  for (const trigger of host.querySelectorAll('[data-template-preview]')) {
    trigger.addEventListener('click', () => {
      if (dialog.open) return;
      activeTemplate = getTemplate();
      // Hero tự đổi mẫu: CTA phải trỏ đến mẫu đang mở, không phải mẫu mặc định.
      useTemplate.setAttribute('href', templateCreateUrl(activeTemplate));
      // Cập nhật giá cùng mẫu đang mở, giữ marker bản dịch của i18n.
      previewPrice.dataset.priceTier = templatePriceTier(activeTemplate.price);
      previewPrice.querySelector('strong').innerHTML = templatePriceText(activeTemplate.price);
      dialog.querySelector('.template-preview-toolbar h2').innerHTML = templateField(activeTemplate, 'title');
      setAttr(dialog, 'aria-label', message('catalog.detail.previewLabel', { title: templateValue(activeTemplate, 'title') }));
      opener = trigger;
      onOpen?.();
      dialog.showModal();
      syncScrollPadding();
      dialog.scrollTop = 0;
      close.focus({ preventScroll: true });
      load();
    }, options);
  }
  close.addEventListener('click', () => dialog.close(), options);
  reset.addEventListener('click', () => player?.reset(), options);
  retry.addEventListener('click', () => {
    dialog.scrollTop = 0;
    close.focus({ preventScroll: true });
    load();
  }, options);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    clear();
    if (opener?.isConnected) opener.focus();
  }, options);
  dialog.addEventListener('submit', event => event.stopPropagation(), options);
  if (autoOpen) queueMicrotask(() => { if (!lifecycle.signal.aborted) host.querySelector('[data-template-preview]')?.click(); });
  return { dispose() { toolbarSize?.disconnect(); removeLocaleListener(); lifecycle.abort(); clear(); if (dialog.open) dialog.close(); } };
}
