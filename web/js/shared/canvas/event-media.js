// Immutable, generated Originals. No arbitrary paths or remote image URLs.
export const EVENT_ARTWORK_LABEL = 'Momevia Original artwork v1';
export const EVENT_MEDIA = Object.freeze({
  'event-birthday-859492553d0a': { file: 'birthday-859492553d0a.webp', sha256: '859492553d0a27f9f1a5461b5601c23b83f3e43eb7c2511d7dc920351f38fb34', width: 1024, height: 683 },
  'event-wedding-09fd28f280bf': { file: 'wedding-09fd28f280bf.webp', sha256: '09fd28f280bfa9b53486e76dae3b0e74e596be354e3e9ca289cf3732fddeeaf9', width: 1024, height: 603 },
  'event-graduation-512d1917294b': { file: 'graduation-512d1917294b.webp', sha256: '512d1917294b43016d3502e82133a2b1fcf463eea8884bfceb439aaad28148f9', width: 1024, height: 683 },
});
export const eventMediaId = key => Object.keys(EVENT_MEDIA).find(id => id.startsWith(`event-${key}-`));
export const eventMediaUrl = id => EVENT_MEDIA[id] ? `/assets/event-cards/${EVENT_MEDIA[id].file}` : undefined;
