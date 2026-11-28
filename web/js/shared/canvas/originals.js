import { originalsArtwork } from './originals-art.js';
import { originalDefinition } from './originals-data.js';
import { buildRig, coverTexture, shade } from './originals-rigs.js';
import { createElement } from './registry.js';
import { validateDocument } from './schema.js';

// Dựng một thiệp Originals theo hành trình của NGƯỜI NHẬN:
//   1. Bìa (scene-cover): nền tối, tên người nhận, vật thể 3D cần chạm để mở  -> tò mò
//   2. Lời mời / lời chúc (scene-main): tiêu đề, lời nhắn, thông tin sự kiện   -> bất ngờ
//   3. Khám phá (scene-discover): tương tác riêng của từng thiệp                -> tham gia
//   3b. Hai nhánh (scene-path-a / scene-path-b) nếu thiệp cho người nhận chọn  -> kết nối
//   4. Hồi đáp (scene-finish): lời kết, ô phản hồi, xem lại                     -> kết nối
// Tất cả là lớp Canvas chỉnh sửa được, dùng chung schema với Editor và trang nhận quà.
// Luôn có nút "Xem nội dung ngay" để người nhận bỏ qua hiệu ứng (yêu cầu M07/M10).

const W = 390;
const H = 844;

export function createOriginalTemplate(id, localize) {
  const p = originalDefinition(id);
  if (!p) return null;

  // Ba nguồn chữ: chung cho bộ sưu tập, riêng từng thiệp, và tiêu đề Catalog.
  const common = key => localize('stories.common.' + key);
  const story = key => localize('stories.' + id + '.' + key);
  const headline = localize('templates.' + id + '.headline');
  const invitation = p.cardType === 'invitation';
  const titleFont = p.category === 'wedding' || p.category === 'christmas' ? 'serif' : 'heading';
  const coverInk = '#FFF8EE';

  const doc = {
    schemaVersion: 2,
    registryVersion: 2,
    artboard: {
      baseSize: { width: W, height: H },
      layoutMode: 'responsive-scene',
      safeInsets: { top: 24, right: 20, bottom: 24, left: 20 },
    },
    entrySceneId: 'scene-cover',
    bindings: Object.fromEntries(['recipientName', 'senderName', 'message'].map(key => [key, { type: 'text', value: '' }])),
    assets: [],
    elements: [],
    scenes: [],
    responsive: {
      textOverflow: 'expand-flow',
      sceneOverflow: 'scroll',
      desktop: { maxContentWidth: 430, align: 'center' },
    },
  };

  // ---- Hàm tạo lớp dùng chung ----
  function add(scene, type, elementId, box, props, extra = {}) {
    const [x, y, width, height, rotation = 0] = box;
    const element = createElement(type, {
      id: elementId,
      name: extra.name || localize('editor.element.' + type),
      layout: { x, y, width, height, rotation },
      props,
      ...extra,
    }, localize);
    if (extra.name) element.name = extra.name;
    doc.elements.push(element);
    scene.elementIds.push(elementId);
    return element;
  }

  // Hiện dần theo nhịp 0 / 150 / 300 ms để mắt người nhận đi từ trên xuống.
  const enter = (step = 0, effect = 'E02') => ({ entrance: { id: effect, speed: 'normal', delay: [0, 150, 300][step] } });

  function text(scene, elementId, box, value, options = {}) {
    const {
      size = 18,
      font = 'body',
      color = p.ink,
      bind = false,
      step = 0,
      heading = false,
    } = options;
    return add(scene, 'text', elementId, box, {
      ...(bind ? { textBinding: value } : { text: value }),
      fontSize: size,
      fontToken: font,
      align: 'center',
      color,
      lineHeight: 1.35,
    }, {
      effects: enter(step),
      ...(heading ? { accessibility: { role: 'heading', level: 1 } } : {}),
    });
  }

  function go(scene, elementId, label, target, y = 760, color = p.button) {
    return add(scene, 'button', elementId, [36, y, 318, 56], { label, color }, {
      actions: [{ on: 'activate', type: 'goToScene', targetSceneId: target }],
    });
  }

  const motifArt = (scene, elementId, box) => add(scene, 'sticker', elementId, box, {
    stickerId: 'originals-illustration',
    color: p.button,
  }, { artwork: originalsArtwork(id), effects: enter(0, 'E01') });

  function scene(sceneId, name, background, transition) {
    const model = {
      id: sceneId,
      name,
      background: { kind: 'solid', color: background },
      elementIds: [],
      effects: { transition: { id: transition, speed: 'normal' } },
    };
    doc.scenes.push(model);
    return model;
  }

  // ---- 1. Bìa: tối, chỉ có một việc cần làm là chạm mở ----
  const cover = scene('scene-cover', localize('templates.scene.cover'), p.night, 'T01');
  add(cover, 'shape', 'cover-decoration', [0, 0, W, H], {
    kind: 'signature-cover-decoration',
    color: p.detail,
    radius: 0,
  }, {
    name: common('layerTexture'),
    opacity: 0.6,
    artwork: { paths: [{ d: coverTexture(p.category), fill: 'none', stroke: 'color', strokeWidth: 0.16 }] },
  });
  add(cover, 'shape', 'cover-border', [14, 14, W - 28, H - 28], {
    kind: 'signature-cover-border',
    color: p.detail,
    radius: 0,
  }, {
    name: common('layerBorder'),
    opacity: 0.7,
    artwork: { paths: [{ d: 'M1 1H99V99H1Z', fill: 'none', stroke: 'color', strokeWidth: 0.28 }] },
  });
  text(cover, 'cover-kicker', [30, 48, 330, 26], story('kicker'), { size: 14, font: 'heading', color: p.detail });
  text(cover, 'cover-title', [24, 80, 342, 96], headline, { size: 32, font: titleFont, color: coverInk, heading: true, step: 1 });
  text(cover, 'cover-for', [40, 186, 310, 22], common('forYou'), { size: 13, color: coverInk, step: 1 });
  text(cover, 'text-recipient', [40, 210, 310, 40], 'recipientName', { size: 24, font: 'heading', color: p.detail, bind: true, step: 2 });

  // Vật thể 3D: thứ tự lớp = thứ tự vẽ. Khung cửa đôi có minh họa ẩn phía sau.
  for (const part of buildRig(p)) {
    add(cover, 'shape', 'rig-' + part.role, part.box, {
      kind: 'signature-' + part.role,
      color: part.color,
      radius: 0,
    }, { name: part.name, artwork: { paths: part.paths } });
    if (part.role === 'window') motifArt(cover, 'rig-window-art', [105, 360, 180, 180]);
  }

  // Nút mở duy nhất của bìa: runtime gắn hoạt ảnh mở 3D vào nút có id "open-gift".
  add(cover, 'button', 'open-gift', [60, 664, 270, 58], { label: story('open'), color: p.cta }, {
    actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-main' }],
  });
  text(cover, 'cover-note', [36, 730, 318, 40], story('hint'), { size: 14, color: coverInk });
  add(cover, 'button', 'skip-surprise', [110, 776, 170, 38], {
    label: common('skip'),
    color: shade(p.night, 0.18),
  }, {
    actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-main' }],
  });

  // ---- 2. Lời mời / lời chúc ----
  const main = scene('scene-main', localize('templates.scene.wish'), p.bg, 'T06');
  motifArt(main, 'cover-art', [150, 34, 90, 90]);
  text(main, 'main-kicker', [30, 130, 330, 24], invitation ? common('invited') : story('kicker'), { size: 14, font: 'heading', color: p.button });
  text(main, 'main-title', [24, 158, 342, 88], headline, { size: 30, font: titleFont, heading: true, step: 1 });
  text(main, 'text-message', [32, 252, 326, 132], 'message', { size: 19, bind: true, step: 1 });
  text(main, 'text-sender', [40, 390, 310, 40], 'senderName', { size: 18, font: 'heading', color: p.button, bind: true, step: 2 });

  if (invitation) {
    // Vé sự kiện: event-date / event-location là hợp đồng với invitation.js (M06).
    add(main, 'shape', 'event-paper', [24, 446, 342, 250], {
      kind: 'rectangle',
      color: p.paper,
      radius: 22,
      strokeColor: p.detail,
      strokeWidth: 2,
    }, { effects: { surface: { id: 'S01' }, entrance: { id: 'E02', speed: 'normal', delay: 300 } } });
    add(main, 'shape', 'event-notch-left', [10, 556, 28, 28], { kind: 'ellipse', color: p.bg, radius: 0 });
    add(main, 'shape', 'event-notch-right', [352, 556, 28, 28], { kind: 'ellipse', color: p.bg, radius: 0 });
    text(main, 'event-label', [44, 464, 302, 22], common('eventLabel'), { size: 13, font: 'heading', color: p.button, step: 2 });
    text(main, 'event-date', [44, 492, 302, 60], localize('interactive.datePrompt'), { size: 20, font: 'heading', step: 2 });
    add(main, 'line', 'event-rule', [60, 568, 270, 4], { pattern: 'stitched', color: p.detail, strokeWidth: 2 });
    text(main, 'event-location', [44, 584, 302, 60], localize('interactive.placePrompt'), { size: 17, step: 2 });
    text(main, 'event-note', [44, 648, 302, 32], story('dress'), { size: 14, color: p.button, step: 2 });
  } else {
    // Khung ảnh nghiêng: minh họa nằm dưới ảnh, nên khi không có ảnh khung vẫn đẹp.
    add(main, 'shape', 'memory-frame', [70, 448, 250, 250, -3], {
      kind: 'rectangle',
      color: p.paper,
      radius: 10,
    }, { effects: { surface: { id: 'S01' }, entrance: { id: 'E02', speed: 'normal', delay: 300 } } });
    motifArt(main, 'memory-art', [120, 478, 150, 150]);
    add(main, 'image', 'memory-photo', [84, 462, 222, 192, -3], {
      assetId: null,
      optional: true,
      fit: 'cover',
      radius: 6,
      caption: common('photo'),
    }, { accessibility: { alt: common('photo') } });
  }
  go(main, 'to-discover', story('discoverTitle'), 'scene-discover');

  // ---- 3. Khám phá: tương tác riêng của từng thiệp ----
  const discover = scene('scene-discover', story('discoverTitle'), p.bg, 'T03');
  text(discover, 'discover-title', [24, 48, 342, 70], story('discoverTitle'), { size: 28, font: titleFont, heading: true });
  text(discover, 'discover-hint', [36, 120, 318, 52], story('discoverHint'), { size: 16, step: 1 });

  const entry = n => ({ heading: story('e' + n + 'h'), body: story('e' + n + 'b') });
  const primary = {
    'scratch-ticket': { size: [326, 196], props: { entries: [entry(1)] } },
    'flip-card': { size: [320, 178], props: { entries: [entry(1)] } },
    'wish-pick': { size: [334, 182], props: { entries: [entry(1), entry(2), entry(3)] } },
    'foldout-letter': { size: [336, 230], props: { entries: [entry(1), entry(2), entry(3)], appearance: 'paper-fold-v2' } },
    'light-a-candle': { size: [230, 187], props: { entries: [entry(1)], appearance: 'classic' } },
    'heart-puzzle': { size: [293, 199], props: { entries: [entry(1)] } },
    'scene-choices': { size: [332, 180], props: { entries: [{ heading: story('choiceA') }, { heading: story('choiceB') }] } },
  }[p.discover];
  const [pw, ph] = primary.size;
  const primaryY = p.branch ? 360 : 190;
  if (p.branch) motifArt(discover, 'discover-art', [135, 186, 120, 120]);
  add(discover, 'interaction', 'surprise', [Math.round((W - pw) / 2), primaryY, pw, ph], {
    kind: p.discover,
    color: p.paper,
    ...primary.props,
  }, {
    effects: { entrance: { id: 'E02', speed: 'normal', delay: 150 } },
    ...(p.branch ? {
      actions: [
        { on: 'activate', type: 'goToScene', targetSceneId: 'scene-path-a' },
        { on: 'activate', type: 'goToScene', targetSceneId: 'scene-path-b' },
      ],
    } : {}),
  });

  // Tương tác phụ: thiệp mời đếm ngược tới giờ hẹn, thiệp chúc mừng có album ảnh tùy chọn.
  const extraY = primaryY + ph + 24;
  if (p.extra === 'countdown') {
    add(discover, 'interaction', 'event-countdown', [32, Math.min(extraY, 556), 325, 186], {
      kind: 'event-countdown',
      color: p.paper,
      entries: [{ heading: common('countdownTitle'), body: common('countdownArrived') }],
      eventAt: null,
      timeZone: 'Asia/Ho_Chi_Minh',
      clockMode: 'countdown',
      optional: true,
    }, { effects: { entrance: { id: 'E02', speed: 'normal', delay: 300 } } });
  } else if (!p.branch) {
    add(discover, 'interaction', 'event-album', [26, extraY, 337, 310], {
      kind: 'swipe-album',
      color: p.bg,
      optional: true,
      autoplay: false,
      photos: Array.from({ length: 3 }, (_, i) => ({
        id: 'photo-' + (i + 1),
        assetId: null,
        alt: '',
        caption: '',
        focalPoint: { x: 0.5, y: 0.5 },
      })),
    });
  }
  if (!p.branch) go(discover, 'to-finish', common('toFinish'), 'scene-finish');

  // ---- 3b. Hai nhánh: lựa chọn của người nhận dẫn tới lời nhắn khác nhau ----
  if (p.branch) {
    for (const [suffix, letter, background] of [['a', 'A', p.bg], ['b', 'B', p.paper]]) {
      const path = scene('scene-path-' + suffix, story('choice' + letter), background, 'T02');
      motifArt(path, 'path-' + suffix + '-art', [140, 80, 110, 110]);
      text(path, 'path-' + suffix + '-kicker', [30, 206, 330, 24], common('youChose') + ' ' + story('choice' + letter), { size: 14, font: 'heading', color: p.button });
      text(path, 'path-' + suffix + '-title', [24, 236, 342, 80], story('path' + letter + 'Title'), { size: 28, font: titleFont, heading: true, step: 1 });
      text(path, 'path-' + suffix + '-body', [36, 324, 318, 180], story('path' + letter + 'Body'), { size: 19, step: 2 });
      go(path, 'path-' + suffix + '-next', common('toFinish'), 'scene-finish');
    }
  }

  // ---- 4. Hồi đáp: khép lại câu chuyện bằng một lời đáp ----
  const finish = scene('scene-finish', story('finishTitle'), p.bg, 'T01');
  finish.effects.ambience = { id: p.ambience, speed: 'normal', density: 'sparse', loop: false };
  motifArt(finish, 'finish-art', [155, 44, 80, 80]);
  text(finish, 'finish-title', [24, 136, 342, 70], story('finishTitle'), { size: 28, font: titleFont, heading: true, step: 1 });
  text(finish, 'finish-note', [36, 208, 318, 84], story('finishNote'), { size: 17, step: 2 });
  add(finish, 'reply', 'reply-card', [28, 312, 334, 330], {
    title: localize('gift.reply.send'),
    submitLabel: localize('gift.reply.send'),
  });
  add(finish, 'button', 'replay-gift', [60, 760, 270, 56], {
    label: localize('templates.preset.replay'),
    color: p.button,
  }, { actions: [{ on: 'activate', type: 'replay' }] });

  return validateDocument(doc);
}
