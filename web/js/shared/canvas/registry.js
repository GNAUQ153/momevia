// This module is shared verbatim by Node and the browser. No environment or I/O.
const descriptors = {
  text: { label: 'Văn bản', renderer: 'text', defaults: { text: 'Lời chúc của bạn', fontToken: 'body', fontSize: 24, align: 'left', color: '#32243B' }, inspector: ['text', 'textBinding', 'fontToken', 'fontSize', 'align', 'color'], accessibility: { role: 'paragraph' }, actions: [], capability: 'basic' },
  image: { label: 'Ảnh / khung', renderer: 'image', defaults: { assetId: null, fit: 'cover', focalPoint: { x: 0.5, y: 0.5 }, radius: 16 }, inspector: ['assetId', 'fit', 'focalPoint', 'radius'], accessibility: { alt: 'Ảnh kỷ niệm' }, actions: [], capability: 'basic' },
  shape: { label: 'Hình khối', renderer: 'shape', defaults: { kind: 'rectangle', color: '#D9C8FF', strokeColor: '#6136DF', strokeWidth: 0, radius: 12 }, inspector: ['kind', 'color', 'strokeColor', 'strokeWidth', 'radius'], accessibility: { decorative: true }, actions: [], capability: 'basic' },
  line: { label: 'Đường kẻ', renderer: 'line', defaults: { color: '#6136DF', strokeWidth: 3 }, inspector: ['color', 'strokeWidth'], accessibility: { decorative: true }, actions: [], capability: 'basic' },
  sticker: { label: 'Sticker', renderer: 'sticker', defaults: { stickerId: 'heart', color: '#F45278' }, inspector: ['stickerId', 'color'], accessibility: { decorative: true }, actions: [], capability: 'basic' },
  button: { label: 'Nút chuyển cảnh', renderer: 'button', defaults: { label: 'Tiếp tục', color: '#6136DF' }, inspector: ['label', 'color'], accessibility: { label: 'Tiếp tục' }, actions: ['goToScene', 'replay'], capability: 'basic' },
  envelope: { label: 'Phong bì', renderer: 'envelope', defaults: { preset: 'classic', label: 'Mở món quà', color: '#B98ADC' }, inspector: ['label', 'color', 'preset'], accessibility: { label: 'Mở món quà' }, actions: ['goToScene', 'replay'], capability: 'basic' },
  'gift-box': { label: 'Hộp quà', renderer: 'gift-box', defaults: { preset: 'classic', label: 'Mở hộp quà', color: '#F45278' }, inspector: ['label', 'color', 'preset'], accessibility: { label: 'Mở hộp quà' }, actions: ['goToScene', 'replay'], capability: 'basic' },
  reply: { label: 'Lời hồi đáp', renderer: 'reply', defaults: { title: 'Gửi lời đáp', submitLabel: 'Gửi lời đáp' }, inspector: ['title', 'submitLabel'], accessibility: { label: 'Gửi lời đáp cho người tặng' }, actions: [], capability: 'basic' },
};
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const registry = freeze(descriptors);
export const STICKERS = freeze({ heart: '♥', star: '★', flower: '✿', sparkles: '✦', balloon: '🎈', cake: '🎂', gift: '🎁' });
export const FONT_TOKENS = ['body', 'heading', 'serif'];
export const BINDINGS = ['recipientName', 'senderName', 'message'];
export const LIMITS = freeze({ documentBytes: 262144, scenes: 32, elements: 400, assets: 64, actionsPerElement: 2, depth: 16, text: 4000, coordinate: 10000, artboard: 4096 });

export function createElement(type, options = {}) {
  if (!Object.hasOwn(registry, type)) throw new Error('Loại element chưa được hỗ trợ.');
  const descriptor = registry[type];
  const { id = globalThis.crypto.randomUUID(), layout = {}, props = {}, accessibility = {}, ...other } = options;
  const mergedProps = { ...structuredClone(descriptor.defaults), ...props };
  if (type === 'text' && props.textBinding) delete mergedProps.text;
  const mergedAccessibility = { ...descriptor.accessibility, ...(mergedProps.label ? { label: mergedProps.label } : {}), ...accessibility };
  return { id, type, elementVersion: 1, layout: { x: 30, y: 100, width: 300, height: type === 'line' ? 10 : type === 'text' ? 90 : 160, rotation: 0, ...layout }, props: mergedProps, accessibility: mergedAccessibility, ...(descriptor.actions.length ? { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: null }] } : {}), ...other };
}
