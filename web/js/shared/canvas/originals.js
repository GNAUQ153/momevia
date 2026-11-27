import { originalsArtwork } from './originals-art.js';
import { originalDefinition } from './originals-data.js';
import { createElement } from './registry.js';
import { validateDocument } from './schema.js';

// Bốn cảnh dùng cùng schema với Editor, preview và trang nhận thiệp.
// Mỗi hình, chữ và khung là một lớp có thể chỉnh sửa; không raster hóa nội dung.
export function createOriginalTemplate(id, localize) {
  const palette = originalDefinition(id);
  if (!palette) return null;
  const p = palette;
  const t = key => localize('originals.' + key);
  const copy = key => localize('templates.' + id + '.' + key);
  const journey = key => localize('moments.cards.' + id + '.' + key);
  const invitation = p.cardType === 'invitation';
  const headlineFont = p.category === 'wedding' ? 'serif' : 'heading';
  const paper = '#FFFCF7';
  const doc = {
    schemaVersion: 2,
    registryVersion: 2,
    artboard: {
      baseSize: { width: 390, height: 844 },
      layoutMode: 'responsive-scene',
      safeInsets: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    entrySceneId: 'scene-cover',
    bindings: Object.fromEntries(['recipientName', 'senderName', 'message'].map(key => [key, { type: 'text', value: '' }])),
    assets: [],
    elements: [],
    scenes: [],
    responsive: {
      textOverflow: 'expand-flow',
      sceneOverflow: 'scroll',
      desktop: { maxContentWidth: 390, align: 'center' },
    },
  };
  function add(scene, type, id, box, props, extra = {}) {
    const [x, y, width, height] = box;
    const element = createElement(type, {
      id,
      name: localize('editor.element.' + type),
      layout: { x, y, width, height, rotation: 0 },
      props,
      ...extra,
    }, localize);
    doc.elements.push(element);
    scene.elementIds.push(id);
    return element;
  }
  const shape = (scene, id, box, color, kind = 'rectangle', radius = 16, strokeWidth = 0) =>
    add(scene, 'shape', id, box, { kind, color, radius, strokeColor: p.detail, strokeWidth });
  const art = (scene, id, box, stickerId, color = p.detail) =>
    add(scene, 'sticker', id, box, { stickerId, color });
  function text(scene, id, box, value, size = 18, fontToken = 'body', binding = false) {
    return add(scene, 'text', id, box, {
      ...(binding ? { textBinding: value } : { text: value }),
      fontSize: size,
      fontToken,
      align: 'center',
      color: p.ink,
      lineHeight: 1.35,
    }, id.endsWith('-title') ? { accessibility: { role: 'heading', level: 1 } } : {});
  }
  const go = (scene, id, label, target, y = 746, height = 56) =>
    add(scene, 'button', id, [36, y, 318, height], { label, color: p.button }, {
      actions: [{ on: 'activate', type: 'goToScene', targetSceneId: target }],
    });
  function scene(id, name, transition = 'T01') {
    const model = {
      id,
      name,
      background: { kind: 'solid', color: p.bg },
      elementIds: [],
      effects: { transition: { id: transition, speed: 'normal' } },
    };
    doc.scenes.push(model);
    const prefix = id.slice(6);
    shape(model, id === 'scene-cover' ? 'originals-' + p.id : prefix + '-top-rule', [24, 22, 342, 3], p.button, 'rectangle', 1);
    art(model, prefix + '-corner', [344, 788, 24, 24], p.motif);
    return model;
  }

  const cover = scene('scene-cover', localize('templates.scene.cover'));
  text(cover, 'cover-kicker', [42, 45, 306, 28], invitation ? t('invited') : t('to'), 15, 'heading');
  text(cover, 'cover-title', [30, 94, 330, 132], copy('headline'), 35, headlineFont);
  text(cover, 'text-recipient', [36, 240, 318, 58], 'recipientName', 24, 'heading', true);

  // Năm bố cục vật liệu riêng, kết hợp 16 minh họa nguyên bản.
  const arch = p.layout === 'arch';
  shape(cover, 'cover-shadow', [40, 326, 320, 268], p.detail, arch ? 'arch' : 'rectangle', 20);
  shape(cover, 'cover-paper', [30, 316, 320, 268], paper, arch ? 'arch' : 'rectangle', 20);
  if (p.layout === 'ribbon') {
    shape(cover, 'cover-ribbon', [30, 526, 320, 26], p.detail, 'rectangle', 0);
    shape(cover, 'ribbon-tail', [308, 316, 20, 268], p.detail, 'rectangle', 0);
  }
  if (p.layout === 'ticket') {
    add(cover, 'line', 'ticket-rule', [52, 554, 276, 6], { pattern: 'stitched', color: p.detail, strokeWidth: 2 });
    shape(cover, 'ticket-cut-left', [16, 442, 28, 28], p.bg, 'ellipse', 0);
    shape(cover, 'ticket-cut-right', [336, 442, 28, 28], p.bg, 'ellipse', 0);
  }
  if (p.layout === 'postcard') {
    shape(cover, 'postage-stamp', [286, 330, 44, 50], p.bg, 'rectangle', 4, 1);
    add(cover, 'line', 'postage-lines', [52, 552, 212, 4], { pattern: 'stitched', color: p.detail, strokeWidth: 2 });
  }
  if (p.layout === 'book') {
    shape(cover, 'book-spine', [30, 316, 22, 268], p.button, 'rectangle', 3);
    shape(cover, 'book-ribbon', [296, 316, 16, 48], p.detail, 'rectangle', 0);
  }
  add(cover, 'sticker', 'cover-art', [82, 330, 222, 216], {
    stickerId: 'originals-illustration',
    color: p.button,
  }, { artwork: originalsArtwork(id) });
  if (p.opener === 'button') {
    go(cover, 'open-gift', journey('open'), 'scene-main', 616, 60);
  } else {
    add(cover, p.opener, 'open-gift', [72, 584, 246, 106], { label: journey('open'), color: p.button }, {
      actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-main' }],
      effects: { reaction: { id: p.opener === 'envelope' ? 'R01' : 'R02', speed: 'normal' } },
    });
  }
  text(cover, 'cover-note', [40, 704, 310, 68], journey('hint'), 16);
  go(cover, 'skip-surprise', localize('moments.cards.skip'), 'scene-main', 776, 44);

  const main = scene('scene-main', localize('templates.scene.wish'), p.layout === 'book' ? 'T03' : 'T01');
  text(main, 'main-title', [36, 58, 318, 110], copy('headline'), 30, headlineFont);
  text(main, 'text-message', [36, 190, 318, 144], 'message', 20, 'body', true);
  text(main, 'text-sender', [42, 348, 306, 52], 'senderName', 20, 'heading', true);
  if (invitation) {
    shape(main, 'event-paper', [24, 420, 342, 270], paper, 'rectangle', 20);
    text(main, 'event-date', [40, 440, 310, 78], localize('interactive.datePrompt'), 20, 'heading');
    text(main, 'event-location', [40, 530, 310, 78], localize('interactive.placePrompt'), 18);
    text(main, 'event-note', [42, 628, 306, 46], t('dress'), 16);
  } else {
    shape(main, 'memory-frame', [76, 434, 238, 260], paper, 'rectangle', 14);
    add(main, 'image', 'memory-photo', [87, 445, 216, 226], {
      assetId: null, optional: true, fit: 'cover', radius: 8, caption: t('photo'),
    }, { accessibility: { alt: t('photo') } });
  }
  go(main, 'to-discover', journey('discover'), 'scene-discover');

  const discover = scene('scene-discover', journey('discover'), 'T03');
  text(discover, 'discover-title', [36, 60, 318, 90], journey('discover'), 28, headlineFont);
  const entries = [{ heading: journey('reveal'), body: journey('secret') }];
  if (p.interaction === 'foldout-letter' || p.interaction === 'wish-pick') {
    entries.splice(0, 1, ...[['wish', 'wishBody'], ['wish2', 'wishBody2'], ['wish3', 'wishBody3']]
      .map(([heading, body]) => ({ heading: t(heading), body: t(body) })));
  }
  add(discover, 'interaction', 'surprise', [32, 172, 326, 230], {
    kind: p.interaction,
    color: paper,
    entries,
    ...(p.interaction === 'foldout-letter' ? { appearance: 'paper-fold-v2' } : {}),
  });
  add(discover, 'interaction', 'event-album', [32, 426, 326, 272], {
    kind: 'swipe-album',
    color: p.bg,
    optional: true,
    autoplay: false,
    photos: Array.from({ length: 3 }, (_, i) => ({
      id: 'photo-' + (i + 1), assetId: null, alt: '', caption: '', focalPoint: { x: .5, y: .5 },
    })),
  });
  // Luôn có đường đi tiếp: người nhận không buộc phải cào, ghép hay bật âm thanh.
  go(discover, 'to-finish', localize('moments.cards.reply'), 'scene-finish');

  const finish = scene('scene-finish', t('finish'));
  finish.effects.ambience = {
    id: p.category === 'wedding' ? 'B02' : 'B01',
    speed: 'normal',
    density: 'sparse',
    loop: false,
  };
  art(finish, 'finish-art', [155, 64, 80, 80], p.motif, p.button);
  text(finish, 'finish-title', [36, 166, 318, 90], t('finish'), 28, headlineFont);
  text(finish, 'finish-note', [40, 270, 310, 94], journey('secret'), 18);
  add(finish, 'reply', 'reply-card', [28, 400, 334, 300], {
    title: localize('gift.reply.send'),
    submitLabel: localize('gift.reply.send'),
  });
  add(finish, 'button', 'replay-gift', [60, 746, 270, 56], {
    label: localize('templates.preset.replay'), color: p.button,
  }, { actions: [{ on: 'activate', type: 'replay' }] });
  return validateDocument(doc);
}
