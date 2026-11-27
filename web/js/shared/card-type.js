import { signatureTemplateDefinition } from './canvas/signature/templates.js';
import { originalDefinition } from './canvas/originals-data.js';
// Loại thiệp khác với dịp sử dụng; không suy đoán từ tên hoặc danh mục.
export const CARD_TYPES = Object.freeze(['invitation', 'greeting', 'unspecified']);
const invitationIds = new Set(['loi-moi-ben-hien', 'club-22-invitation', 'cozy-christmas-invitation']);
const greetingIds = new Set([
  'tet-phong-thu',
  'midnight-bloom', 'sunny-wishes', 'love-letter', 'starlight', 'peachy-day',
  'greenhouse', 'confetti', 'cloud-nine', 'lavender', 'polaroid', 'afterglow',
  'tiny-celebration', 'mot-ky-niem', 'hai-phong-bi', 'winter-wishes-2026',
  'new-year-spark-2027', 'spring-blessing-2027', 'velvet-valentine-2027',
  'to-doan-cau-se-chon', 'birthday-radiance', 'thank-you-bloom', 'proud-of-you',
  'faraway-hug', 'gentle-apology', 'calm-light', 'cuon-phim-ngay-ay',
  'ban-do-ngay-ra-truong',
]);

// Chỉ phân loại tự động các mẫu hệ thống đã rà soát, không gán loại cho Creator.
export function systemCardType(id) {
  if (signatureTemplateDefinition(id)) return 'invitation';
  const original = originalDefinition(id);
  if (original) return original.cardType;
  if (invitationIds.has(id)) return 'invitation';
  if (greetingIds.has(id)) return 'greeting';
  return 'unspecified';
}

export function templateCardType(template) {
  if (CARD_TYPES.includes(template?.cardType)) return template.cardType;
  // Tương thích frontend mới với API cũ trước khi backend triển khai xong.
  return template?.systemOwned === true ? systemCardType(template.id) : 'unspecified';
}

export function normalizeCardTypeFilter(value) {
  return CARD_TYPES.includes(value) ? value : 'all';
}
