// Biểu tượng SVG từ Lucide (ISC); một số icon kế thừa Feather (MIT): https://lucide.dev/license
const paths = {
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  "arrow-left": '<path d="m12 19-7-7 7-7M5 12h14"/>',
  "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H7a2.5 2.5 0 0 1 0-5c3 0 5 5 5 5ZM12 8h5a2.5 2.5 0 0 0 0-5c-3 0-5 5-5 5Z"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  sparkles:
    '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM5 17l.6 1.4L7 19l-1.4.6L5 21l-.6-1.4L3 19l1.4-.6L5 17ZM20 15l.6 1.4L22 17l-1.4.6L20 19l-.6-1.4L18 17l1.4-.6L20 15Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  "check-circle":
    '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h3"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="7" width="8" height="10" rx="1"/>',
  "zoom-out": '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6"/>',
  "zoom-in": '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6m-3-3v6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  'more-vertical': '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  unlock: '<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  "align-left": '<path d="M4 6h16M4 10h11M4 14h16M4 18h11"/>',
  "align-center": '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  "align-right": '<path d="M4 6h16M9 10h11M4 14h16M9 18h11"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  shield: '<path d="m12 22 7-4V6l-7-4-7 4v12l7 4Z"/><path d="m9 12 2 2 4-4"/>',
  pencil: '<path d="M12 20H4l2-8L17 1l6 6-11 11-8 2ZM14 4l6 6"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-5-5-5 5-2-2-6 6"/>',
  music:
    '<path d="M9 18V5l12-3v13M9 5l12-3M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3ZM21 15a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  "message-circle":
    '<path d="M20.8 11.5a8.8 8.8 0 0 1-9.2 9 9 9 0 0 1-3.8-.8L3 21l1.3-4.7A9 9 0 1 1 20.8 11.5Z"/>',
  star: '<path d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-4.9 6.9-1L12 2Z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  "external-link":
    '<path d="M13 5h6v6M19 5l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  lock: '<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  "credit-card":
    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  "log-out":
    '<path d="M10 17l5-5-5-5M15 12H3M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  edit: '<path d="m15 5 4 4M4 20l5-.8L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  "qr-code":
    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3M21 14h-2M19 19h2v2h-4M14 21v-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  "eye-off":
    '<path d="M2 2l20 20"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.1 3.7"/><path d="M6.1 6.2C3.7 8.1 2 12 2 12s4 7 10 7c1.4 0 2.6-.4 3.8-.9"/><path d="M9.7 9.7a3 3 0 0 0 4.6 4.6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  "upload-cloud":
    '<path d="M5 17a5 5 0 0 1-.7-9.9A7 7 0 0 1 18 8a4.5 4.5 0 0 1 1 9M12 21V11m-4 4 4-4 4 4"/>',
};
export function icon(name, size = 20, extraClass = "") {
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkles}</svg>`;
}
