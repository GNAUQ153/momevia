// Tính theo ngày tại Việt Nam; không phụ thuộc múi giờ trên máy khách.
// Khoảng ngày là thời gian ưu tiên truyền thông, KHÔNG giới hạn quyền xem mẫu đã mua.
export function vietnamDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validWindow(template) {
  return Boolean(template?.isSeasonal && validDay(template.availableFrom) &&
    validDay(template.availableTo) && template.availableFrom <= template.availableTo);
}

// Nhãn chỉ mô tả chiến dịch truyền thông, không phải thời hạn sử dụng mẫu.
export function seasonStatus(template, day = vietnamDay()) {
  if (!validWindow(template) || !validDay(day)) return 'collection';
  if (day < template.availableFrom) return 'upcoming';
  return day <= template.availableTo ? 'inSeason' : 'collection';
}

export function isInSeason(template, day = vietnamDay()) {
  return seasonStatus(template, day) === 'inSeason';
}

export function featuredSeasons(templates, day = vietnamDay()) {
  // Đang diễn ra, sắp tới, đã qua (gần nhất trước), thiếu lịch (cuối).
  const rank = item => {
    const status = seasonStatus(item, day);
    return status === 'inSeason' ? 0 : status === 'upcoming' ? 1 : validWindow(item) ? 2 : 3;
  };
  return templates.filter(item => item?.isSeasonal).map(item => ({ item, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || (a.rank === 3 ? 0 : a.rank === 2
      ? b.item.availableTo.localeCompare(a.item.availableTo)
      : a.item.availableFrom.localeCompare(b.item.availableFrom)))
    .map(entry => entry.item);
}
