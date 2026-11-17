import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { decodePhoto } from '../gifts/photo.mjs';
import { canvasError, uuid } from './errors.mjs';

export async function imageBody(req) {
  const mime = req.headers['content-type'];
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw canvasError(415, 'IMAGE_TYPE', 'Chỉ hỗ trợ PNG, JPEG hoặc WebP.');
  const max = 2 * 1024 * 1024;
  if (Number(req.headers['content-length']) > max) throw canvasError(413, 'IMAGE_SIZE', 'Ảnh phải nhỏ hơn 2 MB.');
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > max) throw canvasError(413, 'IMAGE_SIZE', 'Ảnh phải nhỏ hơn 2 MB.'); parts.push(part); }
  return { mime, bytes: Buffer.concat(parts) };
}
function stableAssetId(ownerId, designId, mutationId) {
  const hex = createHash('sha256').update(`${ownerId}:${designId}:${mutationId}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5'; hex[16] = '8'; const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export class AssetsService {
  constructor(designs) { this.designs = designs; }
  view(asset) { return { id: asset.id, assetId: asset.id, status: asset.status, mime: asset.mime, bytes: asset.bytes, width: asset.width, height: asset.height }; }
  async upload(user, designId, mutationId, input) {
    const d = this.designs; d.requireEdit(); uuid(mutationId); await d.get(user, designId);
    // Reuse the existing EXIF/pixel/format validation. No bytes/base64 are saved in a document.
    const decoded = await decodePhoto(`data:${input.mime};base64,${input.bytes.toString('base64')}`);
    const id = stableAssetId(user.sub, designId, mutationId); const contentHash = `sha256:${createHash('sha256').update(decoded.bytes).digest('hex')}`;
    const existing = await d.repository.getAsset(user.sub, id);
    if (existing) {
      if (existing.contentHash !== contentHash) throw canvasError(409, 'ASSET_MUTATION_CONFLICT', 'Mã tải ảnh đã dùng cho ảnh khác.');
      if (d.assetExists(existing)) return this.view(existing);
      // A replay carrying validated bytes can repair an interrupted filesystem restore.
      // The asset ID/hash remains fixed; no publication or reference is changed.
    }
    const meta = await sharp(decoded.bytes).metadata();
    fs.mkdirSync(d.mediaRoot, { recursive: true });
    const storageKey = `${id}.${decoded.ext}`; const stage = path.join(d.mediaRoot, `${id}.${randomUUID()}.staging`); const final = path.join(d.mediaRoot, storageKey);
    fs.writeFileSync(stage, decoded.bytes, { flag: 'wx' });
    try {
      if (fs.existsSync(final)) {
        const existingHash = `sha256:${createHash('sha256').update(fs.readFileSync(final)).digest('hex')}`;
        if (existingHash !== contentHash) throw canvasError(409, 'ASSET_MUTATION_CONFLICT', 'Nội dung ảnh không khớp mã tải ảnh.');
        fs.unlinkSync(stage);
      } else fs.renameSync(stage, final);
      const asset = { id, ownerId: user.sub, designId, status: 'ready', mime: input.mime, bytes: decoded.bytes.length, width: meta.width, height: meta.height,
        contentHash, storageKey, createdAt: new Date().toISOString() };
      try { return this.view(await d.repository.insertAsset(user.sub, designId, asset)); }
      catch (error) {
        const committed = await d.repository.getAsset(user.sub, id);
        if (committed?.contentHash === contentHash) return this.view(committed);
        throw error;
      }
    } finally {
      if (fs.existsSync(stage)) fs.unlinkSync(stage);
      // Never unlink the ready file after a metadata error: another request/publication may reference it.
      // Backup/reconciliation retains orphans; destructive GC is off for this release.
    }
  }
  async owner(user, designId, assetId) {
    await this.designs.get(user, designId); uuid(assetId, 'assetId');
    const asset = await this.designs.repository.getAsset(user.sub, assetId);
    if (!asset || asset.status !== 'ready' || !this.designs.assetExists(asset)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy ảnh.');
    return { filePath: this.designs.assetPath(asset), contentType: asset.mime };
  }
}
