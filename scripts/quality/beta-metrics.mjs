import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const eventFields = {
  template_approved: ['template', 'version', 'actor'],
  draft_created: ['draft', 'template', 'version', 'actor', 'selectedAt'],
  gift_published: ['draft', 'gift'],
  gift_opened: ['gift', 'channel'],
  reply_sent: ['gift', 'reply'],
};
const opaque = /^[A-Za-z0-9_-]{1,64}$/;
const time = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const ratio = (numerator, denominator) => ({ numerator, denominator, rate: denominator ? numerator / denominator : null });

export function betaMetrics(records, { from, to }) {
  if (!Array.isArray(records) || !time(from) || !time(to) || Date.parse(from) >= Date.parse(to))
    throw new Error('Cần danh sách sự kiện và khoảng thời gian UTC hợp lệ.');
  const unique = new Map();
  for (const record of records) {
    const required = eventFields[record?.type];
    if (!Array.isArray(required) || Object.keys(record).length !== required.length + 3 || !time(record.at) || typeof record.id !== 'string' || !opaque.test(record.id) ||
        required.some(key => key === 'selectedAt' ? !time(record[key]) || Date.parse(record[key]) > Date.parse(record.at) : typeof record[key] !== 'string' || !opaque.test(record[key])) ||
        (record.type === 'gift_opened' && !['interaction', 'preview', 'unclassified'].includes(record.channel)))
      throw new Error('Sự kiện chứa trường hoặc giá trị ngoài hợp đồng đo beta.');
    const previous = unique.get(record.id);
    const fingerprint = JSON.stringify(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
    if (previous && previous.fingerprint !== fingerprint) throw new Error('Mã sự kiện trùng với nội dung khác.');
    unique.set(record.id, { ...record, fingerprint });
  }
  const start = Date.parse(from), end = Date.parse(to);
  const observations = [...unique.values()].map(record => ({ ...record, timestamp: Date.parse(record.at) }))
    .filter(record => record.timestamp < end).sort((a, b) => a.timestamp - b.timestamp);
  const firstBy = (list, key) => {
    const result = new Map();
    for (const item of list) if (!result.has(item[key])) result.set(item[key], item);
    return result;
  };
  const filter = type => observations.filter(record => record.type === type);
  const during = record => record.timestamp >= start;
  const drafts = firstBy(filter('draft_created'), 'draft');
  const gifts = firstBy(filter('gift_published').filter(gift => (drafts.get(gift.draft)?.timestamp ?? Infinity) <= gift.timestamp), 'gift');
  const publications = firstBy([...gifts.values()], 'draft');
  const cohortDrafts = [...drafts.values()].filter(during);
  const publishedDrafts = cohortDrafts.filter(draft => publications.has(draft.draft));
  const durations = publishedDrafts.map(draft => publications.get(draft.draft).timestamp - Date.parse(draft.selectedAt)).sort((a, b) => a - b);
  const median = durations.length ? (durations[(durations.length - 1) >> 1] + durations[durations.length >> 1]) / 2 : null;
  const cohortGifts = [...gifts.values()].filter(during);
  const opens = firstBy(filter('gift_opened').filter(open => open.channel === 'interaction' &&
    (gifts.get(open.gift)?.timestamp ?? Infinity) <= open.timestamp), 'gift');
  const opened = cohortGifts.filter(gift => opens.has(gift.gift));
  const replies = firstBy(filter('reply_sent').filter(reply => (opens.get(reply.gift)?.timestamp ?? Infinity) <= reply.timestamp), 'gift');
  const approved = firstBy(filter('template_approved'), 'version');
  const cohortTemplates = new Set([...approved.values()].filter(during).map(version => version.template));
  const usedTemplates = new Set([...drafts.values()].filter(draft => {
    const version = approved.get(draft.version);
    return version?.template === draft.template && cohortTemplates.has(draft.template)
      && version.timestamp >= start && version.timestamp <= draft.timestamp && draft.actor !== version.actor;
  }).map(draft => draft.template));
  return {
    draftToPublished: ratio(publishedDrafts.length, cohortDrafts.length),
    selectionToLink: { count: durations.length, medianMs: median },
    publishedToInteractiveOpen: ratio(opened.length, cohortGifts.length),
    openedToReply: ratio(opened.filter(gift => replies.has(gift.gift)).length, opened.length),
    creatorTemplatesUsed: ratio(usedTemplates.size, cohortTemplates.size),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (input.synthetic !== true) throw new Error('Công cụ QA hiện chỉ nhận dữ liệu tổng hợp.');
  console.log(JSON.stringify(betaMetrics(input.records, input), null, 2));
}
