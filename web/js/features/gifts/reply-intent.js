export async function submitReplyIntent(scope, input, send) {
  const storageKey = `momevia:reply:${scope}`;
  const payload = JSON.stringify([input.name.trim(), input.message.trim()]);
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))),
    byte => byte.toString(16).padStart(2, '0')).join('');
  let record;
  try { record = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Optional cache. */ }
  if (record?.fingerprint !== fingerprint) record = { fingerprint, intentId: crypto.randomUUID() };
  try { sessionStorage.setItem(storageKey, JSON.stringify(record)); } catch { /* Optional cache. */ }
  const result = await send({ ...input, intentId: record.intentId });
  try { sessionStorage.removeItem(storageKey); } catch { /* Optional cache. */ }
  return result;
}
