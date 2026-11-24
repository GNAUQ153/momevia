import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';
import { CheckoutService } from '../checkout/checkout.service.mjs';
import { activeEntitlementSql } from '../checkout/entitlement-policy.mjs';
import { readPublicationAuthority, consumePublicationCredit } from '../checkout/publication-credit.mjs';
import { localizedError } from '../../shared/http.mjs';
import { requireActiveGift } from '../gifts/access.mjs';
import { canvasTransaction, canvasError, designFromRow, assetFromRow, ensureAssets,
  iso, jsonValue, lockOwner, lockedDesign, sameRequest, sameRevision } from './mysql.repository.mjs';

function giftFromRow(row) {
  if (!row) return null;
  const payload = jsonValue(row.payload) || {};
  return { ...payload, id: row.id, slug: row.slug, userId: row.user_id,
    templateId: row.template_id, sourceKind: row.source_kind, designVersionId: row.design_version_id,
    recipientName: row.recipient_name, senderName: row.sender_name, message: row.message,
    imageFile: row.image_file, replyCount: Number(row.reply_count),
    createdAt: iso(row.created_at), expiresAt: iso(row.expires_at) };
}

// One injected MySqlClient provides exactly one connection for the whole
// boundary. The build callback may only validate/project in memory and use the
// supplied tx facades: no provider, media decode or outside repository calls.
// Lock order: owner -> publication key -> design -> template -> entitlements
// (including joined order) -> assets sorted by ID. Revoke UPDATE takes the same
// entitlement lock: whichever operation obtains it first determines authority.
export class MySqlPublicationUnitOfWork {
  constructor(client = new MySqlClient(), { quotaEnabled = false } = {}) { this.client = client; this.quotaEnabled = quotaEnabled === true; }
  async publish(ownerId, request, requestHash, build) {
    return canvasTransaction(this.client, async tx => {
      await lockOwner(tx, ownerId);
      const [requests] = await tx.execute(`SELECT p.*,g.payload,g.id,g.slug,g.user_id,g.template_id,
        g.source_kind,g.design_version_id,g.recipient_name,g.sender_name,g.message,g.image_file,
        g.reply_count,g.created_at,g.expires_at
        FROM gift_publication_requests p JOIN gifts g ON g.id=p.gift_id
        WHERE p.owner_id=? AND p.idempotency_key=? FOR UPDATE`, [ownerId, request.idempotencyKey]);
      if (requests.length) {
        sameRequest(requests[0].request_hash, requestHash);
        return { gift: giftFromRow(requests[0]), publishedRevision: Number(requests[0].design_revision), replayed: true };
      }
      const design = await lockedDesign(tx, ownerId, request.designId);
      sameRevision(design, request.expectedRevision, request.expectedDocumentHash);
      // The template and entitlement are loaded once and locked before assets.
      let template = null;
      let licensed = true;
      let authority = null;
      if (design.source.kind === 'template') {
        const [templates] = await tx.execute('SELECT * FROM templates WHERE id=? FOR UPDATE', [design.source.templateId]);
        const row = templates[0];
        if (row) template = { ...(jsonValue(row.payload) || {}), id: row.id, creatorId: row.creator_id || 'system',
          title: row.title, style: row.style, theme: row.theme, price: Number(row.price_vnd), status: row.status, createdAt: iso(row.created_at) };
        if (this.quotaEnabled) {
          // Mẫu Creator dùng giá của phiên bản đã ghim, giống preflight; không dùng giá hiện tại để bỏ qua quota.
          if (!template) throw canvasError(404, 'TEMPLATE_NOT_FOUND', 'Mẫu chưa được phát hành.');
          const price = design.provenance?.adapter === 'creator-v1' ? design.provenance.price : template.price;
          if (!Number.isSafeInteger(price) || price < 0)
            throw localizedError(503, 'errors.unavailable');
          if (price > 0) {
            authority = await readPublicationAuthority(tx, ownerId, design.source.templateId, { lock: true });
            licensed = authority.allowed;
            if (!licensed) throw localizedError(402, 'errors.gift.licenseRequired');
          }
        } else {
          const [rights] = await tx.execute(`SELECT e.id FROM template_entitlements e
            INNER JOIN orders o ON o.id=e.order_id
            WHERE e.user_id=? AND e.template_id=? AND ${activeEntitlementSql} FOR UPDATE`, [ownerId, design.source.templateId]);
          licensed = rights.length > 0;
        }
      }
      const lockedAssets = await ensureAssets(tx, ownerId, (design.document.assets || []).map(a => a.assetId));
      const assetsById = new Map(lockedAssets.map(a => [a.id, a]));
      const checkout = new CheckoutService({ repository: {
        hasLicense: async (userId, templateId) => userId === ownerId && templateId === design.source.templateId && licensed,
      } });
      const hasLicense = (userId, templateId) => checkout.hasLicense(userId, templateId);
      const getTemplate = async templateId => {
        if (!template || templateId !== design.source.templateId || template.status !== 'published')
          throw canvasError(404, 'TEMPLATE_NOT_FOUND', 'Mẫu chưa được phát hành.');
        return structuredClone(template);
      };
      const getAsset = async (...args) => {
        const assetId = args.length > 1 ? args[1] : args[0];
        if (args.length > 1 && args[0] !== ownerId) return null;
        return structuredClone(assetsById.get(assetId) || null);
      };
      const result = await build({ design: structuredClone(design), hasLicense, getTemplate, getAsset,
        checkout, catalog: { getTemplate }, assets: { getAsset } });
      const { gift, version } = result;
      const assetIds = [...new Set(result.assetIds || [])].sort();
      if (assetIds.some(id => !assetsById.has(id))) throw canvasError(422, 'ASSET_NOT_READY', 'Ảnh xuất bản chưa được khóa và xác thực.');
      if (version.designId !== design.id || version.revision !== design.revision || version.documentHash !== design.documentHash)
        throw canvasError(409, 'SNAPSHOT_MISMATCH', 'Phiên bản xuất bản không khớp thiết kế đã lưu.');
      if (gift.userId !== ownerId || gift.sourceKind !== design.source.kind || (gift.templateId || null) !== (design.source.templateId || null))
        throw canvasError(409, 'SOURCE_MISMATCH', 'Nguồn xuất bản không khớp thiết kế.');
      const [versions] = await tx.execute('SELECT id,document_hash FROM design_versions WHERE design_id=? AND revision=? FOR UPDATE', [design.id, design.revision]);
      let versionId = version.id;
      if (versions.length) {
        sameRequest(versions[0].document_hash, design.documentHash);
        versionId = versions[0].id;
      } else {
        await tx.execute(`INSERT INTO design_versions(id,design_id,revision,schema_version,runtime_version,document_hash,document,created_at)
          VALUES (?,?,?,?,?,?,?,?)`, [version.id, design.id, design.revision, version.schemaVersion, version.runtimeVersion,
          version.documentHash, JSON.stringify(version.document), mysqlDate(version.createdAt)]);
      }
      const savedGift = { ...gift, designVersionId: versionId };
      await tx.execute(`INSERT INTO gifts
        (id,slug,user_id,template_id,recipient_name,sender_name,message,image_file,reply_count,created_at,expires_at,payload,source_kind,design_version_id)
        VALUES (?,?,?,?,?,?,?,NULL,0,?,?,?,?,?)`, [savedGift.id, savedGift.slug, ownerId, savedGift.templateId || null,
        savedGift.recipientName, savedGift.senderName, savedGift.message, mysqlDate(savedGift.createdAt),
        mysqlDate(savedGift.expiresAt), JSON.stringify(savedGift), design.source.kind, versionId]);
      if (authority) await consumePublicationCredit(tx, authority, savedGift.id);
      for (const assetId of assetIds) await tx.execute('INSERT INTO gift_asset_refs(gift_id,asset_id) VALUES (?,?)', [savedGift.id, assetId]);
      await tx.execute(`INSERT INTO gift_publication_requests(owner_id,idempotency_key,request_hash,design_id,design_revision,gift_id)
        VALUES (?,?,?,?,?,?)`, [ownerId, request.idempotencyKey, requestHash, design.id, design.revision, savedGift.id]);
      return { gift: savedGift, publishedRevision: design.revision, replayed: false };
    });
  }
  async pinnedAsset(slug, assetId) {
    const [rows] = await this.client.execute(`SELECT a.*,g.expires_at,g.payload AS gift_payload FROM gift_asset_refs r
      JOIN gifts g ON g.id=r.gift_id JOIN design_assets a ON a.id=r.asset_id
      WHERE g.slug=? AND r.asset_id=? AND a.status='ready' LIMIT 1`, [slug, assetId]);
    if (!rows.length) return null;
    // Kiểm tra lại trạng thái tại lúc đọc tài nguyên, kể cả khi vừa bị thu hồi.
    requireActiveGift({ ...jsonValue(rows[0].gift_payload), expiresAt: iso(rows[0].expires_at) });
    return assetFromRow(rows[0]);
  }
  async close() { await this.client.close(); }
}

// Exported converters are used only for adapter contract tests and inspection.
export { giftFromRow, designFromRow };
