import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { builtinCoverThumbnail, coverThumbnail, coverThumbnailWidth } from '../../src/modules/designs/cover-thumbnail.mjs';

const svg = color => `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="330"><rect width="390" height="330" fill="${color}"/></svg>`;

test('public thumbnail sizes are bounded and invalid requests fail before rendering', () => {
  assert.equal(coverThumbnailWidth(null), null);
  for (const size of [192, 320, 480, 640, 960]) assert.equal(coverThumbnailWidth(String(size)), size);
  for (const size of ['', '-1', '0', '193', '100000', 'Infinity', '192.5'])
    assert.throws(() => coverThumbnailWidth(size), error => error.status === 400);
});

test('WebP covers keep proportions, render at requested resolution and invalidate by content', async () => {
  const pending = coverThumbnail(svg('#6136df'), 192);
  assert.equal(coverThumbnail(svg('#6136df'), 192), pending);
  const bytes = await pending;
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 192);
  assert.equal(metadata.height, 162);
  assert.notDeepEqual(await coverThumbnail(svg('#f45278'), 192), bytes);
  assert.equal((await sharp(await coverThumbnail(svg('#6136df'), 640)).metadata()).width, 640);
});

test('builtin thumbnails permit only published static template IDs and supported compositions', async () => {
  await assert.rejects(builtinCoverThumbnail('../tokens', 'vi', 'catalog', 192), error => error.status === 404);
  await assert.rejects(builtinCoverThumbnail('__proto__', 'vi', 'catalog', 192), error => error.status === 404);
  await assert.rejects(builtinCoverThumbnail('birthday-radiance', 'vi', '../portrait', 192), error => error.status === 400);
  assert.equal((await sharp(await builtinCoverThumbnail('birthday-radiance', 'vi', 'catalog', 192)).metadata()).width, 192);
});

test('thumbnail rendering retains embedded WebP photos and their transparency', async () => {
  const photo = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#ed2345' } }).webp({ lossless: true }).toBuffer();
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="330"><rect width="390" height="330" fill="#6136df"/><image x="95" y="65" width="200" height="200" href="data:image/webp;base64,${photo.toString('base64')}"/></svg>`;
  const { data, info } = await sharp(await coverThumbnail(source, 192)).raw().toBuffer({ resolveWithObject: true });
  const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  assert(data[center] > 180 && data[center + 2] < 130, 'The red photo must remain visible over the purple background');
});
