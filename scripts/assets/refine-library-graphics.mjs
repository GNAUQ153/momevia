import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const directory = new URL('../../web/assets/event-cards/refined-v1/', import.meta.url);
const media = {};
const ids = {};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const specifications = [
  { key: 'element-open-kit-cloud', name: 'billowing-cloud', source: 'cloud-source.svg',
    author: 'Momevia', license: 'Original Momevia artwork',
    provenance: 'Original native SVG with a single contiguous cloud. Shadow is a separate editable Canvas effect.' },
  { key: 'element-open-vintage-flower', name: 'vintage-branch', source: 'vintage-source.svg',
    author: 'johnny_automatic; The Purple Parasol (1905); Momevia viewport/contour adaptation',
    license: 'CC0-1.0', provenance: 'https://openclipart.org/detail/8903/branch-with-flower' },
];

for (const spec of specifications) {
  const source = fs.readFileSync(new URL(spec.source, directory));
  const rendition = async (width, suffix) => {
    const bytes = await sharp(source, { density: 144 }).resize({ width }).webp({ quality: 95, effort: 6 }).toBuffer();
    const hash = digest(bytes);
    const name = `${spec.name}${suffix}-${hash.slice(0, 12)}.webp`;
    fs.writeFileSync(new URL(name, directory), bytes);
    const size = await sharp(bytes).metadata();
    return { file: `refined-v1/${name}`, sha256: hash, width: size.width, height: size.height, bytes: bytes.length };
  };
  const full = await rendition(960, '');
  const id = `event-refined-${spec.name}-${full.sha256.slice(0, 12)}`;
  media[id] = { ...full, version: 5, role: 'distributable-decoration', kind: 'graphic', visualKind: 'graphics',
    author: spec.author, license: spec.license, source: spec.provenance,
    sourceHash: digest(source), rights: 'Redistribution with gifts permitted', fit: 'contain',
    cover: await rendition(640, '-cover'), thumbnail: await rendition(192, '-thumbnail') };
  ids[spec.key] = id;
}

const manifest = { media, ids };
fs.writeFileSync(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(new URL('../../web/js/shared/canvas/refined-media.js', import.meta.url),
  '// Immutable renditions of the native SVG sources in assets/event-cards/refined-v1.\n' +
  `export const REFINED_MEDIA = ${JSON.stringify(media, null, 2)};\n` +
  `export const REFINED_MEDIA_IDS = ${JSON.stringify(ids, null, 2)};\n`);
console.log('Built two refined graphics with cover and thumbnail renditions.');
