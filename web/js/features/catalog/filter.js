// Các phép lọc thuần, dùng chung cho giao diện và unit tests.
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
  { style = "Tất cả", search = "", freeOnly = false } = {},
) {
  const query = String(search).trim().toLocaleLowerCase("vi");
  return templates.filter((template) => {
    const matchesStyle = style === "Tất cả" || template.style === style;
    const matchesPrice = !freeOnly || Number(template.price) === 0;
    const fields = [
      template.title,
      template.subtitle,
      template.creator,
      template.style,
    ];
    const matchesSearch =
      !query ||
      fields.some((value) =>
        String(value || "")
          .toLocaleLowerCase("vi")
          .includes(query),
      );
    return matchesStyle && matchesPrice && matchesSearch;
  });
}

export function countLabel(count) {
  return `${count} mẫu phù hợp`;
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
