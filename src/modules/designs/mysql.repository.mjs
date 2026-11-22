import { MySqlClient } from "../../infrastructure/mysql/client.mjs";
import { HttpError } from "../../shared/http.mjs";
import { mysqlDate } from "../identity/mysql.repositories.mjs";

export const jsonValue = (value) =>
  typeof value === "string" ? JSON.parse(value) : value;
export function iso(value) {
  if (value == null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(
        `${String(value).replace(" ", "T").replace(/Z$/, "")}Z`,
      ).toISOString();
}
export function canvasError(status, code, message, details) {
  return Object.assign(new HttpError(status, message), {
    code,
    ...(details ? { details } : {}),
  });
}
export function designFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    source:
      row.source_kind === "blank"
        ? { kind: "blank" }
        : {
            kind: "template",
            templateId: row.template_id,
            templateVersionId: row.template_version_id,
          },
    provenance: jsonValue(row.provenance),
    policy: jsonValue(row.policy),
    revision: Number(row.revision),
    schemaVersion: Number(row.schema_version),
    document: jsonValue(row.document),
    documentHash: row.document_hash,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    archivedAt: iso(row.archived_at),
  };
}
export function assetFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    designId: row.design_id,
    status: row.status,
    mime: row.mime,
    bytes: Number(row.bytes),
    width: Number(row.width),
    height: Number(row.height),
    contentHash: row.content_hash,
    storageKey: row.storage_key,
    createdAt: iso(row.created_at),
  };
}
function contextFromRow(row) {
  if (!row) return null;
  return {
    contextId: row.context_id,
    ownerId: row.owner_id,
    orderId: row.order_id,
    mutationId: row.mutation_id,
    requestHash: row.request_hash,
    designId: row.design_id,
    designRevision: Number(row.design_revision),
    documentHash: row.document_hash,
    source: {
      kind: "template",
      templateId: row.template_id,
      templateVersionId: row.template_version_id,
    },
    resumePath: `/design/${row.design_id}`,
    createdAt: iso(row.created_at),
  };
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

export class MySqlDesignsRepository {
  constructor(client = new MySqlClient()) {
    this.client = client;
    this.mode = "mysql";
  }
  async ready() {
    const [rows] = await this.client.execute(
      "SELECT version FROM schema_migrations WHERE version='006_canvas'",
    );
    if (!rows.length)
      throw canvasError(
        503,
        "CANVAS_MIGRATION_REQUIRED",
        "Canvas cần migration 006 đã được kiểm chứng.",
      );
    const [lossless] = await this.client.execute("SELECT version FROM schema_migrations WHERE version='012_canvas_lossless_json'");
    if (!lossless.length)
      throw canvasError(503, 'CANVAS_MIGRATION_REQUIRED', 'Canvas cần migration 012 để lưu chính xác tọa độ và mã kiểm tra tài liệu.');
    await this.client.execute("SELECT id, document_hash FROM designs LIMIT 0");
    // A migration ledger row alone is insufficient after interrupted DDL or a
    // partial restore. Verify every relation used by the publication boundary.
    for (const sql of [
      'SELECT owner_id,mutation_id,request_hash,design_id FROM design_create_requests LIMIT 0',
      'SELECT design_id,owner_id,mutation_id,response FROM design_mutations LIMIT 0',
      'SELECT id,design_id,revision,document_hash,document FROM design_versions LIMIT 0',
      'SELECT id,owner_id,design_id,status,storage_key FROM design_assets LIMIT 0',
      'SELECT design_id,asset_id FROM design_asset_refs LIMIT 0',
      'SELECT gift_id,asset_id FROM gift_asset_refs LIMIT 0',
      'SELECT owner_id,idempotency_key,request_hash,gift_id FROM gift_publication_requests LIMIT 0',
      'SELECT context_id,owner_id,order_id,design_id,mutation_id,request_hash FROM checkout_design_contexts LIMIT 0',
      'SELECT source_kind,design_version_id,template_id FROM gifts LIMIT 0',
    ]) await this.client.execute(sql);
  }
  async list(ownerId, { offset = 0, limit = 50 } = {}) {
    const [rows] = await this.client.execute(
      "SELECT id,title,source_kind,revision,created_at,updated_at FROM designs WHERE owner_id=? AND archived_at IS NULL AND NOT (JSON_UNQUOTE(JSON_EXTRACT(provenance,'$.purpose')) <=> 'creator') ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?",
      [ownerId, limit, offset],
    );
    return rows.map(row => ({ id: row.id, title: row.title, source: { kind: row.source_kind }, revision: Number(row.revision), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }));
  }
  async get(ownerId, id) {
    const [rows] = await this.client.execute(
      "SELECT * FROM designs WHERE id=? AND owner_id=? AND archived_at IS NULL LIMIT 1",
      [id, ownerId],
    );
    return designFromRow(rows[0]);
  }
  async create(ownerId, mutationId, requestHash, design, assets = []) {
    return canvasTransaction(this.client, async (tx) => {
      await lockOwner(tx, ownerId);
      const [requests] = await tx.execute(
        "SELECT * FROM design_create_requests WHERE owner_id=? AND mutation_id=? FOR UPDATE",
        [ownerId, mutationId],
      );
      if (requests.length) {
        sameRequest(requests[0].request_hash, requestHash);
        const [rows] = await tx.execute(
          "SELECT * FROM designs WHERE id=? AND owner_id=?",
          [requests[0].design_id, ownerId],
        );
        return { design: designFromRow(rows[0]), replayed: true };
      }
      await tx.execute(
        `INSERT INTO designs
        (id,owner_id,title,source_kind,template_id,template_version_id,provenance,policy,revision,schema_version,document,document_hash,created_at,updated_at,archived_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
        [
          design.id,
          ownerId,
          design.title,
          design.source.kind,
          design.source.templateId || null,
          design.source.templateVersionId || null,
          JSON.stringify(design.provenance),
          JSON.stringify(design.policy),
          design.revision,
          design.schemaVersion || design.document.schemaVersion,
          JSON.stringify(design.document),
          design.documentHash,
          mysqlDate(design.createdAt),
          mysqlDate(design.updatedAt),
        ],
      );
      for (const asset of assets) await insertAssetRow(tx, ownerId, design.id, asset);
      await ensureAssets(
        tx,
        ownerId,
        (design.document.assets || []).map((a) => a.assetId),
      );
      for (const asset of design.document.assets || [])
        await tx.execute(
          "INSERT INTO design_asset_refs(design_id,asset_id) VALUES (?,?)",
          [design.id, asset.assetId],
        );
      await tx.execute(
        "INSERT INTO design_create_requests(owner_id,mutation_id,request_hash,design_id) VALUES (?,?,?,?)",
        [ownerId, mutationId, requestHash, design.id],
      );
      return { design, replayed: false };
    });
  }
  async findCreate(ownerId, mutationId, requestHash) {
    const [requests] = await this.client.execute('SELECT request_hash,design_id FROM design_create_requests WHERE owner_id=? AND mutation_id=?', [ownerId, mutationId]);
    if (!requests.length) return null;
    sameRequest(requests[0].request_hash, requestHash);
    const [rows] = await this.client.execute('SELECT * FROM designs WHERE id=? AND owner_id=?', [requests[0].design_id, ownerId]);
    if (!rows.length) throw canvasError(409, 'CREATE_RESULT_UNAVAILABLE', 'Không tìm thấy kết quả tạo nháp đã ghi nhận.');
    return { design: designFromRow(rows[0]), replayed: true };
  }
  async save(ownerId, id, input, validateCurrent = () => {}) {
    return canvasTransaction(this.client, async (tx) => {
      const design = await lockedDesign(tx, ownerId, id);
      const [mutations] = await tx.execute(
        "SELECT request_hash,response FROM design_mutations WHERE design_id=? AND owner_id=? AND mutation_id=? FOR UPDATE",
        [id, ownerId, input.mutationId],
      );
      if (mutations.length) {
        sameRequest(mutations[0].request_hash, input.requestHash);
        return { ...jsonValue(mutations[0].response), replayed: true };
      }
      sameRevision(design, input.expectedRevision);
      if (design.revision >= 4294967294)
        throw canvasError(
          409,
          "REVISION_LIMIT",
          "Thiết kế đã đạt giới hạn revision kỹ thuật.",
        );
      await validateCurrent(design);
      await ensureAssets(tx, ownerId, input.assetIds || []);
      const [result] = await tx.execute(
        `UPDATE designs SET title=?,document=?,document_hash=?,schema_version=?,revision=revision+1,updated_at=UTC_TIMESTAMP(3)
        WHERE id=? AND owner_id=? AND revision=? AND archived_at IS NULL`,
        [
          input.title,
          JSON.stringify(input.document),
          input.documentHash,
          input.document.schemaVersion,
          id,
          ownerId,
          input.expectedRevision,
        ],
      );
      if (result.affectedRows !== 1)
        throw canvasError(409, "REVISION_CONFLICT", "Thiết kế đã thay đổi.");
      await tx.execute("DELETE FROM design_asset_refs WHERE design_id=?", [id]);
      for (const assetId of [...new Set(input.assetIds || [])])
        await tx.execute(
          "INSERT INTO design_asset_refs(design_id,asset_id) VALUES (?,?)",
          [id, assetId],
        );
      const ack = {
        designId: id,
        mutationId: input.mutationId,
        savedRevision: design.revision + 1,
        documentHash: input.documentHash,
        replayed: false,
      };
      await tx.execute(
        "INSERT INTO design_mutations(design_id,owner_id,mutation_id,request_hash,response) VALUES (?,?,?,?,?)",
        [id, ownerId, input.mutationId, input.requestHash, JSON.stringify(ack)],
      );
      return ack;
    });
  }
  async archive(ownerId, id) {
    return canvasTransaction(this.client, async (tx) => {
      await lockedDesign(tx, ownerId, id);
      await tx.execute(
        "UPDATE designs SET archived_at=UTC_TIMESTAMP(3) WHERE id=? AND owner_id=?",
        [id, ownerId],
      );
    });
  }
  async insertAsset(ownerId, designId, asset) {
    return canvasTransaction(this.client, async (tx) => {
      await lockedDesign(tx, ownerId, designId);
      await insertAssetRow(tx, ownerId, designId, asset);
      return asset;
    });
  }
  async getAsset(ownerId, assetId) {
    const [rows] = await this.client.execute(
      "SELECT * FROM design_assets WHERE id=? AND owner_id=? LIMIT 1",
      [assetId, ownerId],
    );
    return assetFromRow(rows[0]);
  }
  async attachContext(ownerId, orderId, mutationId, requestHash, context) {
    return canvasTransaction(this.client, async (tx) => {
      await lockOwner(tx, ownerId);
      const design = await lockedDesign(tx, ownerId, context.designId);
      const [requests] = await tx.execute(
        "SELECT * FROM checkout_design_contexts WHERE owner_id=? AND order_id=? AND mutation_id=? FOR UPDATE",
        [ownerId, orderId, mutationId],
      );
      if (requests.length) {
        sameRequest(requests[0].request_hash, requestHash);
        return { ...contextFromRow(requests[0]), replayed: true };
      }
      const [orders] = await tx.execute(
        "SELECT id,user_id,template_id FROM orders WHERE id=? AND user_id=? FOR UPDATE",
        [orderId, ownerId],
      );
      if (!orders.length)
        throw canvasError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
      sameRevision(design, context.designRevision, context.documentHash);
      if (
        design.source.kind !== "template" ||
        orders[0].template_id !== design.source.templateId
      )
        throw canvasError(
          409,
          "CONTEXT_SOURCE_MISMATCH",
          "Đơn hàng không khớp nguồn thiết kế.",
        );
      await tx.execute(
        `INSERT INTO checkout_design_contexts
        (context_id,owner_id,order_id,design_id,design_revision,document_hash,template_id,template_version_id,mutation_id,request_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          context.contextId,
          ownerId,
          orderId,
          design.id,
          design.revision,
          design.documentHash,
          design.source.templateId,
          design.source.templateVersionId,
          mutationId,
          requestHash,
        ],
      );
      return { ...context, replayed: false };
    });
  }
  async listContexts(ownerId, orderId) {
    const [rows] = await this.client.execute(
      `SELECT c.* FROM checkout_design_contexts c
      JOIN orders o ON o.id=c.order_id AND o.user_id=c.owner_id
      WHERE c.owner_id=? AND c.order_id=? ORDER BY c.created_at,c.context_id LIMIT 200`,
      [ownerId, orderId],
    );
    return rows.map(contextFromRow);
  }
  async getContext(ownerId, orderId, contextId) {
    const [rows] = await this.client.execute(
      `SELECT c.* FROM checkout_design_contexts c
      JOIN orders o ON o.id=c.order_id AND o.user_id=c.owner_id
      WHERE c.owner_id=? AND c.order_id=? AND c.context_id=? LIMIT 1`,
      [ownerId, orderId, contextId],
    );
    return contextFromRow(rows[0]);
  }
  async close() {
    await this.client.close();
  }
}

async function insertAssetRow(tx, ownerId, designId, asset) {
  await tx.execute(`INSERT INTO design_assets(id,owner_id,design_id,status,mime,bytes,width,height,content_hash,storage_key,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [asset.id, ownerId, designId, asset.status, asset.mime, asset.bytes,
    asset.width, asset.height, asset.contentHash, asset.storageKey, mysqlDate(asset.createdAt)]);
}
