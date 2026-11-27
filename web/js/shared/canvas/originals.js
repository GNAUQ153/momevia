import { originalsArtwork } from './originals-art.js';
import { originalDefinition } from './originals-data.js';
import { createElement } from './registry.js';
import { validateDocument } from './schema.js';

// Mỗi scene là các layer Canvas độc lập; không dùng ảnh chứa sẵn văn bản.
export function createOriginalTemplate(id, localize) {
  const p = originalDefinition(id);
  if (!p) return null;
  const t = key => localize(`originals.${key}`);
  const copy = key => localize(`templates.${id}.${key}`);
  const invitation = p.cardType === 'invitation';
  const doc = {
    schemaVersion: 2, registryVersion: 2,
    artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 24, bottom: 24, left: 24 } },
    entrySceneId: 'scene-cover',
    bindings: Object.fromEntries(['recipientName', 'senderName', 'message'].map(key => [key, { type: 'text', value: '' }])),
    assets: [], elements: [], scenes: [],
    responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 600, align: 'center' } },
  };
  const add = (scene, type, key, box, props, extra = {}) => {
    const [x, y, width, height] = box;
    const element = createElement(type, { id: key, name: localize(`editor.element.${type}`), layout: { x, y, width, height, rotation: 0 }, props, ...extra }, localize);
    doc.elements.push(element);
    scene.elementIds.push(key);
    return element;
  };
  const shape = (s, key, box, color, kind = 'rectangle', radius = 12, strokeWidth = 0) => add(s, 'shape', key, box, { kind, color, radius, strokeColor: p.detail, strokeWidth });
  const art = (s, key, box, stickerId, color = p.detail) => add(s, 'sticker', key, box, { stickerId, color });
  const text = (s, key, box, value, size = 18, fontToken = 'body', align = 'center', binding = false) => add(s, 'text', key, box, {
    ...(binding ? { textBinding: value } : { text: value }), fontSize: size, fontToken, align, color: p.ink, lineHeight: 1.35,
  }, fontToken === 'serif' ? { accessibility: { role: 'heading', level: 1 } } : {});
  const go = (s, key, label, target, y = 746) => add(s, 'button', key, [42, y, 306, 56], { label, color: p.button }, { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: target }] });
  const scene = (id, name, transition = 'T01') => {
    const s = { id, name, background: { kind: 'solid', color: p.bg }, elementIds: [], effects: { transition: { id: transition, speed: 'normal' } } };
    doc.scenes.push(s);
    const prefix = id.slice(6);
    // Các khung giấy, họa tiết và bóng đều có thể chỉnh độc lập.
    shape(s, `${prefix}-outer`, [14, 14, 362, 816], p.bg, 'rectangle', 20, 1);
    shape(s, `${prefix}-inner`, [22, 22, 346, 800], p.bg, 'rectangle', 16, 1);
    art(s, `${prefix}-top-left`, [24, 24, 34, 34], p.motif);
    art(s, `${prefix}-bottom-right`, [332, 786, 34, 34], p.motif);
    return s;
  };
  const cover = scene('scene-cover', localize('templates.scene.cover'));
  text(cover, 'cover-kicker', [55, 62, 280, 28], invitation ? t('invited') : t('to'), 15, 'heading');
  text(cover, 'cover-title', [35, 110, 320, 124], copy('headline'), 35, 'serif');
  text(cover, 'text-recipient', [45, 242, 300, 62], 'recipientName', 25, 'heading', 'center', true);
  const kind = { arch: 'arch', ribbon: 'rectangle', ticket: 'rectangle', postcard: 'rectangle', book: 'rectangle' }[p.layout];
  shape(cover, 'cover-shadow', [58, 330, 274, 300], p.detail, kind, 18);
  shape(cover, 'cover-paper', [48, 320, 274, 300], '#FFFBF2', kind, 18, 1);
  if (p.layout === 'book') shape(cover, 'book-spine', [48, 320, 14, 300], p.button, 'rectangle', 3);
  if (p.layout === 'ribbon') shape(cover, 'cover-ribbon', [48, 465, 274, 26], p.detail, 'rectangle', 0);
  if (p.layout === 'ticket') add(cover, 'line', 'ticket-rule', [72, 541, 225, 8], { pattern: 'stitched', color: p.detail, strokeWidth: 2 });
  if (p.layout === 'postcard') shape(cover, 'postage-stamp', [266, 336, 40, 48], p.detail, 'rectangle', 2);
  add(cover, 'sticker', 'cover-art', [86, 336, 198, 178], { stickerId: 'originals-illustration', color: p.button }, { artwork: originalsArtwork(id) });
  if (p.opener === 'button') go(cover, 'open-gift', t('open'), 'scene-main', 552);
  else add(cover, p.opener, 'open-gift', [78, 505, 234, 108], { label: t('open'), color: p.button }, { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-main' }], effects: { reaction: { id: p.opener === 'envelope' ? 'R01' : 'R02', speed: 'normal' } } });
  text(cover, 'cover-note', [45, 650, 300, 90], copy('note'), 17);

  const main = scene('scene-main', localize('templates.scene.wish'), p.layout === 'book' ? 'T03' : 'T01');
  text(main, 'main-title', [40, 60, 310, 108], copy('headline'), 32, 'serif');
  text(main, 'text-message', [40, 183, 310, invitation ? 112 : 170], 'message', 21, 'body', 'center', true);
  text(main, 'text-sender', [50, invitation ? 300 : 365, 290, 65], 'senderName', 20, 'heading', 'center', true);
  if (invitation) {
    text(main, 'event-date', [45, 380, 300, 78], localize('interactive.datePrompt'), 18);
    text(main, 'event-location', [45, 470, 300, 95], localize('interactive.placePrompt'), 18);
    text(main, 'event-note', [45, 586, 300, 70], t('dress'), 17);
  } else {
    shape(main, 'memory-frame', [87, 460, 216, 228], '#FFFBF2', 'rectangle', 10, 1);
    add(main, 'image', 'memory-photo', [98, 471, 194, 205], { assetId: null, optional: true, fit: 'cover', radius: 8, caption: t('photo') }, { accessibility: { alt: t('photo') } });
  }
  go(main, 'to-discover', t('discover'), 'scene-discover');

  const discover = scene('scene-discover', t('discover'), 'T03');
  text(discover, 'discover-title', [40, 54, 310, 85], t('discover'), 29, 'serif');
  const entries = [{ heading: t('reveal'), body: t('secret') }];
  if (p.interaction === 'foldout-letter' || p.interaction === 'wish-pick') entries.splice(0, 1, ...[['wish','wishBody'],['wish2','wishBody2'],['wish3','wishBody3']].map(([h,b]) => ({ heading: t(h), body: t(b) })));
  add(discover, 'interaction', 'surprise', [35, 155, 320, 228], { kind: p.interaction, color: p.bg, entries,
    ...(p.interaction === 'foldout-letter' ? { appearance: 'paper-fold-v2' } : {}) });
  add(discover, 'interaction', 'event-album', [35, 405, 320, 290], { kind: 'swipe-album', color: p.bg, optional: true, autoplay: false,
    photos: Array.from({ length: 3 }, (_, i) => ({ id: `photo-${i+1}`, assetId: null, alt: '', caption: '', focalPoint: { x: .5, y: .5 } })) });
  go(discover, 'to-finish', t('close'), 'scene-finish');

  const finish = scene('scene-finish', t('finish'));
  finish.effects.ambience = { id: invitation && p.category === 'wedding' ? 'B02' : 'B01', speed: 'normal', density: 'sparse', loop: false };
  art(finish, 'finish-art', [145, 60, 100, 100], p.motif, p.button);
  text(finish, 'finish-title', [40, 176, 310, 90], t('finish'), 30, 'serif');
  text(finish, 'finish-note', [45, 275, 300, 100], copy('note'), 19);
  add(finish, 'reply', 'reply-card', [30, 400, 330, 300], { title: localize('gift.reply.send'), submitLabel: localize('gift.reply.send') });
  add(finish, 'button', 'replay-gift', [65, 746, 260, 56], { label: localize('templates.preset.replay'), color: p.button }, { actions: [{ on: 'activate', type: 'replay' }] });
  return validateDocument(doc);
}
