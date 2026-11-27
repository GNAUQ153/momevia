import { signatureTemplateDefinition } from '../../../web/js/shared/canvas/signature/templates.js';
import { ORIGINAL_IDS, originalDefinition } from '../../../web/js/shared/canvas/originals-data.js';
import { librarySnapshot } from '../../../web/js/shared/canvas/library-state.js';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';
import { createDocument, isPhotoFrame } from '../../../web/js/shared/canvas/index.js';
import { visibleBindingKeys } from '../../../web/js/shared/canvas/personalization.js';
import { searchText } from '../../../web/js/features/catalog/filter.js';
import { templateFieldKey } from '../../../web/js/shared/template-copy.js';
import { serverText } from '../../shared/locale.mjs';
import { eventMetadata } from './event-metadata.mjs';
import { systemCardType, normalizeCardTypeFilter, templateCardType } from '../../../web/js/shared/card-type.js';
import { prioritizeTemplates } from '../../../web/js/shared/template-order.js';

const publicFields = ['id', 'title', 'subtitle', 'theme', 'style', 'price', 'scenes', 'effect', 'creator', 'featured', 'category', 'status', 'createdAt', 'isSeasonal', 'season', 'availableFrom', 'availableTo', 'palette', 'paletteLabel', 'paletteColors'];
export function publicTemplate(template) {
  template = eventMetadata(template);
  const ownPalettes={
    'birthday-radiance':['birthdayPaper',['#FFF5DC','#362644','#FFD056','#68374B']],
    'hai-phong-bi':['weddingPaper',['#FFF8EB','#442638','#F4C9C4','#47715C']],
    'proud-of-you':['nightPaper',['#172849','#FFF8E7','#FFC857','#315B82']],
  };
  const original = originalDefinition(template.id);
  const originalPalette = original && [{sage:'greenPaper',cream:'warmPaper',sky:'bluePaper',navy:'bluePaper',lilac:'pinkPaper',rose:'pinkPaper',peach:'warmPaper',amber:'warmPaper',violet:'pinkPaper'}[original.theme], [original.bg,original.ink,original.button,original.detail]];
  const palette=originalPalette || ownPalettes[template.id] || {sage:['greenPaper',['#F8F1E6','#263C32','#59705B','#AA5744']],cream:['warmPaper',['#F6EBD9','#352B30','#825943','#DEA99C']],sky:['bluePaper',['#E6EFF1','#21394C','#375B6A','#E9BA63']],navy:['bluePaper',['#E6EFF1','#21394C','#375B6A','#E9BA63']],lilac:['pinkPaper',['#F5EFFF','#7757A2','#F4C9C4','#263C32']]}[template.theme];
  if(palette && template.creatorId==='system')template={...template,palette:palette[0],paletteLabel:serverText('vi',`templates.meta.palette.${palette[0]}`),paletteColors:palette[1]};
  const view = Object.fromEntries(publicFields.filter(key => Object.hasOwn(template, key)).map(key => [key, template[key]]));
  if (template.creatorId === 'system' && template.creator === 'Momevia Originals' && !template.versionId && !template.creatorDesignId)
    view.systemOwned = true;
  view.cardType = view.systemOwned ? systemCardType(template.id) : 'unspecified';
  if (view.systemOwned && signatureTemplateDefinition(template.id)) {
    view.coverRevision = 'signature-qa-v1';
    // Không suy đoán bảng màu thực tế từ theme Classic.
    delete view.palette; delete view.paletteLabel; delete view.paletteColors;
  }
  if (view.systemOwned && librarySnapshot()?.items.some(row=>row.kind==='template'&&row.id===template.id&&row.status==='active')) view.coverRevision=librarySnapshot().revision;
  if (template.versionId) {
    view.versionId = template.versionId;
    const version = template.versions.find(item => item.id === template.versionId);
    if (version) {
      view.thumbnail = `/api/catalog/templates/${template.id}/versions/${template.versionId}/cover`;
      view.personalization = { bindings: version.bindings, photoFrames: Number(Boolean(version.photoId)), layout: false };
    }
  } else {
    const document = createDocument({ template });
    const albumSlots = document.elements.filter(e => e.type === 'interaction' && e.props.kind === 'swipe-album' && e.props.optional)
      .reduce((count, e) => count + e.props.photos.length, 0);
    const photoFrames = signatureTemplateDefinition(template.id)
      ? document.elements.filter(e => e.type === 'image' && e.props.optional).length
      : document.elements.filter(isPhotoFrame).length + albumSlots;
    view.personalization = { bindings: [...visibleBindingKeys(document)], photoFrames, layout: true };
  }
  return view;
}

export class CatalogService {
  constructor(repository, favorites, { signatureQa = false } = {}) { this.repo = repository; this.favorites = favorites; this.signatureQa = signatureQa; }

