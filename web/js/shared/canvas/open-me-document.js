import { createElement } from './registry.js';
import { invitationDateText, INVITATION_ZONE } from './invitation.js';
import { SOUNDTRACKS } from './soundtracks.js';

// Every visible piece is an ordinary editable canvas layer. No demo HTML is embedded.
export function openMeDocument(id, localize, palette) {
  const c = key => localize(`templates.${id}.${key}`);
  const doc = {
    schemaVersion: 2, registryVersion: 2,
    artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 24, bottom: 24, left: 24 } },
    entrySceneId: 'scene-cover',
    bindings: Object.fromEntries(['recipientName', 'senderName', 'message'].map(key => [key, { type: 'text', value: '' }])),
    assets: [], elements: [], scenes: [],
    responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 600, align: 'center' } },
  };
  const scene = (key, name, color = palette.paper) => {
    doc.scenes.push({ id: key, name: c(name), background: { kind: 'solid', color }, elementIds: [], effects: { transition: { id: 'T01', speed: 'fast' } } });
    return key;
  };
  const add = (at, type, key, box, props, extra = {}) => {
    const [x, y, width, height, rotation = 0] = box;
    const node = createElement(type, { id: key, name: c(`layer.${key}`).slice(0, 100), layout: { x, y, width, height, rotation }, props, ...extra }, localize);
    doc.elements.push(node); doc.scenes.find(row => row.id === at).elementIds.push(key); return node;
  };
  const text = (at, key, value, box, size = 20, color = palette.ink, font = 'body', align = 'center', extra = {}) => add(at, 'text', key, box,
    { text: value, color, fontToken: font, fontSize: size, align, lineHeight: 1.35 }, extra);
  const heading = (at, key, value, box, size = 36, color = palette.ink, font = 'heading') => text(at, key, value, box, size, color, font, 'center', { accessibility: { role: 'heading', level: 1 } });
  const binding = (at, key, name, box, size = 21, color = palette.ink, align = 'left') => add(at, 'text', key, box,
    { textBinding: name, color, fontToken: 'body', fontSize: size, align, lineHeight: 1.55 });
  const shape = (at, key, box, color, kind = 'rectangle', extra = {}) => add(at, 'shape', key, box, { color, kind, radius: 0, ...extra });
  const vector = (at, key, box, color, paths) => add(at, 'shape', key, box, { kind: 'rectangle', color, radius: 0 }, { artwork: { paths } });
  const sticker = (at, key, box, stickerId, color) => add(at, 'sticker', key, box, { stickerId, color });
  const go = (at, key, label, target, box, color = palette.accent) => add(at, 'button', key, box, { label: c(label), color }, { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: target }] });
  const replay = (at, box, color = palette.accent, key = 'replay-gift') => add(at, 'button', key, box, { label: c('replay'), color }, { actions: [{ on: 'activate', type: 'replay' }] });
  const envelope = (at, y, color, flap, seal, target, label = 'open') => {
    shape(at, 'envelope-paper', [38, y, 314, 194], color, 'rectangle', { radius: 10 });
    vector(at, 'envelope-flap', [38, y, 314, 194], flap, [{ d: 'M0 0H100L50 55Z', fill: 'color' }]);
    vector(at, 'envelope-fold', [38, y, 314, 194], flap, [{ d: 'M0 100 50 51 100 100Z', fill: 'color' }]);
    shape(at, 'envelope-seal', [170, y + 83, 50, 50], seal, 'ellipse');
    sticker(at, 'seal-mark', [181, y + 94, 28, 28], 'heart', palette.ink);
    add(at, 'envelope', 'open-gift', [38, y, 314, 270], { preset: 'photo-caption-v3', label: c(label), color: palette.accent },
      { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: target }] });
  };
  const invitation = (at, eventAt, y, venueY, color = palette.ink) => {
    doc.invitation = { dateElementId: 'event-date', venueElementId: 'event-location', eventAt, timeZone: INVITATION_ZONE };
    text(at, 'event-date', invitationDateText(eventAt, INVITATION_ZONE), [28, y, 334, 55], 15, color);
    text(at, 'event-location', c('venue'), [28, venueY, 334, 64], 19, color);
  };
  const reply = ({ background = palette.paper, color = palette.ink } = {}) => {
    const at = scene('scene-reply', 'scene.reply', background);
    heading(at, 'reply-heading', c('replyTitle'), [28, 62, 334, 115], 35, color, 'serif');
    text(at, 'reply-note', c('replyNote'), [28, 190, 334, 100], 19, color);
    add(at, 'reply', 'reply-card', [20, 318, 350, 330], { title: c('replyTitle'), submitLabel: c('sendReply'), color:palette.accent });
    replay(at, [66, 747, 258, 64]);
    return at;
  };
  const music = occasion => {
    const track = SOUNDTRACKS.find(row => row.occasion === occasion && row.instrumental) || SOUNDTRACKS.find(row => row.occasion === occasion);
    if (track) doc.soundtrack = { id: track.id, volume: 0.3 };
  };
  return { doc, c, scene, add, text, heading, binding, shape, vector, sticker, go, replay, envelope, invitation, reply, music };
}
