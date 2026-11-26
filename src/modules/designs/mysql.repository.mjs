import { MySqlClient } from "../../infrastructure/mysql/client.mjs";
import { mysqlDate } from "../identity/mysql.repositories.mjs";
import { jsonValue, iso, designFromRow } from "./mysql-row-mapping.mjs";
import { canvasError, canvasTransaction, lockOwner, lockedDesign, sameRequest, sameRevision, ensureAssets, insertDesignAssetRefs } from "./mysql-transaction.mjs";
import * as assetsModule from "./mysql-assets.mjs";
import * as contexts from "./mysql-contexts.mjs";

// Giữ export cũ cho script import database, test và consumer hiện hữu.
export { jsonValue, iso, designFromRow, assetFromRow } from "./mysql-row-mapping.mjs";
export { canvasError, canvasTransaction, lockOwner, lockedDesign, sameRequest, sameRevision, ensureAssets } from "./mysql-transaction.mjs";

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
  async create(ownerId, mutationId, requestHash, design, assets = [], precondition) {
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
      if (precondition) {
        const source = await lockedDesign(tx, ownerId, precondition.id);
        sameRevision(source, precondition.expectedRevision, precondition.expectedDocumentHash);
        for (const item of precondition.templates || []) {
          const [rows] = await tx.execute('SELECT price_vnd,status,creator_id FROM templates WHERE id=? FOR SHARE',[item.id]);
          if(rows.length!==1 || rows[0].status!=='published' || Number(rows[0].price_vnd)!==item.price || rows[0].creator_id!==null) throw canvasError(409,'RESTYLE_TARGET_CHANGED','Quyền hoặc giá mẫu đã đổi. Xem lại trước khi tạo bản mới.');
        }
        for (const item of precondition.libraryRevisions || []) {
          const [rows] = await tx.execute("SELECT revision,status FROM canvas_library_items WHERE kind='template' AND id=? FOR SHARE",[item.id]);
          if(rows.length!==1 || rows[0].status!=='active' || Number(rows[0].revision)!==item.revision) throw canvasError(409,'RESTYLE_TARGET_CHANGED','Phiên bản thư viện đã đổi. Xem lại trước khi tạo bản mới.');
        }
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
      for (const asset of assets) await assetsModule.insertAssetRow(tx, ownerId, design.id, asset);
      await ensureAssets(
        tx,
        ownerId,
        (design.document.assets || []).map((a) => a.assetId),
      );
      await insertDesignAssetRefs(tx, design.id, (design.document.assets || []).map(asset => asset.assetId));
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
      await insertDesignAssetRefs(tx, id, [...new Set(input.assetIds || [])]);
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
  async insertAsset(ownerId, designId, asset, options = {}) {
    return assetsModule.insertAsset(this.client, ownerId, designId, asset, options);
  }
  async requireAudio() {
    return assetsModule.requireAudio(this.client);
  }
  async getAsset(ownerId, assetId) {
    return assetsModule.getAsset(this.client, ownerId, assetId);
  }
  async attachContext(ownerId, orderId, mutationId, requestHash, context) {
    return contexts.attachContext(this.client, ownerId, orderId, mutationId, requestHash, context);
  }
  async listContexts(ownerId, orderId) {
    return contexts.listContexts(this.client, ownerId, orderId);
  }
  async getContext(ownerId, orderId, contextId) {
    return contexts.getContext(this.client, ownerId, orderId, contextId);
  }
  async close() {
    await this.client.close();
  }
}
