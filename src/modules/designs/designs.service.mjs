import { SEMANTIC_TEMPLATE_IDS, captureSemanticRoles } from '../../../web/js/shared/canvas/template-slots.js';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateDocument, canonicalStringify, createDocument, duplicateDocument, assetIds, publicDocument } from '../../../web/js/shared/canvas/index.js';
import { runtimeVersionFor, requiresCanvasV2 } from '../../../web/js/shared/canvas/schema.js';
import { PREDICTION_KIND } from '../../../web/js/shared/canvas/prediction.js';
import { photoSlots } from '../../../web/js/shared/canvas/interactions.js';
import { clearTemplateBindingDefaults, lockedVisibleNames, visibleBindingKeys } from '../../../web/js/shared/canvas/personalization.js';
import { cleanGiftLayout } from '../../../web/js/shared/canvas/clean-layout.js';
import { randomId } from '../../shared/security.mjs';
import { canvasError, fields, owned, revision, uuid } from './errors.mjs';
import { createGiftAccess, giftStatus } from '../gifts/access.mjs';
import { serverText } from '../../shared/locale.mjs';
import { isSystemTemplate, templateFieldKey } from '../../../web/js/shared/template-copy.js';
import { materializeBuiltinMedia } from './builtin-media.mjs';
import { EVENT_MEDIA } from '../../../web/js/shared/canvas/event-media.js';
import { libraryEntry, librarySnapshot } from '../../../web/js/shared/canvas/library-state.js';

