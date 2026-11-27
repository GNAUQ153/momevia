import { createGardenTea, GARDEN_TEA_ID } from './garden-tea.js';
import { createInteractiveTemplate } from './interactive-templates.js';
import { createOpenMeTemplate } from './open-me-templates.js';
import { canonicalText } from '../locale.js';
import { templateCopyKey } from '../template-copy.js';
import { createElement } from './registry.js';
import { validateDocument } from './schema.js';
import { COLLECTION_2027, paintCollectionCover } from './collection-2027.js';
import { emptyPrediction } from './prediction.js';
import { paintEventCard } from './event-cards.js';
import { libraryDocument } from './library-state.js';
import { pinDocumentArtwork } from './library-materialize.js';
import { paintRefreshedTemplate } from './refresh-21.js';

// Built-in editable compositions, not Creator-approved versions or new products.
// Existing IDs, prices and provenance stay with Catalog; only new starting layouts change.
export const BASIC_TEMPLATE_REVISION = 2;
export const BASIC_TEMPLATES = Object.freeze({
  'garden-tea': { motif: 'garden-tea', name: canonicalText('templates.garden-tea.title'), bg: '#F8EBE6', paper: '#F8EBE6', ink: '#34452F', accent: '#934850', detail: '#829176', button: '#934850', headline: canonicalText('templates.garden-tea.headline'), font: 'serif' },
  'loi-moi-ben-hien': {motif:'interactive',name:canonicalText('templates.loi-moi-ben-hien.title'),bg:'#F8F1E6',paper:'#F8F1E6',ink:'#263C32',accent:'#59705B',detail:'#AA5744',button:'#59705B',headline:canonicalText('templates.loi-moi-ben-hien.headline'),font:'serif'},
  'cuon-phim-ngay-ay': {motif:'interactive',name:canonicalText('templates.cuon-phim-ngay-ay.title'),bg:'#F6EBD9',paper:'#F6EBD9',ink:'#352B30',accent:'#825943',detail:'#DEA99C',button:'#825943',headline:canonicalText('templates.cuon-phim-ngay-ay.headline'),font:'serif'},
  'ban-do-ngay-ra-truong': {motif:'interactive',name:canonicalText('templates.ban-do-ngay-ra-truong.title'),bg:'#E6EFF1',paper:'#E6EFF1',ink:'#21394C',accent:'#375B6A',detail:'#E9BA63',button:'#375B6A',headline:canonicalText('templates.ban-do-ngay-ra-truong.headline'),font:'serif'},
  'midnight-bloom': { motif: 'bloom', name: canonicalText('templates.midnight-bloom.name'), bg: '#211A38', paper: '#F4ECF8', ink: '#F9F0F5', accent: '#A987C9', detail: '#E8A5BC', button: '#77539B', headline: canonicalText('templates.midnight-bloom.headline'), note: canonicalText('templates.midnight-bloom.note'), font: 'serif' },
  'sunny-wishes': { motif: 'sun', name: canonicalText('templates.sunny-wishes.name'), bg: '#FFF4C9', paper: '#FFFDF0', ink: '#3D3524', accent: '#F6C94C', detail: '#E8A16E', button: '#67522B', headline: canonicalText('templates.sunny-wishes.headline'), note: canonicalText('templates.sunny-wishes.note'), font: 'heading' },
  'love-letter': { motif: 'letter', name: canonicalText('templates.love-letter.name'), bg: '#F4DDE2', paper: '#FFFAF1', ink: '#6D3343', accent: '#C5768E', detail: '#E9B8C6', button: '#8D4059', headline: canonicalText('templates.love-letter.headline'), note: canonicalText('templates.love-letter.note'), font: 'serif' },
  starlight: { motif: 'stars', name: canonicalText('templates.starlight.name'), bg: '#142340', paper: '#F2EDDF', ink: '#F5EEDB', accent: '#D8C58D', detail: '#48688C', button: '#385572', headline: canonicalText('templates.starlight.headline'), note: canonicalText('templates.starlight.note'), font: 'serif' },
  'peachy-day': { motif: 'petal', name: canonicalText('templates.peachy-day.name'), bg: '#F9E3D8', paper: '#FFF9F2', ink: '#66483F', accent: '#DFA599', detail: '#EBC5B5', button: '#8C5D51', headline: canonicalText('templates.peachy-day.headline'), note: canonicalText('templates.peachy-day.note'), font: 'serif' },
  greenhouse: { motif: 'garden', name: canonicalText('templates.greenhouse.name'), bg: '#E6EFE5', paper: '#FAFBF3', ink: '#2E5143', accent: '#7BA486', detail: '#B5C8A6', button: '#416853', headline: canonicalText('templates.greenhouse.headline'), note: canonicalText('templates.greenhouse.note'), font: 'serif' },
  confetti: { motif: 'party', name: canonicalText('templates.confetti.name'), bg: '#FFF2E5', paper: '#FFFCF5', ink: '#773D42', accent: '#DC6B68', detail: '#739EB4', button: '#AD5057', headline: canonicalText('templates.confetti.headline'), note: canonicalText('templates.confetti.note'), font: 'heading' },
  'cloud-nine': { motif: 'cloud', name: canonicalText('templates.cloud-nine.name'), bg: '#E3F0F6', paper: '#FBFDFF', ink: '#395E76', accent: '#B1CFDF', detail: '#D4E4ED', button: '#496E8A', headline: canonicalText('templates.cloud-nine.headline'), note: canonicalText('templates.cloud-nine.note'), font: 'heading' },
  lavender: { motif: 'lavender', name: canonicalText('templates.lavender.name'), bg: '#EFE9F4', paper: '#FCFAF6', ink: '#594367', accent: '#A28CB6', detail: '#C6B6D5', button: '#775B8F', headline: canonicalText('templates.lavender.headline'), note: canonicalText('templates.lavender.note'), font: 'serif' },
  polaroid: { motif: 'polaroid', name: canonicalText('templates.polaroid.name'), bg: '#EAE1D5', paper: '#FFFCF5', ink: '#55463C', accent: '#AF9981', detail: '#D8C7AE', button: '#77604A', headline: canonicalText('templates.polaroid.headline'), note: canonicalText('templates.polaroid.note'), font: 'serif' },
  afterglow: { motif: 'sunset', name: canonicalText('templates.afterglow.name'), bg: '#F4DDD4', paper: '#FFFAF0', ink: '#714A43', accent: '#DBA276', detail: '#D38C9D', button: '#945B59', headline: canonicalText('templates.afterglow.headline'), note: canonicalText('templates.afterglow.note'), font: 'serif' },
  'tiny-celebration': { motif: 'gift', name: canonicalText('templates.tiny-celebration.name'), bg: '#E0EFE7', paper: '#F7FAF2', ink: '#315D50', accent: '#82B29C', detail: '#C8DCC1', button: '#477B67', headline: canonicalText('templates.tiny-celebration.headline'), note: canonicalText('templates.tiny-celebration.note'), font: 'heading' },
  'mot-ky-niem': { motif: 'memory', name: canonicalText('templates.mot-ky-niem.name'), bg: '#F2EDE3', paper: '#FFF9EC', ink: '#273C40', accent: '#738E86', detail: '#C98461', button: '#355658', headline: canonicalText('templates.mot-ky-niem.headline'), note: canonicalText('templates.mot-ky-niem.note'), font: 'serif' },
  'hai-phong-bi': { motif: 'two-letters', name: canonicalText('templates.hai-phong-bi.name'), bg: '#FFF8EB', paper: '#FFF8EB', ink: '#442638', accent: '#F4C9C4', detail: '#47715C', button: '#963851', headline: canonicalText('templates.hai-phong-bi.headline'), font: 'serif' },
  'to-doan-cau-se-chon': { motif: 'prediction', name: canonicalText('templates.to-doan-cau-se-chon.title'), bg: '#F5EFFF', paper: '#FFFAF6', ink: '#442638', accent: '#A987C9', detail: '#E8A5BC', button: '#77539B', headline: canonicalText('templates.to-doan-cau-se-chon.title'), font: 'serif' },
  ...COLLECTION_2027,
});
export const MEMORY_TEMPLATE_ID = 'mot-ky-niem';
export const memoryGreetingStarterKeys = ['templates.starter.memory', 'templates.starter.thanks', 'templates.starter.birthday'];

