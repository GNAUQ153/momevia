import { currentLocale, message, onLocaleChange, t } from '../../core/i18n.js';
import { node, field } from '../canvas-editor/dom.js';
import { normalizeMusicQuery } from '../canvas-editor/music-panel.js';
import { preserveScroll } from '../../ui/scroll-state.js';

const key = value => `musicLibrary.${value}`;
const label = value => message(key(value));
const button = (name, action, attrs = {}) => node('button', { type: 'button', class: 'btn btn--outline', 'data-music-admin': action, ...attrs }, label(name));
const duration = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function mountMusicLibrary(host, { api, embedded = false }) {
  const lifetime = new AbortController(), { signal } = lifetime;
  let library, selected, draft, dirty = false, saving = false, disposed = false, audio, playingKey = '', playSequence = 0, listSignature = '', suspendedScroll;
  const filters = { kind: 'music', market: '', theme: '', vocals: '', status: '', query: '' };
  const feedback = node('p', { role: 'status', 'aria-live': 'polite' });
  const count = node('p', { role: 'status', 'data-music-admin-count': '' });
  const list = node('div', { class: 'music-admin__list', 'data-music-admin-list': '' });
  const edit = node('div', { class: 'music-admin__edit', 'data-music-admin-edit': '' });
  const providerHost = node('div', { class: 'music-admin__providers' });
  const select = (name, options) => node('select', { 'aria-label': label(name), 'data-music-admin-filter': name },
    ...options.map(id => node('option', { value: id }, label(`${name}.${id || 'all'}`))));
  const root = node('section', { class: `section library-admin music-admin${embedded ? ' music-admin--embedded' : ''}`, 'data-music-library': '' },
    node('div', { class: 'library-admin__container' },
      embedded ? null : node('a', { href: '/admin', 'data-link': '', class: 'library-admin__back' }, label('back')),
      embedded ? null : node('header', { class: 'library-admin__header' }, node('div', {}, node('h1', {}, label('title')), node('p', {}, label('intro'))), button('reload', 'reload')),
      node('div', { class: 'music-admin__toolbar' },
        field(label('search'), node('input', { type: 'search', maxlength: '120', 'data-music-admin-filter': 'query', placeholder: label('search') })),
        field(label('kind'), select('kind', ['music', 'sfx'])),
        field(label('market'), select('market', ['', 'vietnam', 'us-uk', 'korea', 'international'])),
        field(label('theme'), select('theme', ['', 'general', 'birthday', 'wedding', 'christmas', 'newyear', 'tet', 'valentine', 'paper', 'gift', 'sparkle', 'memory', 'interaction', 'nature', 'melody'])),
        field(label('vocals'), select('vocals', ['', 'instrumental', 'vocal'])),
        field(label('status'), select('status', ['', 'active', 'disabled']))),
      feedback, count, node('div', { class: 'music-admin__workspace' }, list, edit),
      node('section', { class: 'music-admin__sources' }, node('h2', {}, label('providers')), node('p', {}, label('providerNote')), providerHost)));
  host.replaceChildren(root);
  const title = row => row.title[currentLocale()] || row.title.vi;
  function stop() {
    playSequence++; playingKey = '';
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    for (const item of list.querySelectorAll('[data-preview]')) { item.textContent = t(key('listen')); item.setAttribute('aria-pressed', 'false'); }
  }
  async function preview(row) {
    if (playingKey === row.key) { stop(); return; }
    stop(); const sequence = playSequence; playingKey = row.key;
    audio = new Audio(); audio.preload = 'none'; audio.volume = .55; audio.src = row.src;
    audio.addEventListener('ended', stop, { once: true });
    audio.addEventListener('error', () => { if (sequence === playSequence) { stop(); feedback.textContent = t(key('audioError')); } }, { once: true });
    try {
      await audio.play(); if (disposed || sequence !== playSequence) return;
      const control = [...list.querySelectorAll('[data-preview]')].find(item => item.dataset.preview === row.key);
      if (control) { control.textContent = t(key('stop')); control.setAttribute('aria-pressed', 'true'); }
    } catch { if (sequence === playSequence) { stop(); feedback.textContent = t(key('audioError')); } }
  }
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
        list.replaceChildren(...rows.map(row => node('article', { class: 'music-admin__row', 'data-audio-key': row.key },
      node('div', {}, node('strong', {}, title(row)), node('p', {}, `${row.artist} · ${duration(row.durationMs)}`),
        node('small', {}, `${t(key(`theme.${row.theme}`))} · ${row.license} · ${t(key(`status.${row.status}`))}`)),
      node('div', { class: 'music-admin__row-actions' }, node('button', { type: 'button', class: 'btn btn--outline', 'data-preview': row.key, 'aria-pressed': playingKey === row.key }, label(playingKey === row.key ? 'stop' : 'listen')),
          button('edit', 'edit', { 'data-key': row.key })))));
        if (!rows.length) list.append(node('p', {}, label('empty')));
        if (focusKey) list.querySelector(`[${focusAction}="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
      });
      listSignature = signature;
    }
    for (const row of list.querySelectorAll('[data-audio-key]')) {
      const active = row.dataset.audioKey === selected?.key;
      row.classList.toggle('is-selected', active); row.querySelector('[data-music-admin="edit"]').setAttribute('aria-pressed', String(active));
    }
  }
  function renderEditor(reset = false) {
    const focus = edit.contains(document.activeElement) ? document.activeElement.dataset.audioField : null;
    preserveScroll(edit, () => {
      edit.replaceChildren();
    if (!draft) { edit.append(node('p', {}, label('choose'))); return; }
    const themes = selected.kind === 'music' ? ['general', 'birthday', 'wedding', 'christmas', 'newyear', 'tet', 'valentine'] : ['paper', 'gift', 'sparkle', 'birthday', 'memory', 'interaction', 'nature', 'melody'];
    const textInput = (name, value, max) => node('input', { value, maxlength: String(max), required: name !== 'keywords', 'data-audio-field': name });
    const form = node('form', { 'data-music-admin-form': '' },
      node('h2', {}, title(selected)), node('p', {}, `${selected.id} · v${selected.version} · ${duration(selected.durationMs)}`),
      field(label('titleVi'), textInput('vi', draft.title.vi, 160)), field(label('titleEn'), textInput('en', draft.title.en, 160)),
      field(label('theme'), node('select', { 'data-audio-field': 'theme', value: draft.theme }, ...themes.map(theme => node('option', { value: theme, selected: theme === draft.theme ? '' : null }, label(`theme.${theme}`))))),
      field(label('keywords'), textInput('keywords', draft.keywords, 1000)),
      field(label('status'), node('select', { 'data-audio-field': 'status' }, ...['active', 'disabled'].map(status => node('option', { value: status, selected: status === draft.status ? '' : null }, label(`status.${status}`))))),
      node('p', {}, label('disableNote')),
      node('dl', {}, node('dt', {}, label('artist')), node('dd', {}, selected.artist), node('dt', {}, label('license')),
        node('dd', {}, node('a', { href: selected.licenseUrl, target: '_blank', rel: 'noopener noreferrer' }, selected.license)),
        node('dt', {}, label('source')), node('dd', {}, node('a', { href: selected.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, label('openSource'))),
        node('dt', {}, 'SHA-256'), node('dd', {}, node('code', {}, selected.sha256))),
      node('p', {}, label('immutable')),
      node('div', { class: 'music-admin__save' }, button('save', 'save', { type: 'submit', class: 'btn btn--dark', disabled: saving || !library.writable }), button('cancel', 'cancel', { disabled: saving })));
    edit.append(form);
    form.querySelector('[data-audio-field="theme"]').value = draft.theme;
    form.querySelector('[data-audio-field="status"]').value = draft.status;
      if (focus && !reset) edit.querySelector(`[data-audio-field="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
    });
    if (reset) edit.scrollTop = 0;
  }
  const canDiscard = () => !saving && (!dirty || globalThis.confirm(t(key('unsaved'))));
  async function load() {
    stop(); feedback.textContent = t(key('loading'));
    try {
      const result = await api.get('/designs/admin/music-library', { signal });
      if (disposed) return;
      library = result.audioLibrary; selected = library.items.find(row => row.key === selected?.key) || null; draft = selected ? structuredClone(selected) : null; dirty = false;
      feedback.textContent = library.writable ? '' : t(key('migration'));
      providerHost.replaceChildren(...library.providers.map(provider => node('article', {},
        node('a', { href: provider.url, target: '_blank', rel: 'noopener noreferrer' }, provider.name), node('p', {}, label(`provider.${provider.state}`)))));
      renderList(); renderEditor();
    } catch (error) { if (!disposed) feedback.textContent = error.message || t(key('loadError')); }
  }
  root.addEventListener('input', event => {
    if (event.target.dataset.musicAdminFilter) { filters[event.target.dataset.musicAdminFilter] = event.target.value; renderList(); }
    const name = event.target.dataset.audioField;
    if (name && draft) { if (['vi', 'en'].includes(name)) draft.title[name] = event.target.value; else draft[name] = event.target.value; dirty = true; }
  }, { signal });
  root.addEventListener('click', event => {
    const previewControl = event.target.closest('[data-preview]');
    if (previewControl) { const row = library?.items.find(item => item.key === previewControl.dataset.preview); if (row) void preview(row); return; }
    const control = event.target.closest('[data-music-admin]'); if (!control) return;
    if (control.dataset.musicAdmin === 'reload' && canDiscard()) void load();
    if (control.dataset.musicAdmin === 'cancel' && !saving) { draft = selected ? structuredClone(selected) : null; dirty = false; renderEditor(); }
    if (control.dataset.musicAdmin === 'edit' && canDiscard()) { const changed = selected?.key !== control.dataset.key; selected = library.items.find(row => row.key === control.dataset.key); draft = structuredClone(selected); dirty = false; renderEditor(changed); renderList(); }
  }, { signal });
  root.addEventListener('submit', async event => {
    if (!event.target.matches('[data-music-admin-form]')) return;
    event.preventDefault(); if (saving || !draft || !library.writable) return;
    saving = true; renderEditor();
    try {
      const result = await api.post(`/designs/admin/music-library/${encodeURIComponent(selected.key)}`, {
        expectedRevision: selected.revision, title: draft.title, theme: draft.theme, status: draft.status, keywords: draft.keywords,
      }, { signal });
      if (disposed) return;
      library = result.audioLibrary; selected = library.items.find(row => row.key === selected.key); draft = structuredClone(selected); dirty = false;
      feedback.textContent = t(key('saved'));
    } catch (error) { if (!disposed) feedback.textContent = error.status === 409 ? t(key('conflict')) : error.message; }
    finally { saving = false; if (!disposed) { renderEditor(); renderList(); } }
  }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
  const localeOff = onLocaleChange(() => { renderList(); renderEditor(); });
  const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  globalThis.addEventListener('beforeunload', beforeUnload, { signal });
  return { ready: load(), beforeLeave: canDiscard,
    reload() { if (canDiscard()) return load(); },
    save() { edit.querySelector('[data-music-admin-form]')?.requestSubmit(); },
    setActive(active) {
      if (!active) { suspendedScroll = [list, edit].map(region => ({ region, top: region.scrollTop })); stop(); }
      else if (suspendedScroll) { for (const { region, top } of suspendedScroll) region.scrollTop = top; suspendedScroll = null; }
    },
    dispose() { disposed = true; stop(); lifetime.abort(); localeOff(); } };
}
