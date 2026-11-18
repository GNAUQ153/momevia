import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateDocument, canonicalStringify, createDocument, duplicateDocument, assetIds, publicDocument } from '../../../web/js/shared/canvas/index.js';
import { randomId } from '../../shared/security.mjs';
import { canvasError, fields, owned, revision, uuid } from './errors.mjs';
import { createGiftAccess, giftStatus } from '../gifts/access.mjs';

export const hash = value => `sha256:${createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
const copy = value => structuredClone(value);
function title(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw canvasError(422, 'INVALID_TITLE', 'Tên thiết kế từ 1–120 ký tự.');
  return value.trim();
}
export function designView(d) {
  return { id: d.id, title: d.title, source: copy(d.source), policy: copy(d.policy), purpose: d.provenance?.purpose, revision: d.revision, schemaVersion: d.document.schemaVersion, document: copy(d.document), documentHash: d.documentHash, createdAt: d.createdAt, updatedAt: d.updatedAt };
}
export const designSummary = d => ({ id: d.id, title: d.title, revision: d.revision, sourceKind: d.source.kind, updatedAt: d.updatedAt, createdAt: d.createdAt });
export function giftSummary(gift) {
  return { id: gift.id, slug: gift.slug, title: gift.title || gift.templateTitle, templateId: gift.templateId, templateTitle: gift.title || gift.templateTitle,
    theme: gift.theme, recipientName: gift.recipientName, senderName: gift.senderName, replyCount: gift.replyCount,
    createdAt: gift.createdAt, expiresAt: gift.expiresAt, status: giftStatus(gift) };
}
export function publicGiftView(gift) {
  const base = { ...giftSummary(gift), message: gift.message, photoUrl: gift.imageFile ? `/api/gifts/gifts/${gift.slug}/photo` : null };
  if (gift.documentSnapshot) {
    base.runtimeVersion = gift.runtimeVersion; base.schemaVersion = gift.documentSnapshot.schemaVersion;
    base.documentSnapshot = publicDocument(gift.documentSnapshot);
  }
  return base;
}
export class DesignsService {
  constructor({ repository, publication, catalog, checkout, orders, config, flags, mediaRoot, profile }) {
    Object.assign(this, { repository, publication, catalog, checkout, orders, config, flags, mediaRoot, profile });
  }
  requireEdit() { if (!this.flags.edit) throw canvasError(503, 'CANVAS_EDIT_DISABLED', 'Tạo và chỉnh thiết kế đang tạm tắt. Quà đã gửi vẫn đọc được.'); }
  async get(user, id) {
    uuid(id, 'designId'); const d = owned(await this.repository.get(user.sub, id));
    if (d.provenance?.purpose === 'creator' && !['creator', 'admin'].includes(user.role))
      throw canvasError(403, 'CREATOR_REQUIRED', 'Thiết kế này thuộc Creator Studio.');
    return d;
  }
  async list(user, offset = 0, limit = 50) { return (await this.repository.list(user.sub, { offset, limit })).map(designSummary); }
  async source(input) {
    fields(input, ['kind', 'templateId', 'templateVersionId']);
    if (input.kind === 'blank') { fields(input, ['kind']); return { source: { kind: 'blank' }, provenance: { adapter: 'blank' } }; }
    if (input.kind !== 'template' || typeof input.templateId !== 'string' || !/^[\w-]{1,128}$/.test(input.templateId)) throw canvasError(422, 'INVALID_SOURCE', 'Nguồn thiết kế không hợp lệ.');
    const template = await this.catalog.getTemplate(input.templateId);
    if (template.versionId) {
      const version = await this.catalog.approvedVersion(template.id, input.templateVersionId || template.versionId);
      return { source: { kind: 'template', templateId: template.id, templateVersionId: version.id },
        provenance: { adapter: 'creator-v1', price: template.price }, template, version };
    }
    // Fingerprint an actual legacy preset; this is not an approved Creator TemplateVersion.
    const templateHash = hash({ id: template.id, title: template.title, theme: template.theme, scenes: template.scenes, effect: template.effect, presetDocument: createDocument({ template }) });
    const hex = templateHash.slice(7, 39).split(''); hex[12] = '5'; hex[16] = '8'; const h = hex.join('');
    const templateVersionId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    if (input.templateVersionId && input.templateVersionId !== templateVersionId) throw canvasError(409, 'TEMPLATE_VERSION_CONFLICT', 'Mẫu đã thay đổi. Mở lại mẫu để tiếp tục.');
    return { source: { kind: 'template', templateId: template.id, templateVersionId }, provenance: { adapter: 'legacy-v1', templateHash }, template };
  }
  async create(user, input) {
    this.requireEdit(); fields(input, ['source', 'presetId', 'mutationId', 'title', 'purpose']); uuid(input.mutationId);
    if (input.purpose !== undefined && (input.purpose !== 'creator' || input.source?.kind !== 'blank' || !['creator','admin'].includes(user.role)))
      throw canvasError(403, 'CREATOR_REQUIRED', 'Chỉ Creator được tạo nháp mẫu.');
    const previous = await this.repository.findCreate(user.sub, input.mutationId, hash(input));
    if (previous) return { ...previous, design: designView(previous.design) };
    if (input.presetId !== undefined && !['blank', 'envelope-basic', 'celebration'].includes(input.presetId)) throw canvasError(422, 'INVALID_PRESET', 'Bố cục chưa được hỗ trợ.');
    const resolved = await this.source(input.source);
    const document = validateDocument(resolved.version?.document || createDocument({ presetId: input.presetId || (resolved.template ? 'envelope-basic' : 'blank'), template: resolved.template }));
    const now = new Date().toISOString();
    const id = randomUUID();
    const assets = [];
    let policy = { kind: 'sender-basic', lockedElements: {} };
    if (resolved.version) {
      const mapping = new Map();
      for (const asset of Object.values(resolved.version.assets)) {
        if (!this.assetExists(asset)) throw canvasError(503, 'DEMO_ASSET_UNAVAILABLE', 'Ảnh minh họa của mẫu đang tạm thời không khả dụng.');
        const assetId = randomUUID();
        mapping.set(asset.id, assetId);
        assets.push({ ...asset, id: assetId, ownerId: user.sub, designId: id, createdAt: now });
      }
      for (const ref of document.assets) ref.assetId = mapping.get(ref.assetId);
      for (const element of document.elements) {
        if (element.type === 'image' && element.props.assetId) element.props.assetId = mapping.get(element.props.assetId);
      }
      for (const key of resolved.version.bindings) document.bindings[key].value = '';
      const photoId = resolved.version.photoId;
      policy = { kind: 'creator-template', editableBindings: resolved.version.bindings, photoId,
        lockedElements: Object.fromEntries(document.elements.map(element => [element.id, { editableProps: element.id === photoId ? ['assetId'] : [] }])) };
    }
    const record = { id, ownerId: user.sub, title: title(input.title || (resolved.template ? `Quà từ ${resolved.template.title}` : 'Món quà của tôi')),
      source: resolved.source, provenance: { ...resolved.provenance, ...(input.purpose ? { purpose: input.purpose } : {}) }, policy, revision: 1, schemaVersion: 1,
      document, documentHash: hash(document), createdAt: now, updatedAt: now, archivedAt: null };
    validateDocument(document);
    const result = await this.repository.create(user.sub, input.mutationId, hash(input), record, assets);
    return { ...result, design: designView(result.design) };
  }
  enforcePolicy(current, document) {
    if (current.policy?.kind === 'creator-template') {
      const normalize = input => {
        const comparable = copy(input);
        comparable.assets = [];
        for (const key of current.policy.editableBindings) comparable.bindings[key].value = '';
        const photo = comparable.elements.find(element => element.id === current.policy.photoId);
        if (photo) photo.props.assetId = null;
        return canonicalStringify(comparable);
      };
      if (normalize(current.document) !== normalize(document) || document.assets.length !== assetIds(document).length)
        throw canvasError(403, 'LOCKED_ELEMENT', 'Mẫu chỉ cho chỉnh các vùng cá nhân hóa đã duyệt.');
      return;
    }
    // Locks are authoritative server policy. UI lock toggles cannot relax them.
    for (const [id, rule] of Object.entries(current.policy?.lockedElements || {})) {
      const before = current.document.elements.find(e => e.id === id); const after = document.elements.find(e => e.id === id);
      const permitted = Array.isArray(rule.editableProps) ? rule.editableProps : [];
      if (!before || !after) throw canvasError(403, 'LOCKED_ELEMENT', 'Không được xóa vùng khóa của mẫu.');
      const beforeScene = current.document.scenes.find(scene => scene.elementIds.includes(id));
      const afterScene = document.scenes.find(scene => scene.elementIds.includes(id));
      if (beforeScene?.id !== afterScene?.id) throw canvasError(403, 'LOCKED_ELEMENT', 'Không được chuyển vùng khóa sang cảnh khác.');
      const a = copy(before); const b = copy(after);
      for (const key of permitted) { delete a.props[key]; delete b.props[key]; }
      if (canonicalStringify(a) !== canonicalStringify(b)) throw canvasError(403, 'LOCKED_ELEMENT', 'Vùng này không được phép chỉnh sửa.');
    }
  }
  async assetsFor(ownerId, document, creator = false) {
    for (const id of document.assets.map(a => a.assetId)) {
      const a = await this.repository.getAsset(ownerId, id);
      if (!a || a.status !== 'ready') throw canvasError(422, 'ASSET_NOT_READY', 'Ảnh không thuộc tài khoản hoặc chưa sẵn sàng.', [{ path: `assets.${id}`, code: 'ASSET_NOT_READY' }]);
      if (creator && (await this.repository.get(ownerId, a.designId))?.provenance?.purpose !== 'creator')
        throw canvasError(403, 'PRIVATE_SENDER_ASSET', 'Chỉ ảnh tải từ Creator Studio được dùng để thiết kế mẫu.');
    }
  }
  async save(user, id, input) {
    this.requireEdit(); uuid(id, 'designId'); fields(input, ['expectedRevision', 'mutationId', 'title', 'document']); revision(input.expectedRevision); uuid(input.mutationId);
    if (input.expectedRevision === 0xFFFFFFFF) throw canvasError(409, 'REVISION_LIMIT', 'Revision đã tới giới hạn kỹ thuật. Tạo bản sao để tiếp tục.');
    const document = validateDocument(input.document, { mode: 'draft' }); const name = title(input.title);
    // Validate before adapter; adapter revalidates immutable policy under the same CAS lock.
    const design = await this.get(user, id);
    await this.assetsFor(user.sub, document, design.provenance?.purpose === 'creator');
    return this.repository.save(user.sub, id, { ...input, title: name, document, documentHash: hash(document), requestHash: hash(input), assetIds: assetIds(document) }, current => this.enforcePolicy(current, document));
  }
  async duplicate(user, id, input) {
    this.requireEdit(); fields(input, ['mutationId']); uuid(input.mutationId);
    const previous = await this.repository.findCreate(user.sub, input.mutationId, hash({ duplicateOf: id, ...input }));
    if (previous) return { ...previous, design: designView(previous.design) };
    const current = await this.get(user, id); const document = duplicateDocument(current.document, { idFactory: () => randomUUID() });
    const mapping = new Map(current.document.elements.map((e, i) => [e.id, document.elements[i].id]));
    const policy = copy(current.policy); policy.lockedElements = Object.fromEntries(Object.entries(policy.lockedElements || {}).map(([key, value]) => [mapping.get(key) || key, value]));
    if (policy.photoId) policy.photoId = mapping.get(policy.photoId);
    const now = new Date().toISOString();
    const record = { ...copy(current), id: randomUUID(), title: title(`${current.title.slice(0, 108)} (bản sao)`), document, documentHash: hash(document), revision: 1, policy, createdAt: now, updatedAt: now, archivedAt: null };
    await this.assetsFor(user.sub, document);
    const result = await this.repository.create(user.sub, input.mutationId, hash({ duplicateOf: id, ...input }), record);
    return { ...result, design: designView(result.design) };
  }
  async check(design, { getAsset = id => this.repository.getAsset(design.ownerId, id), hasLicense = (owner, template) => this.checkout.hasLicense(owner, template), getTemplate = id => this.catalog.getTemplate(id) } = {}) {
    if (design.provenance?.purpose === 'creator') throw canvasError(403, 'CREATOR_DRAFT', 'Gửi bản mẫu qua Creator Studio để Admin duyệt.');
    const blockers = []; let authorization = { status: 'allowed', reasonCodes: [] }; let template = null;
    try { validateDocument(design.document, { mode: 'publish' }); } catch (error) { blockers.push(...(error.details || [{ path: 'document', code: 'INVALID_DOCUMENT', message: error.message }])); }
    // Apply this rule to new publications. Existing gift snapshots use the reader's structural validation.
    const { bindings, elements } = design.document;
    const hasContent = elements.some(element => {
      if (element.visible === false || element.opacity === 0) return false;
      if (element.type === 'text') {
        const text = element.props.textBinding ? bindings[element.props.textBinding]?.value : element.props.text;
        return Boolean(text?.trim());
      }
      return element.type !== 'image' || Boolean(element.props.assetId);
    });
    if (!hasContent) blockers.push({ path: 'document.elements', code: 'EMPTY_DESIGN', message: 'Thiết kế chưa có nội dung hiển thị. Hãy chèn lời chúc, thêm ảnh hoặc hiện một lớp trước khi xuất bản.' });
    if (design.source.kind === 'template') {
      try {
        template = design.provenance?.adapter === 'creator-v1'
          ? { id: design.source.templateId, title: design.title, price: design.provenance.price, status: 'published' }
          : await getTemplate(design.source.templateId);
        if (template?.price > 0 && this.profile.mode && this.profile.checkoutMode && this.profile.mode !== this.profile.checkoutMode) throw canvasError(503, 'CHECKOUT_PROFILE_UNSUPPORTED', 'Quyền mẫu trả phí cần Checkout cùng profile dữ liệu.');
        if (!template || template.status === 'rejected') authorization = { status: 'denied', reasonCodes: ['TEMPLATE_UNAVAILABLE'] };
        else if (template.price > 0 && !await hasLicense(design.ownerId, design.source.templateId)) authorization = { status: 'needs_template_license', reasonCodes: ['TEMPLATE_LICENSE_REQUIRED'] };
      } catch (error) {
        if (error.status === 404) authorization = { status: 'denied', reasonCodes: ['TEMPLATE_UNAVAILABLE'] };
        else throw Object.assign(canvasError(503, 'AUTHORIZATION_UNAVAILABLE', 'Không kiểm tra được quyền mẫu. Thử lại sau.', [{ path: 'authorization', status: 'unavailable' }]), { authorization: { status: 'unavailable', reasonCodes: [error.code || 'AUTHORIZATION_UNAVAILABLE'] } });
      }
    }
    for (const id of assetIds(design.document)) {
      const a = await getAsset(id);
      if (!a || a.ownerId !== design.ownerId || a.status !== 'ready' || !this.assetExists(a)) blockers.push({ path: `assets.${id}`, code: 'ASSET_NOT_READY', message: 'Ảnh chưa sẵn sàng.' });
    }
    if (authorization.status !== 'allowed') blockers.push({ path: 'source', code: authorization.reasonCodes[0], message: 'Thiết kế chưa có quyền xuất bản.' });
    const values = design.document.bindings;
    for (const [key, max] of [['recipientName', 60], ['senderName', 60], ['message', 1000]]) {
      const v = values[key]?.value;
      if (typeof v !== 'string' || !v.trim() || v.length > max) blockers.push({ path: `bindings.${key}`, code: 'BINDING_REQUIRED', message: `Nhập ${key} (tối đa ${max} ký tự).` });
    }
    return { designId: design.id, revision: design.revision, documentHash: hash(design.document), authorization, canPublish: authorization.status === 'allowed' && blockers.length === 0,
      blockers, warnings: [], summary: { sceneCount: design.document.scenes.length, assetCount: assetIds(design.document).length }, ...(template ? { template: { id: template.id, title: template.title, price: template.price } } : {}) };
  }
  assetPath(asset) {
    if (!/^[\da-f-]{36}\.(png|jpg|webp)$/.test(asset.storageKey)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy ảnh.');
    return path.join(this.mediaRoot, asset.storageKey);
  }
  assetExists(asset) { return fs.existsSync(this.assetPath(asset)); }
  async preflight(user, id, input) {
    fields(input, ['expectedRevision']); revision(input.expectedRevision); const d = await this.get(user, id);
    if (d.revision !== input.expectedRevision) throw canvasError(409, 'REVISION_CONFLICT', 'Thiết kế đã thay đổi. Tải lại để kiểm tra bản mới.');
    return this.check(d);
  }
  requireProfile() {
    if (!this.profile.supported) throw canvasError(503, 'CANVAS_PROFILE_UNSUPPORTED', 'Cấu hình storage canvas chưa đồng nhất; xuất bản đang bị chặn.');
    if (!this.flags.publish) throw canvasError(503, 'CANVAS_PUBLISH_DISABLED', 'Xuất bản thiết kế đang tạm tắt.');
  }
  async publish(user, input) {
    this.requireProfile(); fields(input, ['designId', 'expectedRevision', 'expectedDocumentHash', 'idempotencyKey', 'access']); uuid(input.designId, 'designId'); uuid(input.idempotencyKey, 'idempotencyKey'); revision(input.expectedRevision);
    if (!/^sha256:[a-f0-9]{64}$/.test(input.expectedDocumentHash || '')) throw canvasError(422, 'INVALID_HASH', 'Document hash không hợp lệ.');
    return this.publication.publish(user.sub, input, hash(input), async context => {
      const d = context.design;
      const actualHash = hash(validateDocument(d.document, { mode: 'draft' }));
      if (actualHash !== input.expectedDocumentHash) throw canvasError(409, 'DOCUMENT_HASH_CONFLICT', 'Nội dung không khớp revision yêu cầu.');
      const p = await this.check(d, context);
      if (!p.canPublish) throw canvasError(p.authorization.status === 'needs_template_license' ? 402 : p.authorization.status === 'denied' ? 403 : 422, 'PUBLISH_BLOCKED', 'Thiết kế chưa đủ điều kiện xuất bản.', p.blockers);
      const document = publicDocument(d.document); const now = new Date().toISOString(); const versionId = randomUUID();
      const gift = { id: randomUUID(), slug: randomId(24), userId: user.sub, title: d.title, templateTitle: d.title,
        templateId: d.source.kind === 'template' ? d.source.templateId : null, templateVersionId: d.source.templateVersionId, sourceKind: d.source.kind, designVersionId: versionId,
        theme: 'violet', recipientName: d.document.bindings.recipientName.value, senderName: d.document.bindings.senderName.value, message: d.document.bindings.message.value,
        imageFile: null, replyCount: 0, createdAt: now, expiresAt: new Date(Date.now() + this.config.giftTtlDays * 86400000).toISOString(),
        documentSnapshot: document, runtimeVersion: 1, assetIds: assetIds(document), ...createGiftAccess(input.access) };
      const version = { id: versionId, designId: d.id, revision: d.revision, schemaVersion: 1, runtimeVersion: 1, documentHash: actualHash, document, createdAt: now };
      return { gift, version, assetIds: gift.assetIds };
    });
  }
  async order(user, id) {
    const orders = await this.orders(user); const order = orders.find(o => o.id === id);
    if (!order) throw canvasError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy giao dịch.'); return order;
  }
  contextView(c) { return { contextId: c.contextId, orderId: c.orderId, designId: c.designId, designRevision: c.designRevision, documentHash: c.documentHash, source: c.source, resumePath: `/design/${c.designId}`, replayed: Boolean(c.replayed) }; }
  async attachContext(user, orderId, input) {
    fields(input, ['designId', 'expectedRevision', 'expectedDocumentHash', 'mutationId']); uuid(input.mutationId); revision(input.expectedRevision);
    const order = await this.order(user, orderId);
    const prior = (await this.repository.listContexts(user.sub, orderId)).find(c => c.mutationId === input.mutationId);
    if (prior) {
      if (prior.requestHash !== hash(input)) throw canvasError(409, 'IDEMPOTENCY_CONFLICT', 'Context đã dùng cho nội dung khác.');
      return this.contextView({ ...prior, replayed: true });
    }
    const d = await this.get(user, input.designId);
    if (d.source.kind !== 'template' || d.source.templateId !== order.templateId) throw canvasError(409, 'CONTEXT_SOURCE_MISMATCH', 'Giao dịch không khớp mẫu của thiết kế.');
    if (d.revision !== input.expectedRevision || d.documentHash !== input.expectedDocumentHash) throw canvasError(409, 'REVISION_CONFLICT', 'Lưu và kiểm tra lại thiết kế trước khi thanh toán.');
    const record = { contextId: randomUUID(), orderId, designId: d.id, designRevision: d.revision, documentHash: d.documentHash, source: copy(d.source), createdAt: new Date().toISOString() };
    return this.contextView(await this.repository.attachContext(user.sub, orderId, input.mutationId, hash(input), record));
  }
  async contexts(user, orderId) {
    await this.order(user, orderId);
    return Promise.all((await this.repository.listContexts(user.sub, orderId)).map(async c => { const d = await this.repository.get(user.sub, c.designId); return { ...this.contextView(c), title: d?.title || 'Thiết kế đã lưu', available: Boolean(d) }; }));
  }
  async context(user, orderId, contextId) {
    await this.order(user, orderId); const c = await this.repository.getContext(user.sub, orderId, contextId);
    if (!c) throw canvasError(404, 'CONTEXT_NOT_FOUND', 'Không tìm thấy context thiết kế.');
    const d = await this.get(user, c.designId);
    return { ...this.contextView(c), currentRevision: d.revision, changed: d.revision !== c.designRevision || d.documentHash !== c.documentHash };
  }
}