export function basicTemplateDefinition(id) { return Object.hasOwn(BASIC_TEMPLATES, id) ? BASIC_TEMPLATES[id] : null; }

const LAYER_NAMES = {
  'cover-title': 'Tiêu đề bìa', 'text-recipient': 'Tên người nhận', 'open-gift': 'Mở món quà', 'cover-note': 'Lời dẫn',
  'message-paper': 'Nền thiệp', 'message-heading': 'Tiêu đề lời chúc', 'message-to': 'Dành tặng', 'message-rule': 'Đường phân cách',
  'text-message': 'Lời chúc', 'message-from-label': 'Lời ký tên', 'text-sender': 'Tên người gửi', 'to-message': 'Mở phần hồi đáp',
  'reply-heading': 'Tiêu đề hồi đáp', 'reply-intro': 'Lời mời hồi đáp', 'reply-card': 'Khối hồi đáp', 'replay-gift': 'Xem lại món quà',
  'photo-window': 'Khung ảnh kỷ niệm', 'photo-shadow': 'Nền sau ảnh', 'photo-paper': 'Viền polaroid', 'photo-caption': 'Chú thích ảnh',
  'photo-sun': 'Mặt trời trong ảnh', 'photo-landscape': 'Cảnh minh họa',
  'envelope-memory': 'Nội dung kỷ niệm',
};

