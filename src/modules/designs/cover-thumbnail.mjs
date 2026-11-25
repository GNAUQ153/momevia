import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { COVER_WIDTHS } from '../../../web/js/shared/cover-images.js';
import { canvasError } from './errors.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../../shared/paths.mjs';
import { BASIC_TEMPLATES } from '../../../web/js/shared/canvas/basic-templates.js';

const cache = new Map();
const cacheLimit = 128;

async function svgWithPortablePhotos(svg) {
  let source = svg.toString();
  // Some librsvg builds cannot decode embedded WebP even though Sharp can.
  // Normalize only the in-memory render input; retain original SVGs and assets.
  const photos = [...new Set(source.match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g) || [])];
  for (const uri of photos) {
    const png = await sharp(Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')).png().toBuffer();
    source = source.replaceAll(uri, `data:image/png;base64,${png.toString('base64')}`);
  }
  return Buffer.from(source);
}

export function coverThumbnailWidth(value) {
  if (value === null) return null;
  const width = Number(value);
  if (!/^\d+$/.test(value) || !COVER_WIDTHS.includes(width))
    throw canvasError(400, 'INVALID_COVER_WIDTH', 'Unsupported cover image size.');
  return width;
}

export function coverThumbnail(svg, width) {
  const key = `${width}:${createHash('sha256').update(svg).digest('hex')}`;
  if (cache.has(key)) return cache.get(key);
  // Rasterize vectors at the requested density before encoding, including HiDPI sizes.
  const pending = svgWithPortablePhotos(svg).then(source =>
    sharp(source, { density: Math.ceil(72 * width / 390) })
      .resize({ width }).webp({ quality: 82, effort: 4 }).toBuffer())
    .catch(error => { cache.delete(key); throw error; });
  cache.set(key, pending);
  if (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
  return pending;
}

export async function builtinCoverThumbnail(id, locale, variant, width) {
  if (!Object.hasOwn(BASIC_TEMPLATES, id)) throw canvasError(404, 'TEMPLATE_NOT_FOUND', 'Template unavailable.');
  if (!['catalog', 'seasonal'].includes(variant)) throw canvasError(400, 'INVALID_COVER_VARIANT', 'Unsupported cover image layout.');
  const directory = path.join(projectRoot, 'web/assets/basic-templates', locale === 'en' ? 'en' : '');
  const svg = await readFile(path.join(directory, `${id}-${variant}.svg`));
  return coverThumbnail(svg, width);
}
