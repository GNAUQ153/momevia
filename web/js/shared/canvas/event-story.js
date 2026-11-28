// The expanded event experience is opt-in Canvas V2. Existing snapshots keep
// their own scene graph, effects and media; no reader migration is performed.
import { defaultCelebrations, CELEBRATION_IDS } from './effects.js';
export function expandEventStory(id, doc, { add, text, action, shape }, p, localize) {
  const copy = key => localize(`templates.${id}.${key}`);
  const common = key => localize(`templates.story.${key}`);
  const wedding = id === 'hai-phong-bi', graduate = id === 'proud-of-you';
  doc.schemaVersion = doc.registryVersion = 2;
  if (!wedding) {
    doc.scenes[2].id = 'scene-reply';
    doc.scenes[2].name = common('reply');
  }
  const scene = (id, name, color = p.paper) => {
    doc.scenes.push({ id, name, background: { kind: 'solid', color }, elementIds: [] });
    return doc.scenes.length - 1;
  };
  const timer = scene('scene-time', common('time'));
  const album = scene('scene-album', common('album'));
  const reply = wedding ? scene('scene-reply', common('reply')) : 2;
  const ink = graduate ? '#172849' : p.ink;
  const heading = (at, key, value, box, size = 31) => {
    const e = text(at, key, value, box, size, ink, p.font);
    e.accessibility = { role: 'heading', level: 1 };
    return e;
  };
  const find = key => doc.elements.find(e => e.id === key);
  const redirect = (key, target, label) => {
    const e = find(key); e.actions = [{ on: 'activate', type: 'goToScene', targetSceneId: target }];
    if (label) { e.props.label = label; e.accessibility.label = label; }
  };

  // Two independently optional clocks: no invented date enters a real draft.
  heading(timer, 'time-heading', copy('timeHeadline'), [36, 55, 318, 162], 29);
  text(timer, 'time-intro', copy('timeNote'), [42, 235, 306, 66], 17, ink);
  for (const [i, mode] of ['countdown', 'elapsed'].entries()) {
    const node = add(timer, 'interaction', `event-${mode}`, [30, 326 + i * 180, 330, 153], {
      kind: 'event-countdown', color: '#FFFCF6', entries: [{ heading: copy(`${mode}Title`), body: copy(`${mode}Arrived`) }],
      eventAt: null, timeZone: 'Asia/Ho_Chi_Minh', clockMode: mode, optional: true,
    });
    node.name = common(mode);
    node.effects = { surface: { id: 'S01' }, entrance: { id: 'E02', speed: 'fast', delay: i * 150 } };
  }
  action(timer, 'button', 'time-next', wedding ? common('openAlbum') : copy('open'), [60, 721, 270, 72], wedding ? 'scene-album' : 'scene-surprise');

  heading(album, 'album-heading', copy('albumHeadline'), [35, 62, 320, 90]);
  text(album, 'album-intro', copy('albumNote'), [42, 171, 306, 74], 17, ink);
  const gallery = add(album, 'interaction', 'event-album', [26, 277, 338, 358], {
    kind: 'swipe-album', color: '#FFFCF6', optional: true, autoplay: true,
    photos: Array.from({ length: 3 }, (_, i) => ({ id: `event-photo-slot-${i + 1}`, assetId: null,
      alt: '', caption: '', focalPoint: { x: .5, y: .5 } })),
  });
  gallery.name = common('ownPhotos');
  gallery.effects = { surface: { id: 'S01' }, entrance: { id: 'E02', speed: 'fast' } };
  action(album, 'button', 'album-next', common('toReply'), [60, 746, 270, 72], 'scene-reply');

  if (wedding) {
    // Equal choices remain the principal actions. The journey is a third,
    // secondary path, and both letters retain their direct return to the cover.
    for (const [key, y] of [['event-photo-wedding-memory', 300], ['event-photo-wedding-wish', 511]]) {
      Object.assign(find(key).layout, { y, height: 130 });
    }
    Object.assign(find('cover-title').layout, { y: 116, height: 82 });
    Object.assign(find('text-recipient').layout, { y: 214, height: 78 });
    Object.assign(find('open-memory').layout, { y: 427, height: 64 });
    Object.assign(find('open-wish').layout, { y: 638, height: 64 });
    Object.assign(find('cover-note').layout, { y: 803, height: 32 });
    action(0, 'button', 'open-journey', common('openJourney'), [65, 725, 260, 64], 'scene-time');
    const card = find('reply-card');
    doc.scenes[2].elementIds = doc.scenes[2].elementIds.filter(key => key !== card.id);
    doc.scenes[reply].elementIds.push(card.id);
    card.layout = { x: 24, y: 302, width: 342, height: 310, rotation: 0 };
    heading(reply, 'reply-heading', copy('replyHeadline'), [35, 64, 320, 108]);
    text(reply, 'reply-intro', copy('replyNote'), [42, 191, 306, 75], 18, ink);
    action(reply, 'button', 'replay-gift', common('backCover'), [65, 735, 260, 72]);
    action(2, 'button', 'wish-to-time', common('openJourney'), [62, 735, 266, 64], 'scene-time');
    Object.assign(find('event-photo-wedding-keepsake').layout, { y: 529, height: 86 });
    action(1, 'button', 'memory-to-time', common('openJourney'), [62, 634, 266, 64], 'scene-time');
  } else {
    redirect('open-gift', 'scene-time');
    redirect('to-message', 'scene-album', common('openAlbum'));
  }

  // Small tactile details and standard effects give each surface its own role.
  for (const at of wedding ? [1, 2] : [1]) {
    const paper = shape(at, 'story-paper-' + at, [22, 30, 346, 757], p.paper, 'rectangle', { radius: 3, strokeColor: '#DDCEBA', strokeWidth: 1 });
    paper.effects = { surface: { id: 'S03' } };
    const ids = doc.scenes[at].elementIds; ids.unshift(ids.pop());
  }
  for (const e of doc.elements) {
    if (['name-ribbon','graduation-ribbon'].includes(e.id)) e.effects = { surface: { id: 'S03' } };
    if (e.type === 'image') e.effects = { entrance: { id: graduate ? 'E05' : wedding ? 'E06' : 'E05', speed: 'normal', delay: 0 }, emphasis: { id: !wedding && e.id === 'event-photo-' + (graduate ? 'graduation' : 'birthday') ? 'A05' : 'A02', speed: 'slow' } };
    if (e.type === 'text' && e.accessibility.role === 'heading') e.effects = { entrance: { id: 'E02', speed: 'fast' } };
    if (e.id === 'text-message' || e.id === 'envelope-memory') e.effects = { entrance: { id: 'E03', speed: 'slow' } };
    if (e.actions) e.effects = { reaction: { id: 'R03', speed: 'fast' } };
  }
  for (const s of doc.scenes) s.effects = { transition: { id: s.id === 'scene-album' ? 'T06' : s.id === 'scene-surprise' || s.id === 'scene-message' ? 'T03' : s.id === 'scene-reply' ? 'T05' : 'T01', speed: s.id === 'scene-album' ? 'slow' : 'normal' } };
  doc.scenes[0].effects.ambience = { id: wedding ? 'B06' : 'B07', speed: 'normal', density: 'sparse' };
  doc.scenes[timer].effects.ambience = { id: 'B05', speed: 'normal', density: 'sparse' };
  doc.scenes[album].effects.ambience = { id: 'B08', speed: 'normal', density: 'sparse' };
  doc.scenes[1].effects.ambience = { id: wedding ? 'B08' : 'B06', speed: 'normal', density: 'sparse' };
  doc.scenes[reply].effects.ambience = { id: 'B07', speed: 'normal', density: 'sparse' };
  for (const s of doc.scenes) {
    const settings = s.effects.celebrations = defaultCelebrations();
    const previous = s.effects.ambience;
    if (previous && CELEBRATION_IDS.includes(previous.id)) {
      settings[previous.id] = { enabled: true, speed: previous.speed || 'normal', density: previous.density || 'sparse', loop: true };
      delete s.effects.ambience;
    }
  }
  if (!wedding) doc.scenes = [doc.scenes[0], doc.scenes[timer], doc.scenes[1], doc.scenes[album], doc.scenes[reply]];
  // Reading order stays top-to-bottom; scene.elementIds separately keeps z-order.
  const order = new Map(doc.scenes.flatMap((s, i) => s.elementIds.map(key => [key, i])));
  doc.elements.sort((a, b) => order.get(a.id) - order.get(b.id) || a.layout.y - b.layout.y);
}
