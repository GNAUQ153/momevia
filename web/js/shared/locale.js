import vi from '../../assets/locales/vi.json' with { type: 'json' };

export const defaultLocale = 'vi';
export const locales = Object.freeze(['vi', 'en']);
export const isLocale = value => locales.includes(value);
export const localeTag = locale => locale === 'en' ? 'en-US' : 'vi-VN';

export function currency(locale, value) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(value);
}

function formatParameter(dictionary, locale, value) {
  if (!value || typeof value !== 'object') return String(value ?? '');
  switch (value.format) {
    case 'message': return translate(dictionary, locale, value.key, value.params);
    case 'messages': return value.keys.map(key => translate(dictionary, locale, key)).join(', ');
    case 'currency': return currency(locale, value.value);
    case 'number': return new Intl.NumberFormat(localeTag(locale)).format(value.value);
    case 'date': {
      const date = new Date(value.value);
      return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(localeTag(locale), value.options).format(date);
    }
    default: return String(value);
  }
}

export function translate(dictionary, locale, key, params) {
  params ??= {};
  const entry = Object.hasOwn(dictionary, key) ? dictionary[key] : vi[key];
  const pattern = typeof entry === 'object'
    ? entry[new Intl.PluralRules(localeTag(locale)).select(params.count)] ?? entry.other
    : entry;
  return (pattern ?? key).replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, name) =>
    Object.hasOwn(params, name) ? formatParameter(dictionary, locale, params[name]) : `{${name}}`);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export const canonicalText = (key, params) => translate(vi, defaultLocale, key, params);
export { vi };
