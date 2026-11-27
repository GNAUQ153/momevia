import { normalizeCardTypeFilter, templateCardType } from '../../shared/card-type.js';
import { canonicalText } from '../../shared/locale.js';

// Các phép lọc thuần, dùng chung cho giao diện và unit tests.
export function searchText(value) {
  return String(value ?? '').toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd');
}

export function styleOptions(templates) {
  const counts = new Map();
  for (const template of templates) {
    const style = String(template.style || "").trim();
    if (style) counts.set(style, (counts.get(style) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([style, count]) => ({ style, count }));
}

export function filterTemplates(
  templates,
  { style = "all", search = "", freeOnly = false, photoOnly = false, category = "all", palette = "all", cardType = "all", searchFields = () => [] } = {},
) {
  const query = searchText(String(search).trim());
  const type = normalizeCardTypeFilter(cardType);
  return templates.filter((template) => {
    const matchesStyle = style === "all" || style === "Tất cả" || template.style === style;
    const matchesPrice = !freeOnly || Number(template.price) === 0;
    const fields = [
      template.title,
      template.subtitle,
      template.creator,
      template.style,
      template.category,
      template.paletteLabel,
      ...searchFields(template),
    ];
    const matchesSearch =
      !query ||
      fields.some((value) =>
        searchText(value).includes(query),
      );
    return (type === 'all' || templateCardType(template) === type) && (category === "all" || template.category === category) && (palette === "all" || template.palette === palette) && matchesStyle && matchesPrice && matchesSearch && (!photoOnly || template.personalization?.photoFrames > 0);
  });
}

// Một danh sách điều kiện dùng chung cho chip và thao tác xóa từng bộ lọc.
const catalogFilterControls = [
  ['search', 'template-search', ''],
  ['cardType', 'card-type-filter', 'all'],
  ['filter', 'style-filter', 'all'],
  ['occasion', 'occasion-filter', 'all'],
  ['palette', 'palette-filter', 'all'],
  ['freeOnly', 'free-filter', false],
  ['photoOnly', 'photo-filter', false],
];

export function activeCatalogFilters(state) {
  return catalogFilterControls.filter(([key, , reset]) => {
    const value = state[key];
    if (key === 'search') return Boolean(value?.trim());
    if (typeof reset === 'boolean') return value === true;
    return Boolean(value && value !== reset);
  }).map(([key]) => key);
}

export function clearCatalogFilter(state, key) {
  const entry = catalogFilterControls.find(([name]) => name === key);
  if (!entry || !activeCatalogFilters(state).includes(key)) return null;
  const [, controlId, value] = entry;
  state[key] = value;
  state.catalogPage = 1;
  return { controlId, value };
}

export function countLabel(count) {
  return canonicalText('catalog.results.count', { count });
}

// Phân trang dữ liệu sau khi lọc; mặc định tối đa 9 mẫu cho mỗi trang.
export const PAGE_SIZE = 9;

export function paginateTemplates(
  templates,
  requestedPage = 1,
  pageSize = PAGE_SIZE,
) {
  const size =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : PAGE_SIZE;
  const total = templates.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const rawPage = Number(requestedPage);
  const page = Number.isInteger(rawPage)
    ? Math.min(Math.max(rawPage, 1), totalPages)
    : 1;
  const start = (page - 1) * size;
  return {
    items: templates.slice(start, start + size),
    page,
    pageSize: size,
    total,
    totalPages,
    from: total ? start + 1 : 0,
    to: Math.min(start + size, total),
  };
}
