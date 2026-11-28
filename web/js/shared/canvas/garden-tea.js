import { enrichGardenScenes } from './garden-scenes.js';
import { gardenSprigPaths, gardenFlowerPaths } from './garden-botanical.js';
import { openMeDocument } from './open-me-document.js';

export const GARDEN_TEA_ID = 'garden-tea';
export const GARDEN_GATE_PRESET = 'garden-gate-v1';
export const gardenDoorSide = model => model?.type === 'shape'
  ? ({ 'garden-door-left-v1': 'left', 'garden-door-right-v1': 'right' }[model.props.kind] || null) : null;
export const isGardenDocument = doc => doc.elements.some(e => e.type === 'envelope' && e.props.preset === GARDEN_GATE_PRESET);

// Ordinary editable layers, including the two door groups and their foliage.
export function createGardenTea(localize) {
  const p = { paper: '#F8EBE6', ink: '#34452F', accent: '#934850', sage: '#5E7156', cream: '#FFF8EE' };
  const { doc, c, scene, add, text, heading, binding, shape, vector, go, replay } = openMeDocument(GARDEN_TEA_ID, localize, p);
  const copy = (at, id, value, box, size = 19, color = p.ink, serif = false) => {
    const e = text(at, id, value, box, size, color, serif ? 'serif' : 'body');
    if (serif) { e.props.fontStyle = 'italic'; e.props.fontWeight = 500; }
    e.name = value.slice(0, 100); return e;
  };
  const title = (at, id, value, y = 95, size = 35) => {
    const e = heading(at, id, value, [28, y, 334, 110], size, p.ink, 'serif');
    e.props.fontStyle = 'italic'; e.props.fontWeight = 500; e.name = value.slice(0, 100); return e;
  };
  const ornament = (at, y) => {
    add(at, 'line', `${at}-rule-left`, [85, y + 13, 85, 1], { color: p.accent, strokeWidth: 1 });
    copy(at, `${at}-flower`, '✿', [177, y, 36, 30], 18, p.accent);
    add(at, 'line', `${at}-rule-right`, [220, y + 13, 85, 1], { color: p.accent, strokeWidth: 1 });
  };
  const hero = (at, prefix) => {
    binding(at, `${prefix}-sender`, 'senderName', [35, 76, 320, 45], 20, p.accent, 'center');
    title(at, `${prefix}-title`, c('headline'), 140, 48);
    ornament(at, 278);
    shape(at, `${prefix}-photo-frame`, [104, 328, 182, 228], '#F3DCD9', 'ellipse', { strokeColor: p.accent, strokeWidth: 1 });
    add(at, 'image', `${prefix}-photo`, [109, 333, 172, 218], { assetId: null, fit: 'cover', radius: 120, optional: true, placeholder: 'portrait' }, { accessibility: { decorative: true } });
    copy(at, `${prefix}-photo-caption`, c('photoCaption'), [45, 577, 300, 44], 15, p.accent, true);
    copy(at, `${prefix}-welcome`, c('welcome'), [30, 645, 330, 58], 18);
  };
  doc.personalization = { version: 1, mode: 'self' };
  const cover = scene('scene-cover', 'scene.cover');
  title(cover, 'cover-underlay-title', c('headline'), 140, 48);
  ornament(cover, 278);
  for (const [side, x] of [['left', 0], ['right', 195]]) {
    const group = `garden-${side}-door`;
    const panel = shape(cover, group, [x, 0, 195, 844], p.sage, `garden-door-${side}-v1`);
    panel.groupId = panel.id;
    const decorate = e => { e.groupId = group; return e; };
    const frame = decorate(vector(cover, `${group}-frame`, [x + 13, 16, 169, 812], p.cream,
      [{ d: 'M1 0H99V100H1Z', fill: 'none', stroke: 'color', strokeWidth: .7 }]));
    frame.opacity = .42;
    for (const [corner, top, rotation] of [['top', 2, side === 'left' ? -12 : 14], ['bottom', 615, side === 'left' ? 168 : 194]]) {
      const dx = x + (side === 'left' ? -9 : 100);
      decorate(vector(cover, `${group}-${corner}-sprig`, [dx, top, 100, 228, rotation], p.cream, gardenSprigPaths()));
      const bloom = decorate(vector(cover, `${group}-${corner}-flower`, [x + (side === 'left' ? 34 : 113), top + (corner === 'top' ? 109 : 70), 46, 46, corner === 'top' ? -17 : 23], '#F3D4CF', gardenFlowerPaths()));
      bloom.opacity = .96;
    }
    decorate(copy(cover, `${group}-title`, c(side === 'left' ? 'titleLeft' : 'titleRight'), [x + 8, 390, 179, 72], 29, p.cream, true));
  }
  binding(cover, 'cover-sender', 'senderName', [70, 65, 250, 50], 20, p.cream, 'center');
  binding(cover, 'cover-recipient', 'recipientName', [35, 130, 320, 50], 19, p.cream, 'center');
  copy(cover, 'cover-hint', c('hint'), [70, 746, 250, 68], 15, p.cream, true);
  add(cover, 'envelope', 'open-gift', [150, 475, 90, 90], { label: c('open'), preset: GARDEN_GATE_PRESET, color: p.accent },
    { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-invitation' }] });

  const invitation = scene('scene-invitation', 'scene.invitation');
  hero(invitation, 'hero');
  go(invitation, 'hero-next', 'continue', 'scene-message', [80, 744, 230, 58]);
  const message = scene('scene-message', 'scene.message');
  copy(message, 'message-to', c('dear'), [35, 165, 320, 36], 19, p.accent, true);
  binding(message, 'text-recipient', 'recipientName', [35, 211, 320, 85], 25, p.ink, 'center');
  ornament(message, 318);
  binding(message, 'text-message', 'message', [32, 380, 326, 225], 21, p.ink, 'center');
  go(message, 'message-next', 'details', 'scene-details', [70, 744, 250, 58]);

  const details = scene('scene-details', 'scene.details');
  title(details, 'details-heading', c('details'), 66, 31);
  doc.invitation = { dateElementId: 'event-date', venueElementId: 'event-location', eventAt: null, timeZone: 'Asia/Ho_Chi_Minh' };
  copy(details, 'event-date', '', [32, 211, 326, 78], 20, p.ink, true);
  copy(details, 'event-location', '', [32, 310, 326, 125], 22);
  for (const [id, label, type, x] of [['event-map', 'map', 'openEventMap', 32], ['event-calendar', 'calendar', 'saveEventCalendar', 200]]) {
    add(details, 'button', id, [x, 442, 158, 56], { label: c(label), color: p.accent }, { actions: [{ on: 'activate', type }] });
  }
  add(details, 'interaction', 'event-clock', [32, 510, 326, 150], { kind: 'event-countdown', color: p.paper, clockSource: 'invitation', eventAt: null, timeZone: 'Asia/Ho_Chi_Minh', optional: true,
    entries: [{ heading: c('countdown'), body: c('arrived') }] });
  go(details, 'to-rsvp', 'rsvp', 'scene-reply', [32, 684, 326, 58]);
  go(details, 'details-next', 'programme', 'scene-programme', [70, 768, 250, 58]);

  const programme = scene('scene-programme', 'scene.programme');
  title(programme, 'programme-heading', c('programme'), 72, 35);
  add(programme, 'line', 'programme-stem', [53, 240, 1, 395], { color: p.accent, strokeWidth: 1 });
  for (let i = 0; i < 4; i++) {
    const y = 227 + i * 106;
    shape(programme, `programme-dot-${i}`, [47, y + 14, 13, 13], p.accent, 'ellipse');
    copy(programme, `programme-time-${i}`, c(`time${i + 1}`), [80, y, 270, 30], 22, p.accent, true).props.align = 'left';
    copy(programme, `programme-item-${i}`, c(`programme${i + 1}`), [80, y + 38, 270, 57], 18).props.align = 'left';
  }
  go(programme, 'programme-next', 'dress', 'scene-dress', [70, 744, 250, 58]);
  const dress = scene('scene-dress', 'scene.dress');
  title(dress, 'dress-heading', c('dress'), 207, 32);
  copy(dress, 'dress-note', c('dressNote'), [32, 355, 326, 145], 20);
  [p.paper, p.accent, p.sage, '#E8D4A8'].forEach((color, i) => shape(dress, `dress-swatch-${i}`, [84 + i * 58, 543, 39, 39], color, 'ellipse', { strokeColor: p.accent, strokeWidth: 1 }));
  go(dress, 'dress-next', 'secret', 'scene-secret', [70, 744, 250, 58]);
  const secret = scene('scene-secret', 'scene.secret');
  title(secret, 'secret-heading', c('secret'), 160, 30);
  add(secret, 'interaction', 'garden-secret', [32, 342, 326, 225], { kind: 'scratch-ticket', appearance: 'scratch-progress-v1', color: '#E8D4A8', entries: [{ heading: c('scratch'), body: c('secretBody') }] });
  go(secret, 'secret-rsvp', 'rsvp', 'scene-reply', [70, 744, 250, 58]);
  const reply = scene('scene-reply', 'scene.reply');
  add(reply, 'reply', 'garden-rsvp', [24, 64, 342, 650], { title: localize('rsvp.title'), submitLabel: c('rsvp'), color: '#3D6045', replyMode: 'attendance' });
  go(reply, 'reply-next', 'continue', 'scene-outro', [80, 744, 230, 58]);
  const outro = scene('scene-outro', 'scene.outro');
  ornament(outro, 240);
  copy(outro, 'outro-note', c('outro'), [32, 325, 326, 135], 27, p.ink, true);
  binding(outro, 'text-sender', 'senderName', [32, 520, 326, 65], 21, p.accent, 'center');
  replay(outro, [80, 744, 230, 58]);
  for (let i = 1; i < doc.scenes.length; i++) {
    const at = doc.scenes[i].id;
    const back = go(at, `${at}-previous`, 'previous', doc.scenes[i - 1].id, [8, at === 'scene-details' ? 768 : 744, 54, 58]);
    back.accessibility.label = localize('catalog.pagination.prev');
  }
  // Human-readable names are copy, never executable markup or identity references.
  for (const e of doc.elements) if (e.name.startsWith('templates.garden-tea.layer.')) e.name = localize(`editor.element.${e.type}`);
  return enrichGardenScenes(doc, localize);
}
