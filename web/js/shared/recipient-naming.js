// Versioned opt-in: published documents without this marker keep literal braces.
export const RECIPIENT_TOKEN = '{người nhận}';
export const RECIPIENT_MODES = ['manual', 'list', 'self'];
export const RECIPIENT_LIMIT = 1000;
const NAME_LIMIT = 60;
export function validRecipientName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= NAME_LIMIT && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
export function validateRecipientSettings(settings) {
  if (!settings || settings.version !== 1 || !RECIPIENT_MODES.includes(settings.mode)
      || Object.keys(settings).some(key => !['version', 'mode', 'names', 'resolved'].includes(key))) throw new Error('recipient.error.settings');
  if (settings.resolved !== undefined && typeof settings.resolved !== 'boolean') throw new Error('recipient.error.settings');
  if (settings.names !== undefined && (!Array.isArray(settings.names) || settings.names.length > RECIPIENT_LIMIT
      || settings.names.some((item, i) => !item || Object.keys(item).some(k => !['row', 'name'].includes(k))
        || !Number.isSafeInteger(item.row) || item.row < 2 || (i && item.row <= settings.names[i - 1].row) || !validRecipientName(item.name))))
    throw new Error('recipient.error.list');
  return settings;
}
export function recipientText(value, name, enabled) {
  return enabled && typeof value === 'string' ? value.split(RECIPIENT_TOKEN).join(name) : value;
}
export function displayRecipient(document) {
  return document.personalization?.mode !== 'manual' && document.personalization?.mode && !document.personalization.resolved
    ? 'Mai Anh' : document.bindings.recipientName.value;
}
export function coverHasRecipient(document) {
  const cover = document.scenes.find(s => s.id === document.entrySceneId);
  return document.elements.some(el => cover?.elementIds.includes(el.id) && el.type === 'text' && el.visible !== false && el.opacity !== 0
    && (el.props.textBinding === 'recipientName' || (el.props.textBinding ? document.bindings[el.props.textBinding]?.value : el.props.text)?.includes(RECIPIENT_TOKEN)));
}
// CSV fields are always quoted. Prefix spreadsheet formula-like names; URLs remain intact.
export function recipientCsv(rows) {
  const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
  const safe = value => /^[\s]*[=+\-@\t\r]/u.test(value) ? "'" + value : value;
  return '\ufeff' + [['Tên người nhận', 'Link', 'Dòng gốc', 'Mã lượt nhận'], ...rows.map(r => [safe(r.name), r.url, r.row ?? '', r.id])]
    .map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
