// Authoring styles for new library insertions. Saved artwork is pinned in documents.
const botanical = ['flower','leaf','m55-tulip','m55-sunflower','m55-daisy','m55-lavender','m55-four-leaf','m55-leaf-branch','m55-meadow-butterfly','m55-floral-crown','m55-flower-bouquet'];
const keepsakes = ['wax-seal','ribbon-bow','m54-double-hearts','m54-love-letter','m54-rose','m54-heart-arrow','m54-cupid-wings','m54-love-bow','m54-polaroid-stack','m54-floral-wreath'];
export function stickerVector(key, [fill, detail]) {
  const ink = botanical.includes(key) ? '#3F6557' : keepsakes.includes(key) ? '#704354' : '#514463';
  const accents = key === 'm55-lion-mask' ? [
    { d: 'M20 48A12 12 0 1 0 44 48A12 12 0 1 0 20 48ZM56 48A12 12 0 1 0 80 48A12 12 0 1 0 56 48Z', fill: '#FFF7E5', stroke: ink, strokeWidth: 2.2 },
    { d: 'M29 48A4 4 0 1 0 37 48A4 4 0 1 0 29 48ZM63 48A4 4 0 1 0 71 48A4 4 0 1 0 63 48Z', fill: ink },
    { d: 'M46 21L50 16L54 21L50 26Z', fill: '#F3D180' },
  ] : key === 'm55-compass' ? [
    { d: 'M50 23L58 50H42Z', fill: '#FFF7E5', stroke: ink, strokeWidth: 1.5 },
    { d: 'M42 50H58L50 77Z', fill: ink },
  ] : [];
  return { paths: [
    ...(fill ? [{ d: fill, fill: key === 'm54-cupid-wings' ? '#FFF7EE' : 'color', stroke: 'color', strokeWidth: key === 'm54-cupid-wings' ? 2.4 : 0.65 }] : []),
    ...(detail ? [{ d: detail, fill: 'none', stroke: ['wax-seal','birthday-candle'].includes(key) ? '#FFF7EE' : fill ? ink : 'color', strokeWidth: key === 'm54-snowflake' ? 2.5 : 2.7 }] : []),
    ...accents,
  ] };
}
