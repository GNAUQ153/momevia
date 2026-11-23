import { t, message, currentLocale, onLocaleChange, setText } from '../../core/i18n.js';
import { node } from '../canvas-editor/dom.js';
import { mountPlayer } from '../gift-runtime/index.js';
import { eventMediaUrl } from '../../shared/canvas/event-media.js';
import { installLibrary } from '../../shared/canvas/library-state.js';
import { eventTimeFromLocal } from '../../shared/canvas/interactions.js';
import { libraryFields } from './fields.js';
import { preserveScroll, captureFieldFocus, restoreFieldFocus } from '../../ui/scroll-state.js';
import { mountMusicLibrary } from '../music-library/index.js';
import { categories, categoryFor, itemKey, itemTitle, fingerprint, makeItem, duplicateItem, animationDefaults,
  compatibleAnimation, getDocument, layers, setPath, metadata, editFrame, makeLayer, makeInteraction, removeScene, normalizeSelection, sameItemContent } from './model.js';

const button = (key, action, attrs = {}) => node('button', { type: 'button', class: 'btn btn--outline', 'data-library-action': action, ...attrs }, message(`adminLibrary.${key}`));
const localized = key => message(`adminLibrary.${key}`);
const copy = structuredClone;

export function mountAdminLibrary(host, { api, initialCategory = 'element' }) {
  const lifetime = new AbortController(), { signal } = lifetime;
  let rows = [], draft, base, original = '', category = 'element', contentLocale = currentLocale(), sceneIndex = 0, layerIndex = 0,
    query = '', stateFilter = 'all', saving = false, disposed = false, previewSequence = 0, previewTimer, previewAbort, player,
    latestPreview = null, latestSignature = '', inViewport = true, addType = 'text', loaded = false,
    listSignature = '', audioActive = false, audioController, canvasScroll = [];
  const title = node('h1', {}, localized('title'));
  const count = node('p', { class: 'library-admin__count', role: 'status' });
  const feedback = node('p', { class: 'library-admin__feedback', role: 'status', 'aria-live': 'polite', hidden: true });
  const conflict = node('div', { class: 'library-admin__conflict', role: 'alert', hidden: true }, node('p', {}, localized('conflict')),
    button('loadLatest', 'reload-latest'), button('copyChanges', 'duplicate-changes'));
  const search = node('input', { type: 'search', placeholder: t('adminLibrary.search'), 'aria-label': localized('search'), 'data-library-search': '' });
  const filter = node('select', { 'aria-label': localized('filterStatus'), 'data-library-filter': '' },
    ...['all','active','disabled'].map(id => node('option', { value: id }, localized(`filter.${id}`))));
  const list = node('ul', { class: 'library-admin__list', 'aria-label': localized('list'), 'data-library-list': '' });
  const heading = node('h2', { class: 'library-admin__editing-title' });
  const savedState = node('span', { class: 'library-admin__save-state', role: 'status', 'data-library-save-state': 'clean' });
  const fields = node('fieldset', { class: 'library-admin__form-body', 'data-library-fields': '' });
  const form = node('form', { class: 'library-admin__form', 'data-library-form': '' },
    node('div', { class: 'library-admin__editor-heading' }, heading, savedState), fields,
    node('div', { class: 'library-admin__save-bar' }, button('save', 'save', { type: 'submit', class: 'btn btn--dark', 'data-write': '' }),
      button('toggleOff', 'toggle', { 'data-write': '', 'data-library-toggle': '' }), button('discard', 'discard'), button('preview.play', 'play')));
  const previewHost = node('div', { class: 'library-admin__preview-stage', 'data-library-preview': '' });
  const previewStatus = node('p', { class: 'library-admin__help', role: 'status', 'data-library-preview-status': '' });
  const auto = node('input', { type: 'checkbox', checked: true, 'data-library-auto': '' });
  const previewFamily = node('select', { 'aria-label': localized('preview.family'), 'data-library-preview-family': '' },
    ...['entrance','emphasis','transition','reaction','ambience'].map(id => node('option', { value: id }, message(`editor.effects.family.${id}`))));
  const previewScenes = node('select', { 'aria-label': localized('preview.scene'), hidden: true, 'data-library-preview-scene': '' });
  const previewPanel = node('aside', { class: 'library-admin__preview', 'aria-label': localized('preview.title') },
    node('div', { class: 'library-admin__preview-heading' }, node('h2', {}, localized('preview.title')), button('preview.play', 'play')),
    node('p', { class: 'library-admin__help' }, localized('preview.note')),
    node('label', { class: 'library-admin__check' }, auto, node('span', {}, localized('preview.auto'))),
    previewFamily, previewScenes, previewStatus, previewHost,
    button('backToForm', 'back-form', { class: 'btn btn--outline library-admin__mobile-return' }));
  const tabs = node('div', { class: 'library-admin__tabs', role: 'tablist', 'aria-label': localized('categories') },
    ...[...categories, 'audio'].map(kind => button(`kind.${kind}`, 'category', { role: 'tab', id: `admin-library-tab-${kind}`, 'aria-controls': kind === 'audio' ? 'admin-library-audio' : 'admin-library-workspace', 'data-kind': kind, 'aria-selected': kind === category, class: 'library-admin__tab' })));
  const canvasPanel = node('div', { id: 'admin-library-workspace', role: 'tabpanel', 'aria-labelledby': 'admin-library-tab-element' },
    feedback, conflict, node('div', { class: 'library-admin__grid' }, node('aside', { class: 'library-admin__browser' }, search, filter, count, list), form, previewPanel));
  const audioPanel = node('div', { id: 'admin-library-audio', role: 'tabpanel', 'aria-labelledby': 'admin-library-tab-audio', hidden: true });
  const root = node('section', { class: 'section library-admin', 'data-admin-library': '' },
    node('div', { class: 'library-admin__container' },
      node('a', { href: '/admin', 'data-link': '', class: 'library-admin__back' }, localized('back')),
      node('header', { class: 'library-admin__header' }, node('div', {}, title, node('p', {}, localized('intro'))),
        node('div', { class: 'library-admin__header-actions' }, button('newItem', 'new', { class: 'btn btn--dark', 'data-write': '' }), button('duplicate', 'duplicate', { 'data-write': '' }), button('reload', 'reload'))),
      tabs, canvasPanel, audioPanel));
  host.replaceChildren(root);
  function dirty() { return Boolean(draft && (base?.revision === 0 || fingerprint(draft) !== original)); }
  function notify(key, type = 'info', params) { setText(feedback, localizedMessage(key, params)); feedback.hidden = false; feedback.dataset.tone = type; }
  function localizedMessage(key, params) { return message(`adminLibrary.${key}`, params); }
  function canDiscard() { return !saving && (!dirty() || window.confirm(t('adminLibrary.unsaved'))); }
  function mark() {
    if (!draft) {
      fields.disabled = true; form.hidden = true;
      for (const control of root.querySelectorAll('[data-write]')) control.disabled = saving || control.dataset.libraryAction !== 'new' || !loaded;
      player?.dispose(); player = null; latestPreview = null; latestSignature = '';
      previewHost.replaceChildren(node('div', { class: 'library-admin__preview-empty' }, localized('selectItem'))); return;
    }
    form.hidden = false;
    setText(heading, itemTitle(draft, rows, currentLocale()));
    savedState.dataset.librarySaveState = saving ? 'saving' : dirty() ? 'dirty' : 'clean';
    setText(savedState, localized(saving ? 'saving' : dirty() ? 'unsavedLabel' : 'savedLabel'));
    fields.disabled = saving;
    for (const control of root.querySelectorAll('[data-write]')) control.disabled = saving || !draft;
    const toggle = root.querySelector('[data-library-toggle]');
    setText(toggle, localized(draft.status === 'active' ? 'toggleOff' : 'toggleOn'));
    previewFamily.hidden = draft.kind !== 'animation' || draft.definition.engine !== 'keyframes';
  }
  function filtered() {
    const normalized = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('đ','d').toLowerCase();
    const words = normalized(query).trim().split(/\s+/);
    return rows.filter(row => categoryFor(row.kind) === category && (stateFilter === 'all' || row.status === stateFilter) &&
      words.every(word => normalized(`${itemTitle(row, rows, currentLocale())} ${row.id}`).includes(word)));
  }
  function updateTabs() {
    const active = audioActive ? 'audio' : category;
    canvasPanel.hidden = audioActive; audioPanel.hidden = !audioActive;
    canvasPanel.setAttribute('aria-labelledby', `admin-library-tab-${category}`);
    for (const tab of tabs.querySelectorAll('button')) {
      tab.setAttribute('aria-selected', String(tab.dataset.kind === active)); tab.tabIndex = tab.dataset.kind === active ? 0 : -1;
    }
    for (const control of root.querySelectorAll('.library-admin__header-actions [data-write]')) control.hidden = audioActive;
  }
  function setAudioActive(active) {
    const changed = audioActive !== active;
    if (changed && active) canvasScroll = [list, fields, previewHost].map(region => ({ region, top: region.scrollTop, left: region.scrollLeft }));
    if (changed && !active) audioController?.setActive(false);
    audioActive = active; updateTabs();
    if (active) {
      clearTimeout(previewTimer); previewAbort?.abort(); previewSequence++; previewHost.removeAttribute('aria-busy');
      if (!audioController) audioController = mountMusicLibrary(audioPanel, { api, embedded: true });
    }
    if (active) audioController?.setActive(true);
    else if (changed) {
      inViewport = true;
      if (latestPreview) showPreview(latestPreview); else schedulePreview(true);
      for (const { region, top, left } of canvasScroll) { region.scrollTop = top; region.scrollLeft = left; }
    }
  }
  function renderList() {
    const visible = filtered();
    updateTabs();
    setText(count, localizedMessage('count', { count: visible.length }));
    const signature = fingerprint([currentLocale(), visible.map(row => [itemKey(row), itemTitle(row, rows, currentLocale()), row.status, row.revision])]);
    if (signature !== listSignature) {
      const focused = list.contains(document.activeElement) ? document.activeElement.closest('[data-key]')?.dataset.key : null;
      preserveScroll(list, () => {
        list.replaceChildren(...visible.map(row => node('li', {}, node('button', { type: 'button', 'data-library-action': 'select', 'data-key': itemKey(row) },
          node('span', { class: 'library-admin__item-title' }, itemTitle(row, rows, currentLocale())),
          node('span', { class: `library-admin__badge ${row.status === 'disabled' ? 'is-off' : ''}` }, localized(`status.${row.status}`)),
          node('small', {}, message('adminLibrary.version', { revision: row.revision }))))));
        if (!visible.length) list.append(node('li', { class: 'library-admin__empty' }, localized('empty')));
        if (focused) list.querySelector(`[data-key="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
      });
      listSignature = signature;
    }
    for (const [index, control] of [...list.querySelectorAll('button')].entries()) {
      const selected = Boolean(draft && control.dataset.key === itemKey(draft));
      control.classList.toggle('is-selected', selected); control.setAttribute('aria-pressed', String(selected)); control.tabIndex = selected || !draft && index === 0 ? 0 : -1;
    }
  }
  function renderFields(reset = false) {
    if (!draft) { fields.replaceChildren(node('p', {}, localized('empty'))); mark(); return; }
    ({ sceneIndex, layerIndex } = normalizeSelection(draft, contentLocale, sceneIndex, layerIndex));
    const focus = fields.contains(document.activeElement) ? document.activeElement.dataset.field : null;
    const expanded = new Map([...fields.querySelectorAll('details[data-library-section]')].map(item => [item.dataset.librarySection, item.open]));
    preserveScroll(fields, () => {
      fields.replaceChildren(...libraryFields(draft, rows, { locale: contentLocale, sceneIndex, layerIndex, addType }));
      if (!reset) for (const item of fields.querySelectorAll('details[data-library-section]')) if (expanded.has(item.dataset.librarySection)) item.open = expanded.get(item.dataset.librarySection);
      if (focus && !reset) fields.querySelector(`[data-field="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
    });
    if (reset) fields.scrollTop = 0;
    mark();
  }
  function selectItem(row, force = false) {
    if (!force && !canDiscard()) return;
    const changed = !draft || itemKey(draft) !== itemKey(row);
    base = copy(row); draft = copy(row); original = fingerprint(draft); sceneIndex = layerIndex = 0;
    conflict.hidden = true; feedback.hidden = true; latestPreview = null; latestSignature = '';
    renderList(); renderFields(changed); if (!audioActive) schedulePreview(true);
  }
  function mutate(fn, structural = false) {
    if (!draft || saving) return;
    if (['preset','template'].includes(draft.kind)) getDocument(draft, contentLocale, true);
    fn(); mark(); conflict.hidden = true; feedback.hidden = true;
    if (structural) renderFields(); schedulePreview();
  }
  function showPreview(result) {
    if (disposed || !inViewport || audioActive) return;
    const effectPreview = result.preferredSceneId ? { ...result.effectPreview, sceneId: result.preferredSceneId } : result.effectPreview;
    preserveScroll(previewHost, () => {
      player?.dispose(); player = mountPlayer(previewHost, { document: result.document, mode: 'preview', assetUrl: eventMediaUrl, effectPreview });
    });
    if (result.playSceneId) requestAnimationFrame(() => { if (!disposed) player?.goToScene(result.playSceneId); });
    previewScenes.replaceChildren(...result.document.scenes.map(scene => node('option', { value: scene.id }, scene.name)));
    previewScenes.hidden = result.document.scenes.length < 2; previewScenes.value = result.preferredSceneId || result.document.entrySceneId;
  }
  async function preview() {
    if (!draft || disposed) return;
    clearTimeout(previewTimer); previewAbort?.abort(); const sequence = ++previewSequence;
    const snapshot = copy(draft), signature = fingerprint([snapshot, contentLocale, previewFamily.value, sceneIndex]);
    const requestedScene = getDocument(snapshot, contentLocale)?.scenes[sceneIndex]?.id;
    previewAbort = new AbortController();
    setText(previewStatus, localized('preview.loading')); previewHost.setAttribute('aria-busy', 'true');
    try {
      const result = await api.post(`/designs/admin/library/preview/${snapshot.kind}/${encodeURIComponent(snapshot.id)}`,
        { definition: snapshot.definition, sortOrder: snapshot.sortOrder, locale: contentLocale, previewFamily: previewFamily.value },
        { signal: AbortSignal.any([signal, previewAbort.signal]) });
      if (disposed || sequence !== previewSequence) return;
      if (requestedScene && result.document.scenes.some(s => s.id === requestedScene)) result.preferredSceneId = requestedScene;
      latestPreview = result; latestSignature = signature; showPreview(result); setText(previewStatus, localized('preview.ready'));
    } catch (error) {
      if (disposed || error.name === 'AbortError' || sequence !== previewSequence) return;
      latestPreview = null; latestSignature = ''; player?.dispose(); player = null;
      previewHost.replaceChildren(node('div', { class: 'library-admin__preview-empty' }, localized('preview.invalid')));
      setText(previewStatus, errorMessage(error));
    } finally { if (sequence === previewSequence && !disposed) previewHost.removeAttribute('aria-busy'); }
  }
  function schedulePreview(immediate = false) {
    clearTimeout(previewTimer); previewAbort?.abort(); previewSequence++;
    if (immediate || auto.checked) {
      setText(previewStatus, localized('preview.loading')); previewHost.setAttribute('aria-busy', 'true');
      previewTimer = setTimeout(preview, immediate ? 0 : 450);
    } else { previewHost.removeAttribute('aria-busy'); setText(previewStatus, localized('preview.stale')); }
  }
  function errorMessage(error) {
    return localized(error.status === 401 ? 'sessionExpired' : error.status === 403 ? 'forbidden' :
      /disabled|Missing animation/i.test(error.message) ? 'dependencyError' : /target|incompatib/i.test(error.message) ? 'targetError' :
        error.status === 0 ? 'networkError' : 'invalid');
  }
  async function load(preserve = false) {
    if (preserve && !canDiscard()) return;
    try {
      root.setAttribute('aria-busy', 'true');
      const payload = await api.get('/designs/admin/library', { signal });
      if (disposed) return;
      rows = payload.library.items; loaded = true; installLibrary(payload.library);
      const chosen = draft && rows.find(r => itemKey(r) === itemKey(draft));
      const first = rows.find(r => categoryFor(r.kind) === category);
      if (chosen || first) selectItem(chosen || first, true); else { draft = null; renderList(); renderFields(); }
    } catch (error) { if (!disposed && error.name !== 'AbortError') { setText(feedback, errorMessage(error)); feedback.hidden = false; feedback.dataset.tone = 'error'; } }
    finally { if (!disposed) root.removeAttribute('aria-busy'); }
  }
  async function save() {
    if (saving || !draft || !form.reportValidity()) return;
    if (base?.revision === 0 && rows.some(r => itemKey(r) === itemKey(draft))) { notify('duplicateId', 'error'); fields.querySelector('[data-path="id"]')?.focus(); return; }
    const desired = copy(draft), focus = captureFieldFocus(fields); saving = true; mark(); feedback.hidden = true; conflict.hidden = true;
    try {
      const payload = await api.post(`/designs/admin/library/${desired.kind}/${encodeURIComponent(desired.id)}`,
        { expectedRevision: base.revision, definition: desired.definition, status: desired.status, sortOrder: desired.sortOrder }, { signal });
      if (disposed) return;
      rows = payload.library.items; installLibrary(payload.library);
      const saved = rows.find(r => itemKey(r) === itemKey(desired));
      saving = false; selectItem(saved, true); notify('saved', 'success');
    } catch (error) {
      if (!disposed && error.name !== 'AbortError') {
        if (error.status === 409) {
          // A committed write can lose its acknowledgement. Reconcile against
          // the authoritative row; never resend a forced overwrite or erase a
          // genuinely different concurrent edit.
          try {
            const payload = await api.get('/designs/admin/library', { signal });
            if (disposed) return;
            const candidate = payload.library.items.find(row => itemKey(row) === itemKey(desired));
            if (candidate?.revision > base.revision && sameItemContent(candidate, desired)) {
              rows = payload.library.items; installLibrary(payload.library); saving = false;
              selectItem(candidate, true); notify('saved', 'success'); return;
            }
          } catch { /* Keep the local draft and the conflict state. */ }
          conflict.hidden = false; notify('conflict', 'error');
        }
        else { setText(feedback, errorMessage(error)); feedback.hidden = false; feedback.dataset.tone = 'error'; }
      }
    } finally {
      saving = false;
      if (!disposed) { mark(); if (document.activeElement === document.body) restoreFieldFocus(fields, focus); }
    }
  }
  function selectedLayer() { const list = layers(draft, contentLocale, sceneIndex); return list[layerIndex] || list[0]; }
  function changeField(target, structural) {
    if (!draft || saving) return;
    const operation = target.dataset.operation;
    if (['content-locale','scene-select','layer-select','add-type'].includes(operation)) {
      if (operation === 'content-locale') contentLocale = target.value;
      if (operation === 'scene-select') { sceneIndex = getDocument(draft, contentLocale).scenes.findIndex(s => s.id === target.value); layerIndex = 0; }
      if (operation === 'layer-select') layerIndex = layers(draft, contentLocale, sceneIndex).findIndex(e => e.id === target.value);
      if (operation === 'add-type') { addType = target.value; return; }
      renderFields(); if (['content-locale','scene-select'].includes(operation)) schedulePreview(true); return;
    }
    mutate(() => {
      const e = selectedLayer(), d = draft.definition, raw = target.value;
      if (target.dataset.meta) {
        metadata(draft, target.dataset.meta, target.dataset.metaLocale, raw); return;
      }
      if (target.dataset.frame !== undefined) { editFrame(d.keyframes[Number(target.dataset.frame)], target.dataset.frameField, raw); return; }
      if (target.dataset.toggle) {
        const path = target.dataset.toggle, list = path.split('.').reduce((v, k) => v?.[k], draft) || [];
        setPath(draft, path, target.checked ? [...new Set([...list, raw])] : list.filter(v => v !== raw)); return;
      }
      if (operation === 'engine') { draft.definition = { ...animationDefaults(raw), ...(d.title ? { title: d.title } : {}) }; return; }
      if (operation === 'family') {
        d.family = raw; d.defaults = raw === 'surface' ? {} : { speed: 'normal' };
        d.targets = { scenes: ['surface','transition','ambience'].includes(raw), types: raw === 'reaction' ? ['button'] : ['transition','ambience'].includes(raw) ? [] : ['text'] };
        const reference = rows.find(row => row.kind === 'effect' && row.status === 'active' && row.definition.family === raw);
        if (reference) { d.animationId = reference.definition.animationId; d.targets = copy(reference.definition.targets); d.defaults = copy(reference.definition.defaults || {}); }
        else d.animationId = rows.find(row => row.kind === 'animation' && row.status === 'active' && compatibleAnimation(row, raw))?.id || '';
        return;
      }
      if (operation === 'glyphs') { d.glyphs = raw.trim().split(/\s+/).filter(Boolean); return; }
      if (operation === 'colors') { d.colors = raw.split(/[ ,]+/).filter(Boolean); return; }
      if (operation === 'opacity') { e.opacity = Number(raw) / 100; return; }
      if (operation === 'binding') { if (raw) { e.props.textBinding = raw; delete e.props.text; } else { delete e.props.textBinding; e.props.text = ''; } return; }
      if (operation === 'interaction') { const fresh = makeInteraction(raw); Object.assign(e, { props: fresh.props, accessibility: fresh.accessibility }); if (fresh.actions) e.actions = fresh.actions; else delete e.actions; delete e.effects; return; }
      if (operation === 'event-time') { e.props.eventAt = raw ? eventTimeFromLocal(raw, e.props.timeZone) : null; return; }
      if (operation === 'action-type') { e.actions[Number(target.dataset.actionIndex)] = { on: 'activate', type: raw, ...(raw === 'goToScene' ? { targetSceneId: null } : {}) }; return; }
      if (!target.dataset.path) return;
      const value = target.type === 'checkbox' ? target.checked : raw === '' && target.dataset.optional ? undefined : raw === '' && target.dataset.null ? null : target.type === 'number' || target.dataset.number ? Number(raw) : raw;
      setPath(draft, target.dataset.path, value);
      if (/\.props\.(kind|mask|pattern|stickerId)$/.test(target.dataset.path) && e) { delete e.artwork; delete e.props.maskPath; }
      if (/\.props\.(label|title)$/.test(target.dataset.path) && e) e.accessibility.label = raw;
    }, structural);
  }
  root.addEventListener('input', event => {
    const target = event.target;
    if (target === search) { query = search.value; renderList(); return; }
    if (fields.contains(target) && target.tagName !== 'SELECT') {
      try { changeField(target, target.type === 'checkbox' && Boolean(target.dataset.toggle)); }
      catch { mark(); notify('invalid', 'error'); schedulePreview(); }
    }
  }, { signal });
  root.addEventListener('change', event => {
    const target = event.target;
    if (target === filter) { stateFilter = filter.value; renderList(); return; }
    if (target === auto) { if (auto.checked) schedulePreview(true); return; }
    if (target === previewFamily) { schedulePreview(true); return; }
    if (target === previewScenes) { player?.goToScene(target.value); return; }
    if (fields.contains(target) && target.tagName === 'SELECT') {
      try { changeField(target, true); } catch { mark(); notify('invalid', 'error'); schedulePreview(); }
    }
  }, { signal });
  form.addEventListener('submit', event => { event.preventDefault(); void save(); }, { signal });
  root.addEventListener('click', async event => {
    const control = event.target.closest('[data-library-action]'); if (!control || saving) return;
    const action = control.dataset.libraryAction;
    if (action === 'save') return;
    if (action === 'select') { const row = rows.find(r => itemKey(r) === control.dataset.key); if (row) selectItem(row); return; }
    if (action === 'category') {
      if (control.dataset.kind === 'audio') { setAudioActive(true); return; }
      if (audioActive && control.dataset.kind === category) { setAudioActive(false); return; }
      if (!canDiscard()) return;
      setAudioActive(false);
      category = control.dataset.kind; query = ''; search.value = ''; draft = null;
      const first = filtered()[0]; if (first) selectItem(first, true); else { renderList(); renderFields(); } return;
    }
    if (action === 'new' || action === 'duplicate' || action === 'duplicate-changes') {
      if (action === 'new' && !canDiscard()) return;
      const next = action !== 'new' && draft ? duplicateItem(draft, rows, t) : makeItem(category, rows, t);
      category = categoryFor(next.kind); selectItem(next, true); original = ''; mark(); return;
    }
    if (action === 'reload' || action === 'reload-latest') { if (audioActive) await audioController?.reload(); else await load(true); return; }
    if (action === 'discard') {
      if (canDiscard()) {
        const target = base.revision > 0 ? base : rows.find(row => categoryFor(row.kind) === category);
        if (target) selectItem(target, true);
        else { draft = base = null; original = ''; renderList(); renderFields(); }
      }
      return;
    }
    if (action === 'toggle') { mutate(() => { draft.status = draft.status === 'active' ? 'disabled' : 'active'; }, true); await save(); return; }
    if (action === 'play') {
      inViewport = true;
      if (latestPreview && latestSignature === fingerprint([draft, contentLocale, previewFamily.value, sceneIndex])) showPreview(latestPreview); else await preview();
      if (matchMedia('(max-width: 1100px)').matches) previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    if (action === 'back-form') { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    mutate(() => {
      const doc = getDocument(draft, contentLocale, true), list = layers(draft, contentLocale, sceneIndex), e = selectedLayer();
      if (action === 'add-frame') { const frames = draft.definition.keyframes, previous = frames.at(-2).offset ?? .5;
        frames.splice(-1, 0, { offset: (previous + (frames.at(-1).offset ?? 1)) / 2, opacity: 1 }); }
      if (action === 'remove-frame' && draft.definition.keyframes.length > 2) draft.definition.keyframes.splice(Number(control.dataset.index), 1);
      if (action === 'add-scene') { const id = globalThis.crypto.randomUUID(); doc.scenes.push({ id, name: t('adminLibrary.scene.newName', { number: doc.scenes.length + 1 }), background: { kind: 'solid', color: '#F5EFFF' }, elementIds: [] }); sceneIndex = doc.scenes.length - 1; layerIndex = 0; }
      if (action === 'remove-scene') { removeScene(doc, sceneIndex); sceneIndex = Math.max(0, sceneIndex - 1); layerIndex = 0; }
      if (action === 'add-layer') { const added = makeLayer(addType, t); if (doc) { doc.elements.push(added); doc.scenes[sceneIndex].elementIds.push(added.id); } else draft.definition.elements.push(added); layerIndex = list.length; }
      if (action === 'remove-layer' && e) { if (doc) { doc.elements = doc.elements.filter(layer => layer.id !== e.id); doc.scenes[sceneIndex].elementIds = doc.scenes[sceneIndex].elementIds.filter(id => id !== e.id); }
        else draft.definition.elements = draft.definition.elements.filter(layer => layer.id !== e.id); layerIndex = Math.max(0, layerIndex - 1); }
      if (['layer-up','layer-down'].includes(action)) { const next = layerIndex + (action === 'layer-up' ? -1 : 1), target = doc ? doc.scenes[sceneIndex].elementIds : draft.definition.elements;
        if (next >= 0 && next < target.length) { [target[layerIndex], target[next]] = [target[next], target[layerIndex]]; layerIndex = next; } }
    }, true);
  }, { signal });
  list.addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    const buttons = [...list.querySelectorAll('button')], index = buttons.indexOf(document.activeElement), next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (buttons[next]) { event.preventDefault(); buttons[next].focus(); }
  }, { signal });
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const buttons = [...tabs.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault(); buttons[next].focus(); buttons[next].click();
  }, { signal });
  root.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (audioActive) audioController?.save(); else void save(); } }, { signal });
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } }, { signal });
  const removeLocale = onLocaleChange(() => { if (!disposed) { renderList(); renderFields(); schedulePreview(true); } });
  const observer = new IntersectionObserver(entries => { inViewport = entries[0].isIntersecting; if (!inViewport) { player?.dispose(); player = null; }
    else if (latestPreview && !player) showPreview(latestPreview); }, { threshold: .02 });
  observer.observe(previewHost);
  mark();
  if (initialCategory === 'audio') setAudioActive(true);
  const ready = Promise.all([load(), audioController?.ready]);
  return { ready, beforeLeave: () => canDiscard() && (!audioController || audioController.beforeLeave()), dispose() { disposed = true; lifetime.abort(); previewAbort?.abort(); clearTimeout(previewTimer); observer.disconnect(); removeLocale(); player?.dispose(); audioController?.dispose(); } };
}
