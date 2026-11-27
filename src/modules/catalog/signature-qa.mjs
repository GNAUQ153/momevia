import { canonicalText } from '../../../web/js/shared/locale.js';
import { signatureTemplateIds } from '../../../web/js/shared/canvas/signature/templates.js';

// Chỉ dùng cho profile demo loopback riêng; không bật cho MySQL hoặc production.
export function signatureQaEnabled(env = process.env) {
  if (env.MOMEVIA_SIGNATURE_QA !== 'true') return false;
  const stores = ['IDENTITY', 'CATALOG', 'CHECKOUT', 'GIFTS', 'DESIGNS', 'SUPPORT'];
  const port = Number(env.PORT);
  if (env.NODE_ENV !== 'development' || env.HOST !== '127.0.0.1' ||
      !Number.isInteger(port) || port < 1024 || port > 65535 ||
      env.PUBLIC_BASE_URL !== `http://127.0.0.1:${port}` || env.ALLOWED_ORIGINS ||
      env.MOMEVIA_DATA_DIR?.trim() || env.DEMO_AUTH_ENABLED !== 'true' ||
      env.PAYMENT_ENABLED !== 'false' || env.PAYMENT_LIVE_ENABLED !== 'false' ||
      stores.some(name => env[`${name}_STORAGE`] !== 'json') ||
      Object.keys(env).some(key => key.startsWith('RAILWAY_')))
    throw new Error('Signature QA chỉ dành cho profile demo JSON riêng trên loopback.');
  return true;
}

const metadata = Object.freeze({
  'signature-secret-santa': ['christmas', 'sage', 'festive'],
  'signature-midnight-soiree': ['meetup', 'navy', 'elegant'],
  'signature-garden-tea': ['meetup', 'sage', 'nature'],
  'signature-last-chapter': ['graduation', 'sky', 'nostalgic'],
  'signature-graduation-mixtape': ['graduation', 'cream', 'nostalgic'],
  'signature-graduation-countdown': ['graduation', 'rose', 'playful'],
});
// Giá 0 chỉ là fixture demo; không thêm vào seed thương mại.
export function signatureQaTemplates() {
  return signatureTemplateIds.map(id => {
    const [category, theme, style] = metadata[id];
    return {
      id, title: canonicalText(`templates.${id}.title`),
      subtitle: canonicalText(`templates.${id}.subtitle`), theme,
      category: canonicalText(`templates.meta.category.${category}`),
      style: canonicalText(`templates.meta.style.${style}`),
      effect: canonicalText('templates.meta.effect.openLetter'),
      creator: 'Momevia Originals', creatorId: 'system', price: 0, scenes: 4,
      status: 'published', featured: false, createdAt: '2026-11-27T00:00:00.000Z',
    };
  });
}
