import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sanitizeText } from '../../shared/security.mjs';
import { assetIds, validateDocument } from '../../../web/js/shared/canvas/index.js';
import { clearTemplateBindingDefaults, lockedVisibleNames, visibleBindingKeys } from '../../../web/js/shared/canvas/personalization.js';
import { submissionChanges } from '../../../web/js/shared/canvas/submission.js';

const demo = { recipientName: 'Mai', senderName: 'An', message: 'Chúc bạn một sinh nhật thật vui và nhiều khoảnh khắc đáng nhớ!' };
export function previewTemplateDocument(version) {
  const document = structuredClone(version.document);
  for (const [key, value] of Object.entries(version.previewBindings || {})) document.bindings[key].value = value;
  return document;
}

export const versionView = version => {
  const { assets, previewBindings, ...view } = version;
  return { ...view, document: previewTemplateDocument(version), assetIds: Object.keys(assets) };
};
function submissionConfig({ id, title, bindings, photoId, rights, assets, coverSceneId, document }) {
  return { id, title, bindings, photoId, rights, assetIds: Object.keys(assets), coverSceneId: coverSceneId || document.entrySceneId };
}
function sameSubmission(candidate, version) {
  return candidate.revision === version.revision && candidate.photoId === version.photoId && candidate.rights === version.rights
    && candidate.bindings.join() === version.bindings.join()
    && submissionConfig(candidate).coverSceneId === version.coverSceneId;
}

function requireNamesEditable(document, bindings) {
  if (lockedVisibleNames(document, bindings).length)
    throw new HttpError(422, 'Mở quyền sửa cho lớp tên đang hiển thị, hoặc đổi lớp đó thành chữ cố định trung tính trước khi duyệt.');
}

