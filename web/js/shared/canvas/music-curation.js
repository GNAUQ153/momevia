// Curation controls only new Studio choices; immutable media resolves elsewhere.
let entries = null;
export function installAudioCuration(value) { entries = Array.isArray(value?.items) ? structuredClone(value.items) : null; }
export const audioCuration = key => entries?.find(item => item.key === key) || null;
export const musicIsSelectable = id => audioCuration(`music:${id}`)?.status !== 'disabled';
