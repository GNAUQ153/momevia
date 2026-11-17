import fs from 'node:fs';
import path from 'node:path';

export const canvasImportMessage = 'Canvas snapshot/asset refs requires versioned canvas backup; legacy import cannot preserve designs, publications or pinned media.';

export function rejectCanvasGifts(gifts = []) {
  if (!Array.isArray(gifts)) return;
  if (gifts.some(gift => gift && (Object.hasOwn(gift, 'documentSnapshot') || Object.hasOwn(gift, 'designVersionId') || ['blank', 'template'].includes(gift.sourceKind)))) throw new Error(canvasImportMessage);
}

export function rejectCanvasAggregate(root) {
  const filename = path.join(root, 'services', 'designs', 'data', 'canvas.json');
  if (!fs.existsSync(filename)) return;
  if (fs.lstatSync(filename).isSymbolicLink()) throw new Error('Refusing symlink canvas aggregate during legacy import.');
  const aggregate = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const collections = ['designs', 'creates', 'mutations', 'assets', 'contexts', 'publications', 'versions', 'replies'];
  if (!aggregate || aggregate.formatVersion !== 1 || Object.keys(aggregate).some(key => key !== 'formatVersion' && !collections.includes(key)) || collections.some(key => !aggregate[key] || typeof aggregate[key] !== 'object' || Array.isArray(aggregate[key]) || Object.keys(aggregate[key]).length)) throw new Error(canvasImportMessage);
}
