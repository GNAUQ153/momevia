import { mysqlDate } from "../identity/mysql.repositories.mjs";
import { AUDIO_LIMITS } from "../../../web/js/shared/canvas/audio-pcm.js";
import { assetFromRow } from "./mysql-row-mapping.mjs";
import { canvasTransaction, canvasError, lockOwner, lockedDesign } from "./mysql-transaction.mjs";

// Dùng client được truyền vào; không mở pool hoặc transaction lồng nhau.
export async function insertAsset(client, ownerId, designId, asset, {prepare}={}) {
  return canvasTransaction(client, async (tx) => {
    await lockOwner(tx,ownerId);
    await lockedDesign(tx, ownerId, designId);
    const [existing]=await tx.execute('SELECT * FROM design_assets WHERE id=? FOR UPDATE',[asset.id]);
    if(existing.length){const old=assetFromRow(existing[0]);if(old.ownerId!==ownerId||old.contentHash!==asset.contentHash)throw canvasError(409,'ASSET_MUTATION_CONFLICT','Nội dung tải lại không khớp.');await prepare?.();return old;}
    {
      const [[usage]]=await tx.execute("SELECT COALESCE(SUM(bytes),0) bytes FROM design_assets WHERE owner_id=? AND status<>'removed'",[ownerId]);
      if(Number(usage.bytes)+asset.bytes>AUDIO_LIMITS.ownerBytes)throw canvasError(413,'ASSET_QUOTA','Tổng tài sản vượt giới hạn 50 MiB.');
    }
    // Audio prepare only promotes an immutable, hash-checked local stage;
    // replay after rollback is idempotent. No network work is allowed here.
    await prepare?.();await insertAssetRow(tx, ownerId, designId, asset);
    return asset;
  });
}
export async function requireAudio(client) {
  const [rows]=await client.execute("SELECT version FROM schema_migrations WHERE version='014_canvas_audio'");
  if(!rows.length)throw canvasError(503,'CANVAS_MIGRATION_REQUIRED','Tải âm cá nhân cần migration 014_canvas_audio.');
}
export async function getAsset(client, ownerId, assetId) {
  const [rows] = await client.execute(
    "SELECT * FROM design_assets WHERE id=? AND owner_id=? LIMIT 1",
    [assetId, ownerId],
  );
  return assetFromRow(rows[0]);
}

export async function insertAssetRow(tx, ownerId, designId, asset) {
  if(asset.mediaKind==='audio'){
    await tx.execute(`INSERT INTO design_assets(id,owner_id,design_id,status,mime,bytes,width,height,content_hash,storage_key,created_at,media_kind,duration_ms,sample_count,sample_rate,channels)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[asset.id,ownerId,designId,asset.status,asset.mime,asset.bytes,0,0,asset.contentHash,asset.storageKey,mysqlDate(asset.createdAt),'audio',asset.durationMs,asset.sampleCount,asset.sampleRate,asset.channels]);
    return;
  }
  await tx.execute(`INSERT INTO design_assets(id,owner_id,design_id,status,mime,bytes,width,height,content_hash,storage_key,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [asset.id, ownerId, designId, asset.status, asset.mime, asset.bytes,
    asset.width, asset.height, asset.contentHash, asset.storageKey, mysqlDate(asset.createdAt)]);
}
