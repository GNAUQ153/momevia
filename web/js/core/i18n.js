import { currency, defaultLocale, escapeHtml, isLocale, translateUi as translate, vi } from '../shared/locale.js';

const storageKey = 'momevia-locale';
const dictionaries = new Map([[defaultLocale, vi]]);
const pending = new Map();
const bindings = new WeakMap();
const listeners = new Set();
const messageType = Symbol('message');
const marker = 'momevia-i18n:';
let locale = defaultLocale;
let requestId = 0;
let selectedLocale = locale;

export const currentLocale = () => locale;
export const t = (key, params) => translate(dictionaries.get(locale), locale, key, params);
export function captureTranslator() {
  const capturedLocale = locale, dictionary = dictionaries.get(locale);
  return (key, params) => translate(dictionary, capturedLocale, key, params);
}
export const message = (key, params) => ({ [messageType]: true, key, params });
export const isMessage = value => Boolean(value?.[messageType]);
export function formatCurrency(value) {
  return currency(locale, value);
}

export function priceText(value) {
  return Number(value) === 0
    ? text('common.price.free') : text('common.price.value', { amount: { format: 'currency', value } });
}

function encode(key, params) {
  return encodeURIComponent(JSON.stringify([key, params]));
}

// Text stays in its original DOM position, including inside buttons and options.
export function text(key, params) {
  return `<!--${marker}${encode(key, params)}-->${escapeHtml(t(key, params))}<!--/momevia-i18n-->`;
}

export function attr(name, key, params) {
  return `${name}="${escapeHtml(t(key, params))}" data-i18n-${name}="${encode(key, params)}"`;
}

function bind(node, name, value) {
  const entries = bindings.get(node) ?? new Map();
  if (isMessage(value)) entries.set(name, [value.key, value.params]);
  else entries.delete(name);
  if (entries.size) bindings.set(node, entries);
  else bindings.delete(node);
  return isMessage(value) ? t(value.key, value.params) : value;
}

export function setText(node, value) {
  node.textContent = bind(node, 'text', value);
}

export function setAttr(node, name, value) {
  node.removeAttribute(`data-i18n-${name}`);
  node.setAttribute(name, bind(node, name, value));
}

function applyBinding(node, name, key, params) {
  const translated = t(key, params);
  if (name === 'text') {
    if (node.textContent !== translated) node.textContent = translated;
  } else if (node.getAttribute(name) !== translated) node.setAttribute(name, translated);
}

function updateDocument() {
  document.documentElement.lang = locale;
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.COMMENT_NODE) {
      if (!node.data.startsWith(marker)) continue;
      const [key, params] = JSON.parse(decodeURIComponent(node.data.slice(marker.length)));
      const translated = t(key, params);
      if (node.nextSibling?.nodeType === Node.TEXT_NODE) node.nextSibling.data = translated;
      else node.after(document.createTextNode(translated));
      continue;
    }
    for (const { name, value } of node.attributes ?? []) {
      if (name === 'data-i18n') applyBinding(node, 'text', value);
      else if (name.startsWith('data-i18n-')) {
        const [key, params] = value.startsWith('%5B') ? JSON.parse(decodeURIComponent(value)) : [value];
        applyBinding(node, name.slice('data-i18n-'.length), key, params);
      }
    }
    for (const [name, [key, params]] of bindings.get(node) ?? []) applyBinding(node, name, key, params);
  }
  syncControls();
  for (const callback of listeners) callback();
}

async function loadDictionary(value) {
  if (dictionaries.has(value)) return;
  if (!pending.has(value)) pending.set(value, (async () => {
    const response = await fetch(`/assets/locales/${value}.json`);
    if (!response.ok) throw new Error(`Locale ${value}: HTTP ${response.status}`);
    const dictionary = await response.json();
    if (!dictionary || Array.isArray(dictionary) || typeof dictionary !== 'object')
      throw new Error(`Locale ${value}: expected a dictionary`);
    dictionaries.set(value, dictionary);
  })().finally(() => pending.delete(value)));
  await pending.get(value);
}

function syncControls(failed = false) {
  for (const select of document.querySelectorAll('[data-locale-select]')) {
    if (select.value !== selectedLocale) select.value = selectedLocale;
    select.closest('.locale-control').querySelector('[data-locale-error]').textContent =
      failed ? t('common.preferences.loadFailed') : '';
  }
}

export async function selectLocale(value, { persist = true } = {}) {
  if (!isLocale(value)) return false;
  const id = ++requestId;
  selectedLocale = value;
  syncControls();
  try {
    await loadDictionary(value);
  } catch {
    if (id === requestId) {
      selectedLocale = locale;
      syncControls(true);
    }
    return false;
  }
  if (id !== requestId) return false;
  locale = value;
  if (persist) {
    try { localStorage.setItem(storageKey, value); } catch { /* Storage may be blocked. */ }
  }
  updateDocument();
  return true;
}

export function onLocaleChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function localeControl() {
  return `<div class="locale-control"><select data-locale-select ${attr('aria-label', 'common.preferences.language')}>
    <option value="vi" ${attr('aria-label', 'common.preferences.vietnamese')}${selectedLocale === 'vi' ? ' selected' : ''}>VI</option>
    <option value="en" ${attr('aria-label', 'common.preferences.english')}${selectedLocale === 'en' ? ' selected' : ''}>EN</option>
  </select><span class="locale-error" role="status" data-locale-error></span></div>`;
}

export function createLocaleControl() {
  const template = document.createElement('template');
  template.innerHTML = localeControl();
  return template.content.firstElementChild;
}

export function initializeLocale() {
  document.addEventListener('change', event => {
    if (event.target.matches('[data-locale-select]')) void selectLocale(event.target.value);
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) void selectLocale(event.newValue ?? defaultLocale, { persist: false });
  });
  let stored;
  try { stored = localStorage.getItem(storageKey); } catch { /* Storage may be blocked. */ }
  return selectLocale(isLocale(stored) ? stored : defaultLocale, { persist: false });
}
