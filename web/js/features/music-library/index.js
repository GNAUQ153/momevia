import { currentLocale, message, onLocaleChange, setText, t } from '../../core/i18n.js';
import { node } from '../canvas-editor/dom.js';
import { normalizeMusicQuery } from '../canvas-editor/music-panel.js';
import { preserveScroll, captureFieldFocus, restoreFieldFocus } from '../../ui/scroll-state.js';

const key = value => `musicLibrary.${value}`;
const label = value => message(key(value));
const field = (name, control) => node('label', { class: 'library-admin__field' }, node('span', {}, name), control);
const button = (name, action, attrs = {}) => node('button', { type: 'button', class: 'btn btn--outline', 'data-music-admin': action, ...attrs }, label(name));
const duration = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function mountMusicLibrary(host, { api, embedded = false }) {
  const lifetime = new AbortController(), { signal } = lifetime;
  let library, selected, draft, dirty = false, saving = false, disposed = false, audio, playingKey = '', playSequence = 0, listSignature = '', suspendedScroll, previewVolume = .55;
  const filters = { kind: 'music', market: '', theme: '', vocals: '', status: '', query: '' };
  const feedback = node('p', { role: 'status', 'aria-live': 'polite' });
  const count = node('p', { role: 'status', 'data-music-admin-count': '' });
  const list = node('ul', { class: 'library-admin__list music-admin__list', 'data-music-admin-list': '' });
  const edit = node('div', { class: 'library-admin__form music-admin__edit', 'data-music-admin-edit': '' });
  const heading = node('h2', { class: 'library-admin__editing-title' });
  const savedState = node('span', { class: 'library-admin__save-state', role: 'status' });
  const fields = node('fieldset', { class: 'library-admin__form-body music-admin__fields', 'data-music-admin-fields': '' });
  const save = button('save', 'save', { type: 'submit', class: 'btn btn--dark' });
  const cancel = node('button', { type: 'button', class: 'btn btn--outline', 'data-music-admin': 'cancel' }, message('adminLibrary.discard'));
  const toggle = node('button', { type: 'button', class: 'btn btn--outline', 'data-music-admin': 'toggle' }, message('adminLibrary.toggleOff'));
  const footerListen = button('listen', 'listen');
  const form = node('form', { class: 'music-admin__form', 'data-music-admin-form': '', hidden: true },
    node('div', { class: 'library-admin__editor-heading' }, heading, savedState), fields,
    node('div', { class: 'library-admin__save-bar' }, save, toggle, cancel, footerListen));
  edit.append(form);
  const previewTitle = node('h3'), previewArtist = node('p'), previewCredit = node('div', { class: 'music-admin__credit' });
  const previewControl = node('button', { type: 'button', class: 'btn btn--outline', 'data-preview': '', 'aria-pressed': false, disabled: true }, label('listen'));
  const previewProgress = node('progress', { max: 1, value: 0, 'aria-label': label('listen') });
  const previewTime = node('p', { class: 'music-admin__time' });
  const volumeValue = node('output', {}, '55%');
  const volume = node('input', { type: 'range', min: 0, max: 100, value: 55, 'aria-label': label('previewVolume') });
  const select = (name, options) => node('select', { 'aria-label': label(name), 'data-music-admin-filter': name },
    ...options.map(id => node('option', { value: id }, label(`${name}.${id || 'all'}`))));
  const root = node('section', { class: `section library-admin music-admin${embedded ? ' music-admin--embedded' : ''}`, 'data-music-library': '' },
    node('div', { class: 'library-admin__container' },
      embedded ? null : node('a', { href: '/admin', 'data-link': '', class: 'library-admin__back' }, label('back')),
      embedded ? null : node('header', { class: 'library-admin__header' }, node('div', {}, node('h1', {}, label('title')), node('p', {}, label('intro'))), button('reload', 'reload')),
      feedback,
      node('div', { class: 'library-admin__grid music-admin__workspace' },
        node('aside', { class: 'library-admin__browser' },
          node('div', { class: 'music-admin__toolbar' },
            node('input', { type: 'search', maxlength: '120', 'data-music-admin-filter': 'query', placeholder: label('search'), 'aria-label': label('search') }),
            node('div', { class: 'music-admin__filter-pair' },
              select('kind', ['music', 'sfx']), select('status', ['', 'active', 'disabled'])),
            node('details', { class: 'music-admin__filter-more' }, node('summary', {}, label('moreFilters')),
              node('div', { class: 'music-admin__extra-filters' },
                field(label('theme'), select('theme', ['', 'general', 'birthday', 'wedding', 'christmas', 'newyear', 'tet', 'valentine', 'paper', 'gift', 'sparkle', 'memory', 'interaction', 'nature', 'melody'])),
                field(label('market'), select('market', ['', 'vietnam', 'us-uk', 'korea', 'international'])),
                field(label('vocals'), select('vocals', ['', 'instrumental', 'vocal']))))),
          count, list), edit,
        node('aside', { class: 'library-admin__preview music-admin__preview' },
          node('div', { class: 'library-admin__preview-heading' }, node('h2', {}, label('listen')), previewControl),
          node('p', { class: 'library-admin__help' }, label('previewHint')),
          node('div', { class: 'library-admin__preview-stage music-admin__preview-body' }, previewTitle, previewArtist, previewProgress, previewTime,
            field(label('previewVolume'), volume), volumeValue, previewCredit)))));
  host.replaceChildren(root);
  const title = row => row.title[currentLocale()] || row.title.vi;
  function stop() {
    playSequence++; playingKey = '';
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    previewControl.textContent = footerListen.textContent = t(key('listen')); previewControl.setAttribute('aria-pressed', 'false');
    updateProgress();
  }
  async function preview(row) {
    if (playingKey === row.key) { stop(); return; }
    stop(); const sequence = playSequence; playingKey = row.key;
    audio = new Audio(); audio.preload = 'none'; audio.volume = previewVolume; audio.src = row.src;
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', stop, { once: true });
    audio.addEventListener('error', () => { if (sequence === playSequence) { stop(); feedback.textContent = t(key('audioError')); } }, { once: true });
    try {
      await audio.play(); if (disposed || sequence !== playSequence) return;
      const control = previewControl;
      if (control) { control.textContent = footerListen.textContent = t(key('stop')); control.setAttribute('aria-pressed', 'true'); }
    } catch { if (sequence === playSequence) { stop(); feedback.textContent = t(key('audioError')); } }
  }
  function updateProgress() {
    previewProgress.value = selected && audio ? Math.min(1, audio.currentTime / (selected.durationMs / 1000)) : 0;
    previewTime.textContent = selected ? `${duration((audio?.currentTime || 0) * 1000)} / ${duration(selected.durationMs)}` : '';
  }
  function renderPreview() {
    previewControl.disabled = !selected;
    previewControl.dataset.preview = selected?.key || '';
    previewControl.textContent = footerListen.textContent = t(key(playingKey === selected?.key ? 'stop' : 'listen'));
    previewControl.setAttribute('aria-pressed', String(Boolean(selected && playingKey === selected.key)));
    previewTitle.textContent = selected ? title(selected) : t(key('choose'));
    previewArtist.textContent = selected?.artist || '';
    previewCredit.replaceChildren(...(selected ? [
      node('a', { href: selected.licenseUrl, target: '_blank', rel: 'noopener noreferrer' }, label('license')),
      node('a', { href: selected.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, label('openSource')),
    ] : []));
    updateProgress();
  }
  volume.addEventListener('input', () => { previewVolume = Number(volume.value) / 100; volumeValue.textContent = `${volume.value}%`; if (audio) audio.volume = previewVolume; }, { signal });
  function renderList() {
    if (!library) return;
    const query = normalizeMusicQuery(filters.query);
    const rows = library.items.filter(row => row.kind === filters.kind && (!filters.market || row.market === filters.market)
      && (!filters.theme || row.theme === filters.theme) && (!filters.status || row.status === filters.status)
      && (!filters.vocals || row.instrumental === (filters.vocals === 'instrumental'))
      && (!query || normalizeMusicQuery(`${row.title.vi} ${row.title.en} ${row.artist} ${row.keywords} ${row.id}`).includes(query)));
    count.textContent = t(key('count'), { count: rows.length, total: library.items.filter(row => row.kind === filters.kind).length });
    const signature = JSON.stringify([currentLocale(), rows]);
    if (signature !== listSignature) {
      const focused = list.contains(document.activeElement) ? document.activeElement.closest('[data-key], [data-preview]') : null;
      const focusKey = focused?.dataset.key || focused?.dataset.preview, focusAction = focused?.dataset.preview ? 'data-preview' : 'data-key';
      preserveScroll(list, () => {
        list.replaceChildren(...rows.map(row => node('li', { class: 'music-admin__row', 'data-audio-key': row.key },
          node('button', { type: 'button', class: 'music-admin__pick', 'data-music-admin': 'edit', 'data-key': row.key },
            node('span', { class: 'library-admin__item-title' }, title(row)),
            node('span', { class: `library-admin__badge${row.status === 'disabled' ? ' is-off' : ''}` }, message(`adminLibrary.status.${row.status}`)),
            node('small', { class: 'music-admin__artist' }, `${row.artist} - ${duration(row.durationMs)}`)))));
        if (!rows.length) list.append(node('p', {}, label('empty')));
        if (focusKey) list.querySelector(`[${focusAction}="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
      });
      listSignature = signature;
    }
    for (const row of list.querySelectorAll('[data-audio-key]')) {
      const active = row.dataset.audioKey === selected?.key;
      const control = row.querySelector('[data-music-admin="edit"]'); control.classList.toggle('is-selected', active); control.setAttribute('aria-pressed', String(active));
    }
  }
  function renderEditor(reset = false) {
    const focus = captureFieldFocus(edit, 'data-audio-field');
    form.hidden = !draft;
    preserveScroll(fields, () => {
      if (!draft) { fields.replaceChildren(); renderPreview(); return; }
      const themes = selected.kind === 'music' ? ['general', 'birthday', 'wedding', 'christmas', 'newyear', 'tet', 'valentine'] : ['paper', 'gift', 'sparkle', 'birthday', 'memory', 'interaction', 'nature', 'melody'];
      const textInput = (name, value) => node('input', { value, maxlength: '160', required: true, 'data-audio-field': name });
      fields.replaceChildren(
        node('fieldset', { class: 'library-admin__section' }, node('legend', {}, message('adminLibrary.section.details')),
          node('div', { class: 'library-admin__fields' }, field(label('titleVi'), textInput('vi', draft.title.vi)), field(label('titleEn'), textInput('en', draft.title.en))),
          field(label('status'), node('select', { 'data-audio-field': 'status' }, ...['active', 'disabled'].map(status => node('option', { value: status }, label(`status.${status}`))))),
          field(label('theme'), node('select', { 'data-audio-field': 'theme' }, ...themes.map(theme => node('option', { value: theme }, label(`theme.${theme}`))))),
          field(label('keywords'), node('input', { value: draft.keywords, maxlength: '1000', 'data-audio-field': 'keywords' })),
          node('p', { class: 'library-admin__help' }, label('disableNote'))));
      fields.querySelector('[data-audio-field="theme"]').value = draft.theme;
      fields.querySelector('[data-audio-field="status"]').value = draft.status;
      fields.disabled = saving;
      mark();
      if (!reset) restoreFieldFocus(edit, focus);
      renderPreview();
    });
    if (reset) fields.scrollTop = 0;
  }
  function mark() {
    if (!draft) return;
    save.disabled = toggle.disabled = saving || !library.writable; cancel.disabled = saving;
    footerListen.disabled = !selected;
    setText(heading, draft.title[currentLocale()] || draft.title.vi);
    setText(toggle, message(`adminLibrary.${draft.status === 'active' ? 'toggleOff' : 'toggleOn'}`));
    savedState.dataset.librarySaveState = saving ? 'saving' : dirty ? 'dirty' : 'clean';
    setText(savedState, message(`adminLibrary.${saving ? 'saving' : dirty ? 'unsavedLabel' : 'savedLabel'}`));
  }
  const canDiscard = () => !saving && (!dirty || globalThis.confirm(t(key('unsaved'))));
  async function load() {
    stop(); feedback.textContent = t(key('loading'));
    try {
      const result = await api.get('/designs/admin/music-library', { signal });
      if (disposed) return;
      library = result.audioLibrary; selected = library.items.find(row => row.key === selected?.key) || library.items.find(row => row.kind === filters.kind) || null; draft = selected ? structuredClone(selected) : null; dirty = false;
      feedback.textContent = library.writable ? '' : t(key('migration'));
      renderList(); renderEditor();
    } catch (error) { if (!disposed) feedback.textContent = error.message || t(key('loadError')); }
  }
  root.addEventListener('input', event => {
    if (event.target.dataset.musicAdminFilter) {
      const filter = event.target.dataset.musicAdminFilter;
      if (filter === 'kind' && event.target.value !== filters.kind) {
        if (!canDiscard()) { event.target.value = filters.kind; return; }
        stop(); selected = library.items.find(row => row.kind === event.target.value) || null;
        draft = selected ? structuredClone(selected) : null; dirty = false; renderEditor(true);
      }
      filters[filter] = event.target.value; renderList();
    }
    const name = event.target.dataset.audioField;
    if (name && draft) { if (['vi', 'en'].includes(name)) draft.title[name] = event.target.value; else draft[name] = event.target.value; dirty = true; mark(); setText(feedback, message('adminLibrary.unsavedLabel')); }
  }, { signal });
  root.addEventListener('click', event => {
    const previewControl = event.target.closest('[data-preview]');
    if (previewControl) { const row = library?.items.find(item => item.key === previewControl.dataset.preview); if (row) void preview(row); return; }
    const control = event.target.closest('[data-music-admin]'); if (!control) return;
    if (control.dataset.musicAdmin === 'listen' && selected) void preview(selected);
    if (control.dataset.musicAdmin === 'toggle' && draft && !saving && library.writable) { draft.status = draft.status === 'active' ? 'disabled' : 'active'; dirty = true; renderEditor(); form.requestSubmit(); }
    if (control.dataset.musicAdmin === 'reload' && canDiscard()) void load();
    if (control.dataset.musicAdmin === 'cancel' && !saving) { draft = selected ? structuredClone(selected) : null; dirty = false; renderEditor(); }
    if (control.dataset.musicAdmin === 'edit' && canDiscard()) { const changed = selected?.key !== control.dataset.key; if (changed) stop(); selected = library.items.find(row => row.key === control.dataset.key); draft = structuredClone(selected); dirty = false; renderEditor(changed); renderList(); }
  }, { signal });
  root.addEventListener('submit', async event => {
    if (!event.target.matches('[data-music-admin-form]')) return;
    event.preventDefault(); if (saving || !draft || !library.writable) return;
    const focus = captureFieldFocus(edit, 'data-audio-field');
    saving = true; renderEditor();
    try {
      const result = await api.post(`/designs/admin/music-library/${encodeURIComponent(selected.key)}`, {
        expectedRevision: selected.revision, title: draft.title, theme: draft.theme, status: draft.status, keywords: draft.keywords,
      }, { signal });
      if (disposed) return;
      library = result.audioLibrary; selected = library.items.find(row => row.key === selected.key); draft = structuredClone(selected); dirty = false;
      feedback.textContent = t(key('saved'));
    } catch (error) { if (!disposed) feedback.textContent = error.status === 409 ? t(key('conflict')) : error.message; }
    finally { saving = false; if (!disposed) { renderEditor(); renderList(); if (document.activeElement === document.body) restoreFieldFocus(edit, focus); } }
  }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
  const localeOff = onLocaleChange(() => { renderList(); renderEditor(); });
  const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  globalThis.addEventListener('beforeunload', beforeUnload, { signal });
  return { ready: load(), beforeLeave: canDiscard,
    reload() { if (canDiscard()) return load(); },
    save() { edit.querySelector('[data-music-admin-form]')?.requestSubmit(); },
    setActive(active) {
      if (!active) { suspendedScroll = [list, fields].map(region => ({ region, top: region.scrollTop })); stop(); }
      else if (suspendedScroll) { for (const { region, top } of suspendedScroll) region.scrollTop = top; suspendedScroll = null; }
    },
    dispose() { disposed = true; stop(); lifetime.abort(); localeOff(); } };
}
