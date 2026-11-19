// Original Momevia paths. Every path is defined in a 100 × 100 viewBox.
export const stickerArt = Object.freeze({
  'ribbon-bow': ['M49 49C37 43 12 24 12 41S32 64 50 52C70 65 88 57 88 41S63 42 51 49Z', 'M45 54 29 85l18-8 5 9 2-32 14 31 6-11 12 4-24-26'],
  'wax-seal': ['M50 8 61 13 72 13 79 24 90 30 90 45 95 55 86 66 82 80 69 83 60 93 46 90 32 93 25 84 13 78 13 64 5 52 11 41 12 26 24 21 32 10 43 13Z', 'M50 68C12 46 45 25 50 44 56 25 88 46 50 68Z'],
  'paper-crane': ['M8 62 56 26 58 54 84 22 95 34 85 36 75 67 52 76 44 62Z', 'M44 62 56 26 52 76M58 54 75 67'],
  butterfly: ['M50 56C37 6 2 14 10 39 11 48 25 54 39 58 13 61 20 88 37 81 46 76 49 68 50 56ZM50 56C63 6 98 14 90 39 89 48 75 54 61 58 87 61 80 88 63 81 54 76 51 68 50 56Z', 'M50 73V49l-9-12m9 12 9-12'],
  sun: ['M50 28a22 22 0 1 0 0 44 22 22 0 1 0 0-44Z', 'M50 7v12m0 62v12M7 50h12m62 0h12M20 20l9 9m42 42 9 9m0-60-9 9M29 71l-9 9'],
  crescent: ['M68 10A41 41 0 1 0 90 67 40 40 0 0 1 68 10Z', 'M78 23v16m-8-8h16'],
  rainbow: ['M10 76V62a40 40 0 0 1 80 0v14h-9V62a31 31 0 0 0-62 0v14Z', 'M27 76V62a23 23 0 0 1 46 0v14m-36 0V62a13 13 0 0 1 26 0v14'],
  'rain-cloud': ['M24 62a15 15 0 1 1 3-30 21 21 0 0 1 40-4 18 18 0 1 1 7 34Z', 'M29 73l-6 13m27-13-6 15m27-15-6 13'],
  'tea-cup': ['M14 42h56v17c0 18-12 24-28 24S14 77 14 59Z', 'M69 47h9c16 0 14 25-11 24M7 89h77M29 31c12-9-7-14 4-22m15 22c12-9-7-14 4-22'],
  'film-camera': ['M9 32h16l8-10h29l8 10h21v49H9Z', 'M50 38a17 17 0 1 0 0 34 17 17 0 1 0 0-34ZM18 42h10m49 0h7'],
  'flower-bicycle': ['M75 32h18l-4 19H78Z M77 31c-11-16 2-24 7-8 2-18 16-12 12-1-2 6-9 6-12 12Z', 'M22 61a17 17 0 1 0 0 34 17 17 0 1 0 0-34Zm57 0a17 17 0 1 0 0 34 17 17 0 1 0 0-34ZM22 78l18-29 14 29H22m32 0 21-32 4 32M40 49h33M33 46h14m26 0-4-9h-8'],
  'birthday-candle': ['M38 44h24v48H38ZM50 6c-5 12-19 17-12 29 6 9 23 6 25-5S54 17 50 6Z', 'M38 59l24-8M38 75l24-8m-24 23 24-8'],
  lantern: ['M29 24h42c16 13 17 36 0 50H29c-17-14-16-37 0-50Z', 'M35 23h30m-15 0V9m-11 15c-9 17-9 33 0 50m22-50c9 17 9 33 0 50M50 24v65m-12-15v11m24-11v11'],
  'sea-shell': ['M50 82C43 83 14 65 8 48 0 30 17 21 28 27 33 13 45 12 50 22 55 12 67 13 72 27 83 21 100 30 92 48 86 65 57 83 50 82Z', 'M50 76V30m-4 45L29 34m15 43L16 45m38 30 17-41M56 77l28-32'],
  leaf: ['M12 80C18 32 52 12 90 14 90 50 66 85 12 80Z','M14 85 74 32'],
  lace: ['','M2 55Q8 18 14 55T26 55T38 55T50 55T62 55T74 55T86 55T98 55M2 62H98'],
  'paper-wave': ['M0 40Q22 4 49 38T100 28V100H0Z'],
  'bunting': ['M9 44 24 74 33 47 47 77 56 48 72 76 82 46 95 66 98 40Z','M1 39Q50 58 99 39'],
  'washi-tape': ['M1 20 5 10 94 12 98 22 94 40 98 59 94 81 98 89 4 89 1 78 5 52Z','M12 82 26 17M31 82 45 17M50 82 64 17M69 82 83 17'],
  'sunburst': ['M50 3 59 15 73 8 76 23 92 22 89 39 100 50 89 60 92 78 76 77 73 92 59 85 50 98 41 85 27 92 24 77 8 78 11 60 0 50 11 39 8 22 24 23 27 8 41 15Z'],
});

