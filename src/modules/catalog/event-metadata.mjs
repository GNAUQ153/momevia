import { canonicalText } from '../../../web/js/shared/locale.js';

// Read projection, not a migration: stored customization, money, status and favorites stay untouched.
// Only exact historical system defaults qualify. Creator records never qualify.
const defaults = {
  'birthday-radiance': { subtitle: 'Chiếc bánh sinh nhật, những ngọn nến và lời chúc ấm áp.' },
  'hai-phong-bi': { subtitle: 'Người nhận tự chọn mở kỷ niệm hay lời chúc trước.', category: 'Sinh nhật' },
  'proud-of-you': { subtitle: 'Dành cho cột mốc tốt nghiệp, thăng chức và thành công.', category: 'Chúc mừng' },
};
const categories = { 'hai-phong-bi': 'wedding', 'proud-of-you': 'graduation' };
export function eventMetadata(template) {
  const old = defaults[template.id];
  if (!old || template.creatorId !== 'system' || template.creator !== 'Momevia Originals' || template.versionId || template.creatorDesignId) return template;
  const view = { ...template };
  if (template.scenes === 3) view.scenes = template.id === 'hai-phong-bi' ? 6 : 5;
  for (const [key, value] of Object.entries(old)) if (template[key] === value)
    view[key] = canonicalText(key === 'category' ? `templates.meta.category.${categories[template.id]}` : `templates.${template.id}.${key}`);
  return view;
}