export const hash = value => `sha256:${createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
const copy = value => structuredClone(value);
const preflightCopy = (path, code, messageKey, messageParams) => ({
  path, code, message: serverText('vi', messageKey, messageParams), messageKey, messageParams,
});
function title(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw canvasError(422, 'INVALID_TITLE', 'Tên thiết kế từ 1–120 ký tự.');
  return value.trim();
}
export function designView(d) {
  const document = copy(d.document);
  const reviewTemplateDefaults = d.source.kind === 'template' && d.source.templateVersionId && d.provenance?.adapter === 'creator-v1'
    && d.policy?.kind === 'creator-template' && clearTemplateBindingDefaults(document, d.policy.editableBindings);
  return { ...(d.provenance?.restyledFrom ? {restyledFrom:copy(d.provenance.restyledFrom)} : {}), id: d.id, title: d.title, source: copy(d.source), policy: copy(d.policy), purpose: d.provenance?.purpose, revision: d.revision, schemaVersion: document.schemaVersion, document, documentHash: d.documentHash,
    ...(reviewTemplateDefaults ? { reviewTemplateDefaults } : {}),
    ...(d.provenance?.startingLocale ? { startingLocale: d.provenance.startingLocale } : {}),
    createdAt: d.createdAt, updatedAt: d.updatedAt };
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
  requireSoundCreate() { if(this.flags.sfxCreate===false)throw canvasError(503,'SFX_CREATE_DISABLED','Tạo âm thanh mới đang tạm tắt. Âm trong quà đã gửi vẫn dùng được.'); }
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
    if (this.profile?.mode === 'mysql' && librarySnapshot()?.items.some(row => row.kind === 'template' && row.id === template.id && row.status !== 'active'))
      throw canvasError(403, 'LIBRARY_TEMPLATE_DISABLED', 'Mẫu bố cục đang tạm tắt trong thư viện.');
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
  async create(user, input, { sourceFor = () => this.source(input.source), requestHash = hash(input), locale } = {}) {
    this.requireEdit(); fields(input, ['source', 'presetId', 'mutationId', 'title', 'purpose', 'trialBindings']); uuid(input.mutationId);
    if (input.purpose !== undefined && (input.purpose !== 'creator' || input.source?.kind !== 'blank' || !['creator','admin'].includes(user.role)))
      throw canvasError(403, 'CREATOR_REQUIRED', 'Chỉ Creator được tạo nháp mẫu.');
    const previous = await this.repository.findCreate(user.sub, input.mutationId, requestHash);
    if (previous) return { ...previous, design: designView(previous.design) };
    await this.library?.refresh();
    if (input.presetId !== undefined && (this.profile?.mode === 'mysql' ? !libraryEntry('preset', input.presetId) : !['blank', 'envelope-basic', 'celebration'].includes(input.presetId))) throw canvasError(422, 'INVALID_PRESET', 'Bố cục chưa được hỗ trợ.');
    const resolved = await sourceFor();
    if (this.profile?.mode === 'mysql' && !resolved.document && !resolved.version && !resolved.template && !libraryEntry('preset', input.presetId || 'blank'))
      throw canvasError(422, 'INVALID_PRESET', 'Bố cục đang tạm tắt trong thư viện.');
    const localize = (key, params) => serverText(locale ?? 'vi', key, params);
    const document = validateDocument(resolved.document || resolved.version?.document || createDocument({
      presetId: input.presetId || (resolved.template ? 'envelope-basic' : 'blank'), template: resolved.template, localize,
    }));
    const now = new Date().toISOString();
    const id = randomUUID();
    const assets = [];
    if (!resolved.version) assets.push(...materializeBuiltinMedia(document, { ownerId: user.sub, designId: id, mediaRoot: this.mediaRoot, createdAt: now }));
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
        if(element.sound?.kind==='audio')element.sound.assetId=mapping.get(element.sound.assetId);
        for (const photo of photoSlots(element)) if (photo.assetId) photo.assetId = mapping.get(photo.assetId);
      }
      clearTemplateBindingDefaults(document);
      const photoId = resolved.version.photoId;
      policy = { kind: 'creator-template', editableBindings: resolved.version.bindings, photoId,
        lockedElements: Object.fromEntries(document.elements.map(element => [element.id, { editableProps: element.id === photoId ? ['assetId'] : [] }])) };
    }
    const templateTitleKey = templateFieldKey(resolved.template, 'title');
    const templateTitle = templateTitleKey ? localize(templateTitleKey) : resolved.template?.title;
    const defaultTitle = templateTitle ? localize('templates.draft.from', { title: templateTitle }).slice(0, 120)
      : localize('templates.draft.untitled');
    if (input.trialBindings !== undefined) {
      fields(input.trialBindings,['recipientName','senderName','message']);
      if (resolved.version || input.purpose) throw canvasError(422,'TRIAL_SOURCE_UNSUPPORTED','Mẫu này không hỗ trợ dữ liệu thử.');
      for (const [key,value] of Object.entries(input.trialBindings)) document.bindings[key].value=value;
      validateDocument(document);
    }
    const record = { id, ownerId: user.sub, title: title(input.title || defaultTitle),
      source: resolved.source, provenance: { ...resolved.provenance, ...(input.purpose ? { purpose: input.purpose } : {}),
        ...(locale && isSystemTemplate(resolved.template) ? { startingLocale: locale } : {}),
        ...(!resolved.document && !resolved.version && SEMANTIC_TEMPLATE_IDS.includes(resolved.source.templateId) ? {slotMap:{templateVersionId:resolved.source.templateVersionId,elements:captureSemanticRoles(document)}} : {}) }, policy, revision: 1, schemaVersion: document.schemaVersion,
      document, documentHash: hash(document), createdAt: now, updatedAt: now, archivedAt: null };
    validateDocument(document);
    const result = await this.repository.create(user.sub, input.mutationId, requestHash, record, assets);
    return { ...result, design: designView(result.design) };
  }
  async regift(user, gift, input) {
    fields(input, ['mutationId']);
    const source = gift.templateId ? { kind: 'template', templateId: gift.templateId, ...(gift.templateVersionId ? { templateVersionId: gift.templateVersionId } : {}) } : { kind: 'blank' };
    return this.create(user, { source, mutationId: input.mutationId }, {
      requestHash: hash({ regift: gift.id, ...input }),
      sourceFor: async () => {
        if (source.kind === 'blank') {
          if (!gift.documentSnapshot) throw canvasError(422, 'LAYOUT_UNAVAILABLE', 'Hãy chọn lại mẫu cho lượt tặng mới.');
          return { source, provenance: { adapter: 'blank' }, document: cleanGiftLayout(gift.documentSnapshot) };
        }
        const previous = source.templateVersionId && await this.catalog.reusableVersion(source.templateId, source.templateVersionId);
        // Approved Creator versions keep their existing version/lock policy. A built-in
        // legacy version is a fingerprint, not an archived Catalog version. Resolve its
        // current authorization without demanding an obsolete fingerprint, then reuse
        // the gift's own layout with personal content removed. Never downgrade a
        // Creator version or an unknown source on a conflict.
        let resolved;
        if (previous) resolved = { source, ...previous, provenance: { adapter: 'creator-v1', price: previous.template.price } };
        else {
          const current = await this.catalog.getTemplate(source.templateId);
          const systemSnapshot = gift.documentSnapshot && current.systemOwned === true && current.creator === 'Momevia Originals'
            && !current.versionId && isSystemTemplate(current);
          resolved = await this.source(systemSnapshot ? { kind: 'template', templateId: source.templateId } : source);
          if (systemSnapshot || (gift.documentSnapshot?.elements.some(e=>e.sound) && !resolved.version)) {
            const sharedImages = new Map();
            for (const ref of gift.documentSnapshot.assets) {
              const asset = await this.repository.getAsset(user.sub, ref.assetId);
              const known = asset?.ownerId === user.sub && asset.status === 'ready'
                && Object.keys(EVENT_MEDIA).find(id => asset.contentHash === `sha256:${EVENT_MEDIA[id].sha256}`);
              if (known) sharedImages.set(ref.assetId, known);
            }
            resolved.document = cleanGiftLayout(gift.documentSnapshot, { sharedImages });
          }
        }
        if (resolved.template.price > 0 && !await this.checkout.hasLicense(user.sub, source.templateId))
          throw canvasError(402, 'TEMPLATE_LICENSE_REQUIRED', 'Cần quyền dùng mẫu còn hiệu lực để tạo lượt tặng mới.');
        return resolved;
      },
    });
  }
  enforcePolicy(current, document) {
    if (current.policy?.kind === 'creator-template') {
      const normalize = input => {
        const comparable = copy(input);
        comparable.assets = [];
        // Nhạc từ danh mục được phép cá nhân hóa, không mở khóa cấu trúc mẫu.
        delete comparable.soundtrack;
        // Với mẫu Canvas V1, chỉ chấp nhận lên V2 nếu thay đổi là nhạc nền.
        if (current.document.schemaVersion === 1 && comparable.schemaVersion === 2 && !requiresCanvasV2(comparable)) {
          comparable.schemaVersion = 1;
          comparable.registryVersion = 1;
        }
        for (const key of current.policy.editableBindings) comparable.bindings[key].value = '';
        const photo = comparable.elements.find(element => element.id === current.policy.photoId);
        if (photo) photo.props.assetId = null;
        return canonicalStringify(comparable);
      };
      const before = copy(current.document);
      clearTemplateBindingDefaults(before, current.policy.editableBindings);
      if (normalize(before) !== normalize(document) || document.assets.length !== assetIds(document).length)
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
      const ref=document.assets.find(ref=>ref.assetId===id);
      if(ref.kind!==(a.mediaKind||'image'))throw canvasError(422,'ASSET_KIND','Kiểu tài sản không khớp nội dung.');
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
    if(this.flags.sfxCreate===false)for(const element of document.elements)if(element.sound&&canonicalStringify(element.sound)!==canonicalStringify(design.document.elements.find(e=>e.id===element.id)?.sound||null))this.requireSoundCreate();
    await this.assetsFor(user.sub, document, design.provenance?.purpose === 'creator');
    return this.repository.save(user.sub, id, { ...input, title: name, document, documentHash: hash(document), requestHash: hash(input), assetIds: assetIds(document) }, current => this.enforcePolicy(current, document));
  }
  async duplicate(user, id, input) {
    this.requireEdit(); fields(input, ['mutationId']); uuid(input.mutationId);
    const previous = await this.repository.findCreate(user.sub, input.mutationId, hash({ duplicateOf: id, ...input }));
    if (previous) return { ...previous, design: designView(previous.design) };
    const current = await this.get(user, id); const document = duplicateDocument(designView(current).document, { idFactory: () => randomUUID() });
    const mapping = new Map(current.document.elements.map((e, i) => [e.id, document.elements[i].id]));
    const policy = copy(current.policy); policy.lockedElements = Object.fromEntries(Object.entries(policy.lockedElements || {}).map(([key, value]) => [mapping.get(key) || key, value]));
    if (policy.photoId) policy.photoId = mapping.get(policy.photoId);
    const now = new Date().toISOString();
    const provenance=copy(current.provenance);
    if(current.policy.kind==='sender-basic' && SEMANTIC_TEMPLATE_IDS.includes(current.source.templateId))provenance.slotMap={templateVersionId:current.source.templateVersionId,elements:captureSemanticRoles(current.document,current.provenance?.slotMap?.elements,mapping)};
    const record = { ...copy(current), provenance, id: randomUUID(), title: title(`${current.title.slice(0, 108)} (bản sao)`), document, documentHash: hash(document), revision: 1, policy, createdAt: now, updatedAt: now, archivedAt: null };
    await this.assetsFor(user.sub, document);
    const result = await this.repository.create(user.sub, input.mutationId, hash({ duplicateOf: id, ...input }), record);
    return { ...result, design: designView(result.design) };
  }
  async check(design, { getAsset = id => this.repository.getAsset(design.ownerId, id), hasLicense = (owner, template) => this.checkout.hasLicense(owner, template), getTemplate = id => this.catalog.getTemplate(id) } = {}) {
    if (design.provenance?.purpose === 'creator') throw canvasError(403, 'CREATOR_DRAFT', 'Gửi bản mẫu qua Creator Studio để Admin duyệt.');
    const blockers = []; let authorization = { status: 'allowed', reasonCodes: [] }; let template = null;
    const { document, reviewTemplateDefaults } = designView(design);
    const editable = design.policy?.kind === 'creator-template' ? design.policy.editableBindings : null;
    if (reviewTemplateDefaults) blockers.push(preflightCopy('document.bindings', 'REVIEW_TEMPLATE_DEFAULTS', 'editor.preflight.reviewDefaults'));
    try { validateDocument(document, { mode: 'publish', requiredBindings: [] }); }
    catch (error) {
      for (const detail of error.details || [{ path: 'document', code: 'INVALID_DOCUMENT', message: error.message }]) {
        const index = /^elements\.(\d+)\.props\.(\w+)$/.exec(detail.path || '');
        if (index && document.elements[Number(index[1])]?.props.kind === PREDICTION_KIND &&
          (index[2] === 'prediction' || ['PREDICTION_CONTENT_REQUIRED', 'PREDICTION_DUPLICATE_CHOICES'].includes(detail.code))) {
          const field = index[2];
          blockers.push(preflightCopy(detail.path, detail.code, detail.code === 'PREDICTION_DUPLICATE_CHOICES' ? 'prediction.duplicate'
            : field === 'prediction' ? 'prediction.chooseRequired' : 'prediction.required',
          { field: { format: 'message', key: `prediction.${field}` } }));
        } else blockers.push(detail);
      }
    }
    // Apply this rule to new publications. Existing gift snapshots use the reader's structural validation.
    const { bindings, elements } = document;
    const hasContent = elements.some(element => {
      if (element.visible === false || element.opacity === 0) return false;
      if (element.type === 'text') {
        const text = element.props.textBinding ? bindings[element.props.textBinding]?.value : element.props.text;
        return Boolean(text?.trim());
      }
      return element.type !== 'image' || Boolean(element.props.assetId || element.props.caption?.trim());
    });
    if (!hasContent) blockers.push(preflightCopy('document.elements', 'EMPTY_DESIGN', 'editor.preflight.empty'));
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
      if (!a || a.ownerId !== design.ownerId || a.status !== 'ready' || !this.assetExists(a))
        blockers.push(preflightCopy(`assets.${id}`, 'ASSET_NOT_READY', 'editor.preflight.asset'));
    }
    if (authorization.status !== 'allowed') blockers.push(preflightCopy('source', authorization.reasonCodes[0], 'editor.preflight.permission'));
    const values = design.document.bindings;
    const predictionStory = elements.some(e => e.type === 'interaction' && e.props.kind === PREDICTION_KIND && e.visible !== false && e.opacity !== 0);
    const visibleBindings = visibleBindingKeys(document);
    for (const [key, max] of [['recipientName', 60], ['senderName', 60], ['message', 1000]]) {
      if (editable && !editable.includes(key)) continue;
      // This interaction supplies two endings instead of an unused general greeting.
      if (key === 'message' && predictionStory && !visibleBindings.has(key)) continue;
      const v = values[key]?.value;
      if (typeof v !== 'string' || !v.trim() || v.length > max)
        blockers.push(preflightCopy(`bindings.${key}`, 'BINDING_REQUIRED', 'editor.preflight.binding',
          { binding: { format: 'message', key: `catalog.personalization.${key}` }, max }));
    }
    return { designId: design.id, revision: design.revision, documentHash: hash(design.document), authorization, canPublish: authorization.status === 'allowed' && blockers.length === 0,
      blockers, warnings: editable && lockedVisibleNames(document, editable).length
        ? [preflightCopy('document.bindings', 'LOCKED_NAMES_OMITTED', 'editor.preflight.lockedNames')] : [],
      summary: { sceneCount: document.scenes.length, assetCount: assetIds(document).length }, ...(template ? { template: { id: template.id, title: template.title, price: template.price } } : {}) };
  }
  assetPath(asset) {
    if (!/^[\da-f-]{36}\.(png|jpg|webp|wav)$/.test(asset.storageKey)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy tài sản.');
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
        documentSnapshot: document, runtimeVersion: runtimeVersionFor(document), assetIds: assetIds(document), ...createGiftAccess(input.access) };
      const version = { id: versionId, designId: d.id, revision: d.revision, schemaVersion: document.schemaVersion, runtimeVersion: runtimeVersionFor(document), documentHash: actualHash, document, createdAt: now };
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
