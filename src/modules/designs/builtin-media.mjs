import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { EVENT_MEDIA } from '../../../web/js/shared/canvas/event-media.js';
import { canvasError } from './errors.mjs';
export function builtinMedia(id) {
  const spec = EVENT_MEDIA[id];
  if (!spec) return null;
  const file = fileURLToPath(new URL(`../../../web/assets/event-cards/${spec.file}`, import.meta.url));
  const bytes = fs.readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== spec.sha256)
    throw canvasError(503, 'BUILTIN_MEDIA_UNAVAILABLE', 'Ảnh của mẫu chưa sẵn sàng.');
  return { ...spec, bytes };
}
export function builtinCoverImages() {
  return new Map(Object.keys(EVENT_MEDIA).map(id => {
    const media = builtinMedia(id);
    return [id, { url: `data:image/webp;base64,${media.bytes.toString('base64')}`, width: media.width, height: media.height }];
  }));
}
export function materializeBuiltinMedia(document, { ownerId, designId, mediaRoot, createdAt }) {
  const assets = [];
  for (const ref of document.assets) {
    const original = ref.assetId, media = builtinMedia(original);
    if (!media) continue;
    const id = randomUUID(), storageKey = `${id}.webp`;
    fs.mkdirSync(mediaRoot, { recursive: true });
    // Metadata and refs commit together in the existing repository transaction.
    // Uncommitted bytes are retained for reconciliation, like normal uploads.
    fs.writeFileSync(path.join(mediaRoot, storageKey), media.bytes, { flag: 'wx' });
    assets.push({ id, ownerId, designId, status: 'ready', mime: 'image/webp', bytes: media.bytes.length,
      width: media.width, height: media.height, contentHash: `sha256:${media.sha256}`, storageKey, createdAt });
    ref.assetId = id;
    for (const element of document.elements) if (element.type === 'image' && element.props.assetId === original) element.props.assetId = id;
  }
  return assets;
}
