import { matchesBlock } from "./library.js";

// Bộ lọc điều hướng danh mục: chỉ đọc danh sách, không can thiệp Canvas document.
export const discoveryModes = Object.freeze([
  { id: "all", label: "Tất cả" },
  { id: "season", label: "Theo dịp" },
  { id: "new", label: "Mới thêm" },
  { id: "recent", label: "Vừa dùng" },
]);

export const recentKey = "momevia.canvas.recent-elements.v1";
const maxRecent = 12;
const seasonalWords = ["Giáng sinh", "Tết", "Valentine", "Sinh nhật", "Tình yêu"];

export function readRecent(raw, catalog) {
  const valid = new Set(catalog.flatMap(group => group.items.map(block => block.id)));
  try {
    const decoded = JSON.parse(raw || "[]");
    if (!Array.isArray(decoded)) return [];
    return [...new Set(decoded.filter(id => typeof id === "string" && valid.has(id)))].slice(0, maxRecent);
  } catch {
    return [];
  }
}

export function addRecent(previous, id, catalog) {
  const valid = new Set(catalog.flatMap(group => group.items.map(block => block.id)));
  if (!valid.has(id)) return previous.slice(0, maxRecent);
  return [id, ...previous.filter(current => current !== id && valid.has(current))].slice(0, maxRecent);
}

export function filteredIds(catalog, { query = "", group = "", mode = "all", recent = [], matches = matchesBlock } = {}) {
  const selected = group === "" ? null : Number(group);
  const recentSet = new Set(recent);
  return new Set(catalog.flatMap(({ label, items }, index) => {
    if (selected !== null && index !== selected) return [];
    return items.filter(block => {
      if (!matches(block, query)) return false;
      if (mode === "new") return /^(?:m55-|natural-|object-|motion-)/.test(block.id);
      if (mode === "recent") return recentSet.has(block.id);
      if (mode === "season") return seasonalWords.some(word => label.includes(word));
      return true;
    }).map(block => block.id);
  }));
}
