import { canonicalText } from '../../locale.js';
import { createElement } from '../registry.js';
import { validateDocument } from '../schema.js';
import { createSignatureArtwork, signatureConcept, signatureIds } from './art.js';

// Sáu bản dựng nội bộ: chưa đưa vào seed Catalog cho tới khi nghiệm thu tương tác.
const palettes = Object.freeze({
  'secret-santa': ['#F4ECDC', '#E0B27A', '#0E3B33', '#F4ECDC', '#145246'],
  'midnight-soiree': ['#F1E8D4', '#C9A45C', '#F1E8D4', '#0F1A2E', '#8A3044'],
  'garden-tea': ['#172C18', '#A9575F', '#34452F', '#F8EBE6', '#476343'],
  'last-chapter': ['#A51C30', '#B91F32', '#242424', '#EDF4F7', '#A51C30'],
  'graduation-mixtape': ['#65243C', '#B52D59', '#65243C', '#F5EDDF', '#8B254B'],
  'graduation-countdown': ['#9C1645', '#C82159', '#302125', '#F8E6E8', '#A31343'],
});
export const signatureTemplateIds = Object.freeze(signatureIds.map(id => `signature-${id}`));
export function signatureTemplateDefinition(id) {
  if (!signatureTemplateIds.includes(id)) return null;
  const conceptId = id.slice('signature-'.length);
  return { ...signatureConcept(conceptId), id, conceptId, cardType: 'invitation', scenes: 4 };
}