export function createBasicTemplate(template, localize = canonicalText) {
  const configured = libraryDocument('template', template?.id, localize);
  if (configured) return validateDocument(pinDocumentArtwork(configured));
  if (template?.id === GARDEN_TEA_ID) return validateDocument(createGardenTea(localize));
  const openMe = createOpenMeTemplate(template?.id, localize);
  if (openMe) return openMe;
  const interactive = createInteractiveTemplate(template?.id, localize);
  if (interactive) return interactive;
  const definition = basicTemplateDefinition(template?.id);
  if (!definition) return null;
  const p = {
    ...definition,
    headline: localize(templateCopyKey(template.id, 'headline')),
    ...(definition.note ? { note: localize(templateCopyKey(template.id, 'note')) } : {}),
  };
  const doc = {
    schemaVersion: 1, registryVersion: 1,
    artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 24, bottom: 24, left: 24 } },
    entrySceneId: 'scene-cover',
    bindings: { recipientName: { type: 'text', value: '' }, senderName: { type: 'text', value: '' }, message: { type: 'text', value: '' } },
    assets: [], elements: [],
    scenes: [
      { id: 'scene-cover', name: localize('templates.scene.cover'), background: { kind: 'solid', color: p.bg }, elementIds: [] },
      { id: 'scene-surprise', name: localize('templates.scene.wish'), background: { kind: 'solid', color: p.bg }, elementIds: [] },
      { id: 'scene-message', name: localize('templates.scene.reply'), background: { kind: 'solid', color: p.bg }, elementIds: [] },
    ],
    responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 600, align: 'center' } },
  };
  const add = (scene, type, id, box, props = {}, more = {}) => {
    const round = value => Math.round(value * 100) / 100;
    const element = createElement(type, { id, name: LAYER_NAMES[id] || `${p.name} · Trang trí ${doc.elements.length + 1}`, layout: { x: round(box[0]), y: round(box[1]), width: round(box[2]), height: round(box[3]), rotation: round(box[4] || 0) }, props, ...more }, localize);
    doc.elements.push(element); doc.scenes[scene].elementIds.push(id); return element;
  };
  const shape = (scene, id, box, color, kind = 'ellipse', extra = {}) => add(scene, 'shape', id, box, { color, kind, radius: kind === 'ellipse' ? 0 : 8, ...extra });
  const line = (scene, id, box, color = p.accent, strokeWidth = 1) => add(scene, 'line', id, box, { color, strokeWidth });
  const text = (scene, id, value, box, size = 20, color = p.ink, font = 'body', align = 'center', extra = {}) => add(scene, 'text', id, box, { text: value, fontToken: font, fontSize: size, align, color, lineHeight: 1.25, ...extra });
  const binding = (scene, id, name, box, size, color = p.ink, align = 'center') => add(scene, 'text', id, box, { textBinding: name, fontToken: 'body', fontSize: size, align, color, lineHeight: 1.55 });
  const action = (scene, type, id, label, box, targetSceneId) => add(scene, type, id, box, { label, color: p.button }, { actions: [{ on: 'activate', type: targetSceneId ? 'goToScene' : 'replay', ...(targetSceneId ? { targetSceneId } : {}) }] });
  const flower = (scene, prefix, x, y, radius, color) => {
    for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; shape(scene, `${prefix}-petal-${i}`, [x + Math.cos(angle) * radius * .55 - radius * .42, y + Math.sin(angle) * radius * .55 - radius * .42, radius * .84, radius * .84], color); }
    shape(scene, `${prefix}-center`, [x - radius * .22, y - radius * .22, radius * .44, radius * .44], p.detail);
  };
  const stem = (scene, prefix, x, y, height, color = p.accent) => {
    line(scene, `${prefix}-stem`, [x - height / 2, y + height / 2, height, 2, -90], color, 2);
    for (let i = 0; i < 4; i++) shape(scene, `${prefix}-leaf-${i}`, [x + (i % 2 ? 4 : -14), y + i * 28, 17, 42, i % 2 ? 33 : -33], i % 2 ? color : p.detail);
  };

  if (p.motif === 'prediction') {
    doc.schemaVersion = doc.registryVersion = 2;
    doc.scenes = [doc.scenes[0]];
    text(0, 'cover-title', p.headline, [30, 38, 330, 94], 32, p.ink, 'serif');
    doc.elements.at(-1).accessibility = { role: 'heading', level: 1 };
    binding(0, 'text-sender', 'senderName', [30, 136, 150, 44], 19);
    text(0, 'gift-arrow', '→', [181, 136, 28, 44], 19);
    binding(0, 'text-recipient', 'recipientName', [210, 136, 150, 44], 19);
    add(0, 'interaction', 'prediction-card', [24, 204, 342, 550], { kind: 'prediction-choice', color: p.paper, ...emptyPrediction() });
    return validateDocument(doc);
  }

  if (paintEventCard(template.id, doc, { shape, line, text, binding, action, add }, p, localize)) return validateDocument(doc);
  if (paintRefreshedTemplate(template.id, doc, { shape, line, text, binding, action, add }, p, localize)) return validateDocument(doc);

  if (p.motif === 'memory') {
    doc.scenes[0].background.color = p.paper;
    text(0, 'cover-title', p.headline, [35, 57, 320, 114], 37, p.ink, p.font);
    doc.elements.at(-1).accessibility = { role: 'heading', level: 1 };
    binding(0, 'text-recipient', 'recipientName', [40, 177, 310, 52], 23);
    shape(0, 'photo-paper', [38, 245, 314, 345, -2], '#FFFFFF', 'rectangle', { radius: 3 });
    shape(0, 'photo-window', [52, 263, 286, 247], '#DBE4D9', 'rectangle');
    shape(0, 'photo-sun', [253, 292, 48, 48], '#F3D6A1');
    shape(0, 'photo-landscape', [68, 427, 252, 67], p.accent);
    text(0, 'photo-caption', localize('templates.copy.memoryCaption'), [58, 527, 274, 52], 18, p.ink, p.font);
    action(0, 'envelope', 'open-gift', localize('templates.copy.openWish'), [53, 626, 284, 142], 'scene-surprise');
    doc.scenes[1].background.color = p.paper;
    text(1, 'message-heading', p.note, [40, 84, 310, 65], 38, p.ink, p.font);
    binding(1, 'text-message', 'message', [40, 187, 310, 370], 22, p.ink, 'left');
    binding(1, 'text-sender', 'senderName', [40, 588, 310, 58], 22, p.ink, 'right');
    action(1, 'button', 'to-message', localize('templates.copy.sendReply'), [83, 696, 224, 55], 'scene-message');
    add(2, 'reply', 'reply-card', [24, 148, 342, 340], {});
    action(2, 'button', 'replay-gift', localize('templates.copy.backToCover'), [105, 650, 180, 56]);
    return validateDocument(doc);
  }
  if (p.motif === 'two-letters') {
    doc.scenes[1].name = localize('templates.scene.memory');
    doc.scenes[2].name = localize('templates.scene.secondEnvelope');
    text(0, 'cover-title', p.headline, [36, 62, 318, 103], 36, p.ink, p.font);
    doc.elements.at(-1).accessibility = { role: 'heading', level: 1 };
    binding(0, 'text-recipient', 'recipientName', [44, 180, 302, 56], 24);
    action(0, 'envelope', 'open-memory', localize('templates.copy.memory'), [49, 274, 292, 153, -2], 'scene-surprise');
    action(0, 'envelope', 'open-wish', localize('templates.copy.oneWish'), [49, 502, 292, 153, 2], 'scene-message');
    doc.scenes[1].background.color = p.paper;
    text(1, 'memory-heading', localize('templates.copy.memory'), [42, 67, 306, 83], 37, p.ink, p.font);
    text(1, 'envelope-memory', localize('templates.copy.memoryBody'), [44, 191, 302, 220], 24, p.ink, p.font, 'left');
    action(1, 'button', 'memory-back', localize('templates.copy.backToEnvelopes'), [77, 629, 236, 56], 'scene-cover');
    text(2, 'message-heading', localize('templates.copy.oneWish'), [39, 55, 312, 99], 32, p.ink, p.font);
    binding(2, 'text-message', 'message', [41, 172, 308, 204], 21, p.ink, 'left');
    binding(2, 'text-sender', 'senderName', [41, 406, 308, 51], 21, p.ink, 'right');
    action(2, 'button', 'wish-back', localize('templates.copy.backToEnvelopes'), [77, 488, 236, 56], 'scene-cover');
    add(2, 'reply', 'reply-card', [24, 568, 342, 235], {});
    return validateDocument(doc);
  }

  // Each cover has a recognizable silhouette before any personal text is filled.
  const collection = Object.hasOwn(COLLECTION_2027, template.id);
  if (collection) {
    paintCollectionCover(p.motif, { shape, line, text, flower, stem }, p);
  } else if (p.motif === 'bloom') {
    flower(0, 'bloom-left', 15, 74, 70, p.accent); flower(0, 'bloom-right', 382, 420, 86, p.accent);
    flower(0, 'bloom-small', 315, 75, 38, p.detail);
  } else if (p.motif === 'sun') {
    shape(0, 'sun-disc', [224, -60, 230, 230], p.accent);
    for (let i = 0; i < 5; i++) line(0, `sun-ray-${i}`, [64 + i * 44, 397 + i % 2 * 13, 26, 3, i * 28 - 45], p.detail, 4);
    shape(0, 'sun-ground', [-40, 720, 470, 180], '#F5D578');
  } else if (p.motif === 'letter') {
    shape(0, 'letter-paper', [22, 28, 346, 750, -2], p.paper, 'rectangle', { radius: 3 });
    for (let i = 0; i < 4; i++) line(0, `letter-rule-${i}`, [50, 386 + i * 18, 286, 2], '#E8D6CB');
    shape(0, 'letter-stamp', [293, 55, 45, 57, 7], p.detail, 'rectangle', { radius: 1, strokeColor: p.accent, strokeWidth: 1 });
    add(0, 'sticker', 'letter-stamp-heart', [302, 66, 26, 28, 7], { stickerId: 'heart', color: p.ink });
  } else if (p.motif === 'stars') {
    shape(0, 'moon-disc', [249, 37, 82, 82], '#F1E3BB'); shape(0, 'moon-shadow', [272, 22, 77, 77], p.bg);
    const points = [[45, 65], [93, 122], [67, 190], [326, 304], [276, 365], [337, 399]];
    for (const [i, point] of points.entries()) { shape(0, `star-${i}`, [point[0], point[1], i % 2 ? 4 : 7, i % 2 ? 4 : 7], p.accent); if (i && i !== 3) { const from = points[i - 1], dx = point[0] - from[0], dy = point[1] - from[1]; line(0, `constellation-${i}`, [from[0], from[1], Math.hypot(dx, dy), 1, Math.atan2(dy, dx) * 180 / Math.PI], p.detail); } }
  } else if (p.motif === 'petal') {
    shape(0, 'peach-petal-one', [-50, 315, 176, 265, -28], p.accent); shape(0, 'peach-petal-two', [290, 15, 140, 230, 28], p.detail);
    line(0, 'peach-rule', [155, 363, 80, 2], p.accent);
  } else if (p.motif === 'garden') {
    stem(0, 'garden-left', 22, 108, 215); stem(0, 'garden-right', 356, 310, 180);
    shape(0, 'garden-frame', [18, 24, 354, 788], p.bg, 'rectangle', { radius: 150, strokeColor: p.accent, strokeWidth: 1 });
    // Frame goes behind the leaves; visual order is separate from reading order.
    const ids = doc.scenes[0].elementIds; ids.unshift(ids.pop());
  } else if (p.motif === 'party') {
    const colors = [p.accent, p.detail, '#E6BB54', '#8DAB8F'];
    for (let i = 0; i < 18; i++) shape(0, `paper-confetti-${i}`, [16 + i * 47 % 350, 25 + i * 53 % 110, 7 + i % 3 * 3, 16, i * 29 % 120 - 60], colors[i % 4], 'rectangle', { radius: 1 });
    add(0, 'sticker', 'party-balloon', [274, 324, 72, 105, 11], { stickerId: 'balloon', color: p.accent });
    add(0, 'sticker', 'party-spark', [44, 344, 54, 54, -10], { stickerId: 'sparkles', color: '#D5A841' });
  } else if (p.motif === 'cloud') {
    for (const [i, b] of [[-50, 40, 165, 100], [25, 70, 140, 80], [235, 324, 190, 115], [165, 359, 150, 90]].entries()) shape(0, `cloud-${i}`, b, p.paper);
    line(0, 'cloud-flight', [50, 426, 92, 1, -16], p.accent, 2);
  } else if (p.motif === 'lavender') {
    for (let i = 0; i < 3; i++) {
      line(0, `lavender-stem-${i}`, [272 + i * 24, 349 + i * 11, 135, 2, -77 + i * 9], '#8A9A84', 2);
      for (let j = 0; j < 5; j++) shape(0, `lavender-bud-${i}-${j}`, [287 + i * 22 + j * 2, 249 + j * 19 + i * 12, 12, 25, -17 + i * 12], j % 2 ? p.accent : p.detail);
    }
    line(0, 'lavender-rule', [30, 73, 104, 2], p.accent);
  } else if (p.motif === 'polaroid') {
    shape(0, 'photo-shadow', [68, 71, 275, 338, 7], p.detail, 'rectangle', { radius: 2 });
    shape(0, 'photo-paper', [54, 58, 275, 338, -5], p.paper, 'rectangle', { radius: 2 });
    shape(0, 'photo-window', [77, 81, 230, 224, -5], '#CDD9D1', 'rectangle', { radius: 1 });
    shape(0, 'photo-sun', [208, 112, 52, 52], '#F6EAC8'); shape(0, 'photo-landscape', [83, 219, 216, 77, -5], '#91ACA0', 'ellipse');
    text(0, 'photo-caption', localize('templates.copy.polaroidCaption'), [77, 325, 235, 38, -5], 17, p.ink, 'serif');
  } else if (p.motif === 'sunset') {
    shape(0, 'sunset-disc', [80, 14, 230, 230], p.accent); shape(0, 'sunset-horizon', [0, 156, 390, 117], p.bg, 'rectangle', { radius: 0 });
    for (let i = 0; i < 3; i++) line(0, `sunset-horizon-${i}`, [70 + i * 18, 176 + i * 18, 250 - i * 36, 2], p.detail, 2);
  } else {
    shape(0, 'gift-oval', [96, 40, 196, 155], p.paper); add(0, 'sticker', 'tiny-gift', [151, 73, 90, 90, -8], { stickerId: 'gift', color: p.accent });
    shape(0, 'tiny-dot-left', [49, 255, 14, 14], p.accent); shape(0, 'tiny-dot-right', [321, 344, 10, 10], p.accent);
  }

  const photo = p.motif === 'polaroid', sunset = p.motif === 'sunset', gift = p.motif === 'gift';
  const headingY = collection ? 342 : photo ? 428 : sunset ? 250 : gift ? 232 : 155;
  const headingSize = collection ? 31 : p.motif === 'sun' || p.motif === 'party' ? 43 : p.motif === 'cloud' ? 42 : photo ? 33 : gift ? 34 : 38;
  text(0, 'cover-title', p.headline, [38, headingY, 314, collection ? 123 : photo ? 102 : 143], headingSize, p.ink, p.font, p.motif === 'letter' || p.motif === 'lavender' ? 'left' : 'center');
  binding(0, 'text-recipient', 'recipientName', [43, collection ? 478 : photo ? 552 : headingY + 165, 304, 56], collection ? 21 : 23);
  action(0, p.motif === 'party' || gift ? 'gift-box' : 'envelope', 'open-gift', localize('templates.copy.openGift'), [55, collection ? 548 : photo ? 629 : 485, 280, collection ? 126 : photo ? 126 : 158], 'scene-surprise');
  text(0, 'cover-note', p.note, [44, collection ? 705 : photo ? 775 : 690, 302, collection ? 62 : photo ? 48 : 75], 15, p.ink, 'body');

  // A real editable message panel with standard bindings, not a flattened cover image.
  doc.scenes[1].background.color = p.paper;
  shape(1, 'message-paper', [22, 34, 346, 723], p.paper, 'rectangle', { radius: p.motif === 'letter' || photo ? 3 : 24 });
  const messageInk = collection ? '#42354A' : ['bloom', 'stars'].includes(p.motif) ? '#4D4058' : p.ink;
  text(1, 'message-heading', localize('templates.copy.wishHeading'), [48, 70, 294, 54], 27, messageInk, p.font);
  binding(1, 'message-to', 'recipientName', [49, 145, 292, 56], 24, messageInk);
  line(1, 'message-rule', [150, 221, 90, 2], p.accent);
  binding(1, 'text-message', 'message', [49, 261, 292, 244], 21, messageInk);
  text(1, 'message-from-label', localize('templates.copy.signOff'), [49, 538, 292, 33], 17, messageInk, 'serif', 'right');
  binding(1, 'text-sender', 'senderName', [49, 585, 292, 53], 21, messageInk, 'right');
  action(1, 'button', 'to-message', localize('templates.copy.leaveReply'), [75, 680, 240, 52], 'scene-message');
  text(2, 'reply-heading', localize('templates.copy.replyHeading'), [34, 65, 322, 104], 34, p.ink, p.font);
  text(2, 'reply-intro', localize('templates.copy.replyIntro'), [42, 186, 306, 70], 18);
  add(2, 'reply', 'reply-card', [24, 292, 342, 310], { title: localize('templates.copy.replyCard'), submitLabel: localize('templates.copy.sendReply') });
  action(2, 'button', 'replay-gift', localize('templates.copy.replay'), [88, 674, 214, 52]);
  for (const id of ['cover-title', 'message-heading', 'reply-heading']) doc.elements.find(element => element.id === id).accessibility = { role: 'heading', level: 1 };
  return validateDocument(doc);
}

