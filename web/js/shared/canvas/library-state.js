// Pure, process/page-local snapshot. No network, I/O, code evaluation or CSS text.
let snapshot = null;
export function installLibrary(value) { snapshot = value ? structuredClone(value) : null; }
export const librarySnapshot = () => snapshot;
export const libraryEntry = (kind, id) => snapshot?.items.find(item => item.kind === kind && item.id === id && item.status === 'active');
export const libraryEntries = kind => snapshot?.items.filter(item => item.kind === kind && item.status === 'active') ?? null;
export const libraryLocale = localize => localize?.('common.price.free') === 'Free' ? 'en' : 'vi';
export const libraryText = (value, locale = 'vi') => typeof value === 'string' ? value : value?.[locale] || value?.vi || value?.en || '';
export function artworkChoices(target, base, locale = 'vi') {
  const choices = new Map(base);
  for (const item of libraryEntries('artwork') || []) if (item.definition.target === target)
    choices.set(item.definition.key, libraryText(item.definition.title, locale) || choices.get(item.definition.key) || item.definition.key);
  return [...choices];
}
export function libraryDocument(kind, id, localize) {
  const item = libraryEntry(kind, id);
  if (!item) return null;
  const docs = item.definition.documents;
  return structuredClone(docs?.[libraryLocale(localize)] || docs?.vi || item.definition.document || null);
}
