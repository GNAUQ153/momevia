import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { defaultLocale, isLocale, translate, vi } from '../../web/js/shared/locale.js';

export function requestLocale(req) {
  const locale = req.headers['x-momevia-locale'];
  return isLocale(locale) ? locale : defaultLocale;
}

export function serverText(locale, key, params) {
  return translate(locale === 'en' ? en : vi, locale, key, params);
}