export function isPhotoFrame(element) { return element?.type === 'shape' && (element.id === 'photo-window' || element.name === 'Khung ảnh kỷ niệm'); }

export function framePhoto(document, frame) {
  if (!frame) return undefined;
  const scene = document.scenes.find(item => item.elementIds.includes(frame.id));
  return document.elements.find(element => element.id === `${frame.id}-image`)
    || document.elements.find(element => element.type === 'image' && element.name === 'Ảnh kỷ niệm'
      && scene?.elementIds.includes(element.id) && canonicalLayout(element.layout) === canonicalLayout(frame.layout));
}

export function insertPhotoFrame(document, assetId, frameId = 'photo-window') {
  const doc = validateDocument(document), frame = doc.elements.find(element => element.id === frameId && element.type === 'shape');
  if (!frame) throw new Error('Khung ảnh không còn trong thiết kế. Ảnh cũ vẫn được giữ.');
  const scene = doc.scenes.find(s => s.elementIds.includes(frame.id)), photoId = `${frame.id}-image`;
  let photo = framePhoto(doc, frame);
  if (photo && photo.type !== 'image') throw new Error('Lớp ảnh đã thay đổi. Chọn một khung ảnh khác.');
  if (photo) photo.props.assetId = assetId;
  else {
    photo = createElement('image', { id: photoId, name: 'Ảnh kỷ niệm', layout: { ...frame.layout }, props: { assetId, radius: frame.props.radius || 0 }, accessibility: { alt: 'Ảnh kỷ niệm người gửi chọn' } });
    if (frame.groupId) photo.groupId = frame.groupId;
    doc.elements.push(photo);
    const illustrationIds = doc.elements.filter(element => ['Mặt trời trong ảnh', 'Cảnh minh họa'].includes(element.name)).map(element => element.id);
    const at = Math.max(...[frame.id, ...illustrationIds].map(id => scene.elementIds.indexOf(id)));
    scene.elementIds.splice(Math.max(at, scene.elementIds.indexOf(frame.id)) + 1, 0, photo.id);
  }
  if (!doc.assets.some(asset => asset.assetId === assetId)) doc.assets.push({ assetId, kind: 'image' });
  return validateDocument(doc);
}
const canonicalLayout = layout => ['x', 'y', 'width', 'height', 'rotation'].map(key => layout[key]).join(':');
