import { vi } from '../../shared/locale.js';
import { isInSeason, vietnamDay } from '../catalog/seasonal.js';

// Lựa chọn dịp lấy từ danh mục thật, không tạo ra đường dẫn cho danh mục rỗng.
// Giá trị lọc phải giữ nguyên dữ liệu API (ví dụ "Sinh nhật"), vì /explore
// đối chiếu thuộc tính category chính xác chứ không dùng mã dịch.
const knownCategories = new Map(Object.entries(vi)
  .filter(([key, value]) => key.startsWith('templates.meta.category.') && typeof value === 'string')
  .map(([key, value]) => [value, key]));

const preferred = Object.freeze([
  'christmas', 'tet', 'newYear', 'birthday', 'graduation', 'meetup', 'wedding', 'valentine',
  'friendship', 'thanks', 'congratulations', 'encouragement', 'apology',
]);
const priority = new Map(preferred.map((name, index) => [`templates.meta.category.${name}`, index]));

export function occasionShortcuts(templates, { day = vietnamDay(), limit = 6 } = {}) {
  if (!Array.isArray(templates) || !Number.isInteger(limit) || limit <= 0) return [];
  const groups = new Map();
  for (const template of templates) {
    const value = template?.category;
    if (typeof value !== 'string') continue;
    const labelKey = knownCategories.get(value);
    // Danh mục tự do của Creator vẫn xem được tại Explore; không hiển thị
    // nhãn không có bản dịch khi chuyển ngôn ngữ trên trang Marketing.
    if (!labelKey) continue;
    const previous = groups.get(value) || { value, labelKey, count: 0, seasonal: false };
    previous.count += 1;
    previous.seasonal ||= isInSeason(template, day);
    groups.set(value, previous);
  }
  return [...groups.values()].sort((a, b) =>
    Number(b.seasonal) - Number(a.seasonal) ||
    (priority.get(a.labelKey) ?? Infinity) - (priority.get(b.labelKey) ?? Infinity) ||
    b.count - a.count || a.value.localeCompare(b.value, 'vi'))
    .slice(0, limit);
}

export function occasionExploreUrl(category) {
  return `/explore?occasion=${encodeURIComponent(category)}`;
}