  async isPublic(template) {
    // Kể cả khi vô tình sao chép JSON demo, mẫu Signature không được quảng bá ở production.
    if (signatureTemplateDefinition(template?.id) && (!this.signatureQa || template.creatorId !== 'system')) return false;
    if (template?.creatorId==='system' && librarySnapshot() && librarySnapshot().items.some(r=>r.kind==='template'&&r.id===template.id&&r.status!=='active')) return false;
    if (['loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong', ...ORIGINAL_IDS].includes(template?.id) && librarySnapshot() && !librarySnapshot().items.some(r=>r.kind==='template'&&r.id===template.id&&r.status==='active')) return false;
    return template?.status === 'published' && (!template.creatorDesignId || Boolean(template.versionId && await this.creatorTemplates.canCreate(template.creatorId)));
  }
  // Tất cả mẫu còn hiệu lực: dùng cho link trực tiếp, yêu thích, nháp và quà đã phát hành.
  async publicItems() {
    const items = (await this.repo.all()).filter(item => item.status === 'published');
    const visible = await Promise.all(items.map(item => this.isPublic(item)));
    return items.filter((_, index) => visible[index]);
  }
  // Danh sách hiển thị trên Thư viện/Trang chủ: 16 mẫu Originals + mẫu do Creator đăng bán.
  // Mẫu hệ thống thế hệ cũ vẫn mở được qua link /template/<id> nhưng không quảng bá nữa.
  async publicList() {
    const listed = (await this.publicItems()).filter(item => item.creatorId !== 'system' ||
      ORIGINAL_IDS.includes(item.id) || signatureTemplateDefinition(item.id));
    return prioritizeTemplates(listed.map(publicTemplate));
  }
  async search({ q = '', style = '', category = '', palette = '', cardType = 'all', locale = 'vi' }) {
    let items = await this.publicList();
    q = searchText(q.trim());
    if (q) items = items.filter(item => {
      const fields = ['title', 'subtitle', 'creator', 'style', 'category', 'paletteLabel'];
      return fields.some(field => {
        if (searchText(item[field]).includes(q)) return true;
        const key = templateFieldKey(item, field);
        return key && searchText(serverText(locale, key)).includes(q);
      });
    });
    if (style && style !== 'all' && style !== 'Tất cả') items = items.filter(item => item.style === style);
    if(category && category!=='all')items=items.filter(t=>t.category===category);
    cardType = normalizeCardTypeFilter(cardType);
    if (cardType !== 'all') items = items.filter(item => templateCardType(item) === cardType);
    if(palette && palette!=='all')items=items.filter(t=>t.palette===palette);
    return items;
  }
  async publishedIds() { return new Set((await this.publicItems()).map(template => template.id)); }
  async favoriteIds(user) { return this.favorites.list(user.sub, await this.publishedIds()); }
  async saveFavorite(user, data) {
    return this.favorites.set(user.sub, sanitizeText(data.templateId, 90), data.saved, await this.publishedIds());
  }
  async mine(user) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần quyền Creator để xem danh sách mẫu.');
    return (await this.repo.all()).filter(item => item.creatorId === user.sub && !item.creatorDesignId);
  }
  requireAdmin(user, message) {
    if (user.role !== 'admin') throw new HttpError(403, message);
  }
  async pending(user) {
    this.requireAdmin(user, 'Chỉ quản trị viên được truy cập.');
    return (await this.repo.all()).filter(item => item.status === 'pending' && !item.creatorDesignId);
  }
  async approve(user, id) {
    this.requireAdmin(user, 'Chỉ quản trị viên được duyệt mẫu.');
    return this.reviewLegacy(id, { status: 'published' });
  }
  async reject(user, id, body) {
    this.requireAdmin(user, 'Chỉ quản trị viên được kiểm duyệt.');
    const reason = sanitizeOptionalText(body.reason, 250);
    return this.reviewLegacy(id, { status: 'rejected', rejectionReason: reason });
  }
  async reviewLegacy(id, patch) {
    const current = await this.repo.get(id);
    if (!current) throw new HttpError(404, 'Không tìm thấy mẫu.');
    if (current.creatorDesignId) throw new HttpError(404, 'Hãy duyệt phiên bản mẫu trong hàng đợi.');
    return this.repo.update(id, patch);
  }
  async publicOne(id) {
    const item = await this.repo.get(id);
    if (!await this.isPublic(item)) throw new HttpError(404, 'Mẫu quà không tồn tại.');
    return publicTemplate(item);
  }
  async createDraft(user, data) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần đăng ký Creator trước.');
    const themes = ['violet', 'sunshine', 'rose', 'navy', 'peach', 'sage', 'coral', 'sky', 'lilac', 'cream', 'amber', 'mint'];
    const theme = themes.includes(data.theme) ? data.theme : 'violet';
    const price = Number(data.price);
    if (!Number.isInteger(price) || price < 0 || price > 500000) throw new HttpError(400, 'Giá bán phải trong khoảng 0–500.000đ.');
    return this.repo.insert({
      id: randomUUID(),
      title: sanitizeText(data.title, 60),
      subtitle: sanitizeText(data.subtitle, 140),
      theme,
      style: 'Độc quyền',
      price,
      scenes: 3,
      effect: 'Mở quà',
      creator: user.name,
      creatorId: user.sub,
      featured: false,
      status: 'pending',
      category: 'Sinh nhật',
      createdAt: new Date().toISOString(),
    });
  }
}