export class CreatorTemplates {
  constructor(repository, { getDraft, getAsset, canCreate }) {
    Object.assign(this, { repository, getDraft, getAsset, canCreate });
  }
  requireCreator(user) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Cần quyền Creator.');
  }
  requireAdmin(user) {
    if (user.role !== 'admin') throw new HttpError(403, 'Cần quyền Admin.');
  }
  authored(template, ownerId) {
    if (!template?.creatorDesignId || (ownerId && template.creatorId !== ownerId))
      throw new HttpError(404, 'Không tìm thấy mẫu.');
    return template;
  }
  async mine(user) {
    this.requireCreator(user);
    return (await this.repository.all()).filter(item => item.creatorId === user.sub && item.creatorDesignId)
      .map(({ id, creatorDesignId, title, subtitle, versionId, versions, withdrawn }) => ({
        id, creatorDesignId, title, subtitle, versionId, withdrawn,
        versions: versions.map(({ id, status, reason, revision, createdAt }) => ({ id, status, reason, revision, createdAt })),
      }));
  }
  async previousSubmission(user, id) {
    this.requireCreator(user);
    const template = this.authored(await this.repository.get(id), user.sub);
    const last = template.versions.at(-1);
    return last ? submissionConfig(last) : null;
  }
  async register(user, body) {
    this.requireCreator(user);
    const design = await this.getDraft(user, body.designId);
    const previous = await this.repository.get(design.id);
    if (previous) return { id: this.authored(previous, user.sub).id };
    const item = { id: design.id, creatorDesignId: design.id,
      creatorId: user.sub, creator: user.name, title: design.title,
      subtitle: sanitizeText(body.subtitle, 140), theme: 'violet', style: 'Độc quyền',
      price: 0, status: 'pending', category: 'Sinh nhật', scenes: design.document.scenes.length,
      effect: 'Mở quà', createdAt: new Date().toISOString(), versions: [] };
    try { await this.repository.insertUnique(item); }
    catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      this.authored(await this.repository.get(item.id), user.sub);
    }
    return { id: item.id };
  }
  async submit(user, id, body) {
    this.requireCreator(user);
    this.authored(await this.repository.get(id), user.sub);
    const design = await this.getDraft(user, id);
    if (body.expectedRevision !== design.revision) throw new HttpError(409, 'Nháp đã thay đổi. Mở lại và gửi phiên bản muốn duyệt.');
    const document = structuredClone(design.document);
    const visible = visibleBindingKeys(document);
    const bindings = Array.isArray(body.bindings) ? [...new Set(body.bindings)].sort() : [];
    if (!bindings.length || bindings.some(key => !visible.has(key)))
      throw new HttpError(422, 'Chọn ít nhất một trường chữ liên kết với lớp đang hiển thị.');
    const photoId = body.photoId || null;
    if (photoId && !document.elements.some(element => element.id === photoId && element.type === 'image' && element.visible !== false && element.opacity !== 0 && element.props.assetId))
      throw new HttpError(422, 'Khung ảnh cần có ảnh demo hiển thị.');
    const coverSceneId = body.coverSceneId ?? document.entrySceneId;
    if (!document.scenes.some(scene => scene.id === coverSceneId))
      throw new HttpError(422, 'Chọn một cảnh trong phiên bản làm bìa mẫu.');
    clearTemplateBindingDefaults(document);
    const ids = assetIds(document);
    document.assets = document.assets.filter(ref => ids.includes(ref.assetId));
    const assets = Object.fromEntries(await Promise.all(ids.map(async assetId => [assetId, await this.getAsset(user, assetId)])));
    const rights = ids.length ? sanitizeText(body.rights, 500) : null;
    validateDocument(document, { mode: 'publish', requiredBindings: [] });
    const version = { id: randomUUID(), status: 'pending', revision: design.revision, document, previewBindings: demo, bindings, photoId, rights, assets, coverSceneId,
      title: design.title, createdAt: new Date().toISOString() };
    const item = await this.repository.mutate(id, current => {
      this.authored(current, user.sub);
      const replay = current.versions.find(candidate => sameSubmission(candidate, version));
      if (replay) return null;
      requireNamesEditable(document, bindings);
      if (current.versions.some(candidate => candidate.status === 'pending'))
        throw new HttpError(409, 'Mẫu vẫn có phiên bản đang chờ duyệt.');
      return { versions: [...current.versions, version] };
    });
    return versionView(item.versions.find(candidate => sameSubmission(candidate, version)));
  }
  async queue(user) {
    this.requireAdmin(user);
    return (await this.repository.all()).flatMap(template => (template.versions || [])
      .filter(version => version.status === 'pending')
      .map(version => ({ templateId: template.id, title: version.title, creator: template.creator, versionId: version.id,
        revision: version.revision, createdAt: version.createdAt })));
  }
  async version(user, id, versionId) {
    this.requireAdmin(user);
    const template = this.authored(await this.repository.get(id));
    const version = this.findVersion(template, versionId);
    const index = template.versions.indexOf(version);
    const previous = index > 0 ? submissionConfig(template.versions[index - 1]) : null;
    return { ...version, previousVersionId: previous?.id, changes: submissionChanges(previous, submissionConfig(version)),
      hasLockedNames: lockedVisibleNames(version.document, version.bindings).length > 0 };
  }
  findVersion(template, id) {
    const version = template.versions.find(candidate => candidate.id === id);
    if (!version) throw new HttpError(404, 'Không tìm thấy phiên bản mẫu.');
    return version;
  }
  async decide(user, id, versionId, body) {
    this.requireAdmin(user);
    if (!['approve', 'revise'].includes(body.action)) throw new HttpError(422, 'Chọn kết quả duyệt mẫu.');
    const approval = body.action === 'approve';
    const reason = approval ? null : sanitizeText(body.reason, 500);
    const template = this.authored(await this.repository.get(id));
    if (approval && !await this.canCreate(template.creatorId)) throw new HttpError(409, 'Tài khoản tác giả không còn quyền Creator.');
    const item = await this.repository.mutate(id, current => {
      this.authored(current);
      const version = this.findVersion(current, versionId);
      if (version.status !== 'pending') throw new HttpError(409, 'Phiên bản đã được xử lý.');
      if (approval) requireNamesEditable(version.document, version.bindings);
      if (approval && version.rights && body.rightsConfirmed !== true)
        throw new HttpError(422, 'Xác nhận quyền phân phối ảnh demo trước khi duyệt.');
      const reviewed = { ...version, status: approval ? 'approved' : 'changes_requested', reason, reviewerId: user.sub,
        rightsConfirmed: approval && Boolean(version.rights), reviewedAt: new Date().toISOString() };
      return { versions: current.versions.map(candidate => candidate.id === versionId ? reviewed : candidate),
        ...(approval ? { versionId, status: 'published', withdrawn: false, title: version.title, scenes: version.document.scenes.length } : {}) };
    });
    return versionView(this.findVersion(item, versionId));
  }
  async withdraw(user, id) {
    this.requireCreator(user);
    this.authored(await this.repository.get(id));
    await this.repository.mutate(id, current => {
      this.authored(current, user.role === 'admin' ? null : user.sub);
      if (current.withdrawn && !current.versions.some(version => version.status === 'pending')) return null;
      const withdrawnAt = new Date().toISOString();
      return { status: 'rejected', withdrawn: true, withdrawnAt, withdrawnBy: user.sub,
        versions: current.versions.map(version => version.status === 'pending'
          ? { ...version, status: 'changes_requested', reason: 'Phiên bản dừng duyệt khi mẫu được rút khỏi thư viện.',
            reviewerId: user.sub, reviewedAt: withdrawnAt } : version) };
    });
  }
  async approved(id, versionId) {
    const template = this.authored(await this.repository.get(id));
    if (template.status !== 'published' || !await this.canCreate(template.creatorId))
      throw new HttpError(404, 'Mẫu không còn trong thư viện.');
    if (versionId !== template.versionId) throw new HttpError(409, 'Mẫu đã đổi phiên bản. Mở lại chi tiết mẫu.');
    return this.findVersion(template, versionId);
  }
  async reusable(id, versionId) {
    const template = await this.repository.get(id);
    if (!template?.creatorDesignId) return null;
    if (!await this.canCreate(template.creatorId)) throw new HttpError(403, 'Quyền dùng lại mẫu của Creator không còn hiệu lực.');
    const version = this.findVersion(template, versionId);
    if (version.status !== 'approved' || (Object.keys(version.assets).length && !version.rightsConfirmed))
      throw new HttpError(403, 'Phiên bản này chưa đủ quyền để tạo lượt tặng mới.');
    return { template: { id, title: version.title, price: template.price }, version };
  }
}