export const shapes = Object.freeze({
  triangle: 'M50 1 99 99H1Z',
  diamond: 'M50 1 99 50 50 99 1 50Z',
  hexagon: 'M25 1H75L99 50 75 99H25L1 50Z',
  arch: 'M1 99V46C1-14 99-14 99 46V99Z',
  ribbon: 'M0 12H100L88 50 100 88H0L12 50Z',
  speech: 'M4 2H96Q99 2 99 12V72Q99 82 93 82H33L15 99V82H7Q1 82 1 72V12Q1 2 4 2Z',
});

export const lines = Object.freeze({
  arc: 'M2 94Q50 -84 98 94',
  stitched: 'M2 50H98',
  arrow: 'M2 87Q50 0 96 40M79 7 96 40 77 64',
  wave: 'M2 50Q14 4 26 50T50 50T74 50T98 50',
  brace: 'M98 2C35 2 68 43 8 50 68 57 35 98 98 98',
  corners: 'M2 26V2H25M75 2H98V26M98 74V98H75M25 98H2V74',
});

export const masks = Object.freeze({
  round: 'M50 0A50 50 0 1 1 50 100 50 50 0 1 1 50 0Z',
  arch: shapes.arch,
  heart: 'M50 97C27 77 3 58 3 31 3 2 35-8 50 17 65-8 97 2 97 31 97 58 73 77 50 97Z',
  torn: 'M2 5 9 1 13 7 21 2 32 6 44 0 51 6 63 2 75 7 84 1 93 6 100 2 97 23 100 41 96 62 100 81 97 99 91 94 84 100 73 95 66 100 56 94 45 100 34 95 25 100 14 94 9 100 0 96 3 79 0 58 4 36 0 20Z',
});

export const heartPieces = Object.freeze([
  'M50 32C26 4 5 14 4 39 3 51 12 60 22 69L50 52Z',
  'M50 32C74 4 95 14 96 39 97 51 88 60 78 69L50 52Z',
  'M22 69 50 52 78 69C69 77 60 85 50 94 40 85 31 77 22 69Z',
]);

export const originalStickerIds = Object.freeze(['heart','star','flower','sparkles','balloon','cake','gift']);

export function vectorParts(model) {
  const { type, props: p } = model;
  if (type === 'sticker' && Object.hasOwn(stickerArt,p.stickerId)) {
    const [fill, stroke] = stickerArt[p.stickerId];
    return [fill && { d:fill, fill:p.color },
      stroke && { d:stroke, fill:'none', stroke: fill ? (p.stickerId === 'wax-seal' || p.stickerId === 'birthday-candle' ? '#FFF7EE' : '#32243B') : p.color, 'stroke-width': 4 },
    ].filter(Boolean);
  }
  if (type === 'shape' && Object.hasOwn(shapes,p.kind)) return [{
    d:shapes[p.kind], fill:p.color, stroke:p.strokeColor, 'stroke-width':p.strokeWidth, 'vector-effect':'non-scaling-stroke',
  }];
  if (type === 'line' && Object.hasOwn(lines,p.pattern)) return [{
    d:lines[p.pattern], fill:'none', stroke:p.color, 'stroke-width':p.strokeWidth, 'vector-effect':'non-scaling-stroke',
    ...(p.pattern === 'stitched' ? {'stroke-dasharray': `${p.strokeWidth * 2 + 2} ${p.strokeWidth * 2 + 2}`} : {}),
  }];
  return null;
}
