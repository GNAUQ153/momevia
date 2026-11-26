import { HttpError } from "../../shared/http.mjs";
import { designFromRow, assetFromRow } from "./mysql-row-mapping.mjs";

// Giữ nguyên hợp đồng lỗi SQL, thứ tự khóa và điều kiện retry.
export function canvasError(status, code, message, details) {
  return Object.assign(new HttpError(status, message), {
    code,
    ...(details ? { details } : {}),
  });
}
export async function lockedDesign(tx, ownerId, id) {
  const [rows] = await tx.execute(
    "SELECT * FROM designs WHERE id=? AND owner_id=? AND archived_at IS NULL FOR UPDATE",
    [id, ownerId],
  );
  if (!rows.length)
    throw canvasError(404, "DESIGN_NOT_FOUND", "Không tìm thấy thiết kế.");
  return designFromRow(rows[0]);
}
export function sameRequest(actual, expected) {
  if (actual !== expected)
    throw canvasError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "Mã yêu cầu đã được dùng cho nội dung khác.",
    );
}
export function sameRevision(design, expectedRevision, expectedDocumentHash) {
  if (
    design.revision !== expectedRevision ||
    (expectedDocumentHash && design.documentHash !== expectedDocumentHash)
  ) {
    throw canvasError(
      409,
      "REVISION_CONFLICT",
      "Thiết kế đã thay đổi. Giữ bản cục bộ và tải lại để đối chiếu.",
      { revision: design.revision, documentHash: design.documentHash },
    );
  }
}
// Only retry rolled-back InnoDB deadlocks/lock timeouts; callback must have no
// filesystem/provider side effects. Request and idempotency keys remain fixed.
export async function canvasTransaction(client, work) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.withTransaction(work);
    } catch (error) {
      if (
        attempt >= 2 ||
        !["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)
      )
        throw error;
    }
  }
}
export async function lockOwner(tx, ownerId) {
  const [rows] = await tx.execute(
    "SELECT id FROM users WHERE id=? FOR UPDATE",
    [ownerId],
  );
  if (!rows.length)
    throw canvasError(404, "OWNER_NOT_FOUND", "Không tìm thấy tài khoản.");
}
export async function ensureAssets(tx, ownerId, ids) {
  const assets = [];
  for (const id of [...new Set(ids)].sort()) {
    const [rows] = await tx.execute(
      "SELECT * FROM design_assets WHERE id=? AND owner_id=? FOR UPDATE",
      [id, ownerId],
    );
    const asset = assetFromRow(rows[0]);
    if (!asset || asset.status !== "ready")
      throw canvasError(
        422,
        "ASSET_NOT_READY",
        "Ảnh chưa sẵn sàng hoặc không thuộc tài khoản này.",
        [{ path: "assets", code: "ASSET_NOT_READY", assetId: id }],
      );
    assets.push(asset);
  }
  return assets;
}
