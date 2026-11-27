import { ORIGINAL_IDS } from './canvas/originals-data.js';

// Bộ 16 thiệp ra mắt đứng trước các mẫu hệ thống cũ; không sửa bản ghi Catalog.
export const PRIORITY_TEMPLATE_IDS = ORIGINAL_IDS;
const legacy = ['birthday-radiance', 'hai-phong-bi', 'proud-of-you'];
const priorities = new Map([...ORIGINAL_IDS, ...legacy].map((id, index) => [id, index]));

export function prioritizeTemplates(templates) {
  const fallback = priorities.size;
  const rank = template => {
    const system = template?.systemOwned === true ||
      (template?.creatorId === 'system' && template?.creator === 'Momevia Originals');
    if (!system || template.versionId || template.creatorDesignId) return fallback;
    return priorities.get(template.id) ?? fallback;
  };
  // sort ổn định giữ thứ tự tương đối của các mẫu Creator và không đổi giá/quyền.
  return templates.slice().sort((a, b) => rank(a) - rank(b));
}
