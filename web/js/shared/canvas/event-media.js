import { REALISTIC_MEDIA } from './realistic-media.js';
import { INTERACTIVE_MEDIA } from './interactive-media.js';
// Immutable, generated Originals. No arbitrary paths or remote image URLs.
export const REALISTIC_ARTWORK_LABEL = 'Momevia Original photography-style artwork v3';
export const ORIGINAL_ARTWORK_LABEL = 'Momevia Original artwork v2';
export const EVENT_ARTWORK_LABEL = 'Momevia Original artwork v1';
export const EVENT_MEDIA = Object.freeze({
  ...REALISTIC_MEDIA,
  ...INTERACTIVE_MEDIA,
  'event-birthday-album-5190e92b69f2': { file: 'birthday-album-5190e92b69f2.webp', sha256: '5190e92b69f2e536995315a8de6a6c4a1bdf1fa15888b3b49d1f83972d93ea1b', width: 900, height: 1107, previewOnly: true },
  'event-wedding-album-b8ee7c30318b': { file: 'wedding-album-b8ee7c30318b.webp', sha256: 'b8ee7c30318b8fd9752c83d2678d18acbaa4109156fd7ec4875f522f278c1fc9', width: 900, height: 1350, previewOnly: true },
  'event-graduation-album-6d113d2dc27b': { file: 'graduation-album-6d113d2dc27b.webp', sha256: '6d113d2dc27b1d6fb564b0d25b3430260375ac023482566266c54a25631c3147', width: 900, height: 1350, previewOnly: true },

  'event-birthday-859492553d0a': { file: 'birthday-859492553d0a.webp', sha256: '859492553d0a27f9f1a5461b5601c23b83f3e43eb7c2511d7dc920351f38fb34', width: 1024, height: 683 },
  'event-wedding-09fd28f280bf': { file: 'wedding-09fd28f280bf.webp', sha256: '09fd28f280bfa9b53486e76dae3b0e74e596be354e3e9ca289cf3732fddeeaf9', width: 1024, height: 603 },
  'event-graduation-512d1917294b': { file: 'graduation-512d1917294b.webp', sha256: '512d1917294b43016d3502e82133a2b1fcf463eea8884bfceb439aaad28148f9', width: 1024, height: 683 },
});
export const eventMediaId = key => Object.keys(EVENT_MEDIA).find(id => key.endsWith('-album') ? id.startsWith(`event-${key}-`) : id.startsWith(`event-${key}-`) && !EVENT_MEDIA[id].previewOnly);
export const eventMediaUrl = id => EVENT_MEDIA[id] ? `/assets/event-cards/${EVENT_MEDIA[id].file}` : undefined;