export function createSignatureTemplate(id, localize = canonicalText) {
  const p = signatureTemplateDefinition(id);
  if (!p) return null;
  const [coverInk, accent, ink, paper, button] = palettes[p.conceptId];
  const copy = key => localize(`signature.templates.${p.conceptId}.${key}`);
  const t = key => localize(`signature.templates.${key}`);
  const doc = {
    schemaVersion: 2, registryVersion: 2,
    artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 20, bottom: 24, left: 20 } },
    entrySceneId: 'scene-cover',
    bindings: Object.fromEntries(['recipientName', 'senderName', 'message'].map(key => [key, { type: 'text', value: '' }])),
    assets: [], scenes: [], elements: [],
    responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 600, align: 'center' } },
  };
  const scene = (id, name, color) => {
    const value = { id, name, background: { kind: 'solid', color }, elementIds: [] };
    doc.scenes.push(value);
    return value;
  };
  const append = (s, element) => {
    s.elementIds.push(element.id);
    doc.elements.push(element);
    return element;
  };
  const add = (s, type, id, box, props, extra = {}) => {
    const [x, y, width, height, rotation = 0] = box;
    return append(s, createElement(type, { id, name: localize(`editor.element.${type}`), layout: { x, y, width, height, rotation }, props, ...extra }, localize));
  };
  const text = (s, key, value, box, size, color = ink, fontToken = 'body', bind = false) => add(s, 'text', key, box, {
    ...(bind ? { textBinding: value } : { text: value }), fontToken, fontSize: size, align: 'center', lineHeight: 1.3, color,
  }, fontToken === 'serif' ? { accessibility: { role: 'heading', level: 1 } } : {});
  const go = (s, id, label, target, y = 758) => add(s, 'button', id, [44, y, 302, 54], { label, color: button }, {
    actions: [target ? { on: 'activate', type: 'goToScene', targetSceneId: target } : { on: 'activate', type: 'replay' }],
  });
  // Khung viền riêng được lưu dưới dạng vector, không dùng preset artwork Classic.
  const frame = (s, id, box, color, dashed = false) => add(s, 'shape', id, box, { kind: `signature-${id}`, color, radius: 0 }, {
    artwork: { paths: [{ d: 'M1 1H99V99H1Z', fill: 'none', stroke: 'color', strokeWidth: 0.28, ...(dashed ? { dash: '2 2' } : {}) }] },
  });
  const photo = (s, key, box) => add(s, 'image', key, box, { assetId: null, optional: true, fit: 'cover', radius: 4 }, { accessibility: { alt: t('photo') } });

  const cover = scene('scene-cover', t('cover'), p.background);
  // Họa tiết gợi lại nền sao, giấy kẻ và scrapbook trong HTML nguồn, tách khỏi artwork chính.
  const star = (x, y) => `M${x-0.7} ${y}H${x+0.7}M${x} ${y-0.45}V${y+0.45}`;
  const textures = {
    'secret-santa': [[8,12],[92,15],[13,33],[85,35],[12,78],[88,78],[25,84],[75,84]].map(([x,y]) => star(x,y)).join(' '),
    'midnight-soiree': [[18,14],[80,20],[66,9],[30,82],[86,76],[12,51],[90,52]].map(([x,y]) => star(x,y)).join(' '),
    'garden-tea': 'M10 38Q8 30 14 24M90 75Q92 83 86 89',
    'last-chapter': Array.from({ length: 22 }, (_, i) => `M4 ${6+i*4}H96`).join(' '),
    'graduation-mixtape': 'M6 7H16V9H6ZM84 7H94V9H84ZM6 89H16V91H6ZM84 89H94V91H84Z',
    'graduation-countdown': 'M6 8H20M8 10H16M84 83H94M86 85H91',
  };
  add(cover, 'shape', 'cover-decoration', [0, 0, 390, 844], { kind: 'signature-cover-decoration', color: accent, radius: 0 }, {
    opacity: p.conceptId === 'last-chapter' ? 0.17 : 0.55,
    artwork: { paths: [{ d: textures[p.conceptId], fill: 'none', stroke: 'color', strokeWidth: 0.14 }] },
  });
  frame(cover, 'cover-border', [14, 14, 362, 816], coverInk);
  text(cover, 'cover-kicker', copy('kicker'), [24, 45, 342, 35], 15, coverInk, 'heading');
  const countdown = p.conceptId === 'graduation-countdown';
  text(cover, 'cover-title', copy('title'), countdown ? [25, 91, 215, 115] : [25, 89, 340, 110], 32, coverInk, 'serif');
  text(cover, 'text-recipient', 'recipientName', [36, 208, 318, 42], 18, coverInk, 'body', true);
  // ID ổn định cho template seed và semantic slots; S1 vẫn tạo ID mới khi chèn từ Elements.
  for (const [index, element] of createSignatureArtwork(p.conceptId).entries()) {
    const role = element.id.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '');
    element.id = `cover-${role}-${index}`;
    element.name = t(`layer.${p.conceptId}.${index}`);
    if (element.type === 'image') element.accessibility.alt = t('photo');
    append(cover, element);
  }
  go(cover, 'open-gift', t(`opening.${p.opening}`), 'scene-event');

  const event = scene('scene-event', t('event'), paper);
  frame(event, 'event-border', [18, 18, 354, 808], accent);
  text(event, 'event-kicker', copy('kicker'), [40, 58, 310, 32], 14, ink, 'heading');
  text(event, 'event-title', copy('title'), [35, 100, 320, 112], 32, ink, 'serif');
  text(event, 'text-message', 'message', [44, 226, 302, 155], 19, ink, 'body', true);
  frame(event, 'event-ticket', [32, 402, 326, 225], accent, true);
  text(event, 'event-date-label', t('date'), [48, 420, 294, 30], 14, ink, 'heading');
  text(event, 'event-date', localize('interactive.datePrompt'), [45, 459, 300, 62], 18);
  text(event, 'event-location-label', t('venue'), [48, 531, 294, 28], 14, ink, 'heading');
  text(event, 'event-location', localize('interactive.placePrompt'), [45, 564, 300, 57], 18);
  text(event, 'text-sender', 'senderName', [42, 665, 306, 55], 20, ink, 'serif', true);
  go(event, 'to-memory', t('memory'), 'scene-memory');

  const memory = scene('scene-memory', t('memory'), paper);
  frame(memory, 'memory-border', [18, 18, 354, 808], accent);
  text(memory, 'memory-title', copy('memory'), [35, 52, 320, 95], 30, ink, 'serif');
  frame(memory, 'photo-frame-a', [44, 168, 302, 299, -2], accent);
  photo(memory, 'memory-photo-a', [56, 180, 278, 252, -2]);
  text(memory, 'memory-caption-a', t('photo'), [58, 435, 274, 30, -2], 15);
  frame(memory, 'photo-frame-b', [82, 482, 226, 222, 3], accent);
  photo(memory, 'memory-photo-b', [92, 492, 206, 176, 3]);
  text(memory, 'memory-caption-b', t('photo'), [95, 673, 200, 26, 3], 15);
  go(memory, 'to-finish', t('finish'), 'scene-finish');

  const finish = scene('scene-finish', t('finish'), paper);
  frame(finish, 'finish-border', [18, 18, 354, 808], accent);
  text(finish, 'finish-title', copy('finish'), [34, 88, 322, 105], 32, ink, 'serif');
  text(finish, 'finish-note', t('reply'), [42, 210, 306, 95], 18);
  add(finish, 'reply', 'reply-card', [30, 340, 330, 330], { title: localize('gift.reply.send'), submitLabel: localize('gift.reply.send') });
  go(finish, 'replay-gift', localize('templates.preset.replay'), null);
  return validateDocument(doc);
}
