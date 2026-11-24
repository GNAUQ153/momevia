// Đếm bản ghi thiệp hiện có, không phải số lượt đã mua hoặc hạn mức còn lại.
export function summarizePublications(groups) {
  const sources = { legacy: 0, template: 0 };
  for (const row of groups) {
    if (!Object.hasOwn(sources, row.source)) throw new Error('Invalid publication source');
    const count = Number(row.total);
    const sum = sources[row.source] + count;
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(sum))
      throw new Error('Invalid publication count');
    sources[row.source] = sum;
  }
  const total = sources.legacy + sources.template;
  if (!Number.isSafeInteger(total)) throw new Error('Invalid publication total');
  return { basis: 'existing_gifts', sources, total, quotaEnforced: false };
}
