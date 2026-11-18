// Tính theo ngày tại Việt Nam; không phụ thuộc múi giờ trên máy khách.
// Khoảng ngày là thời gian ưu tiên truyền thông, KHÔNG giới hạn quyền xem mẫu đã mua.
export function vietnamDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isInSeason(template, day = vietnamDay()) {
  return Boolean(template?.isSeasonal && typeof template.availableFrom === 'string' &&
    typeof template.availableTo === 'string' && day >= template.availableFrom && day <= template.availableTo);
}

export function featuredSeasons(templates, day = vietnamDay()) {
  return templates.filter(item => item.isSeasonal).sort((a, b) =>
    Number(isInSeason(b, day)) - Number(isInSeason(a, day)) ||
    a.availableFrom.localeCompare(b.availableFrom));
}
