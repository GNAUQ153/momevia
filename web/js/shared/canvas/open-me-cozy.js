import { openMeDocument } from './open-me-document.js';

export function createCozyChristmas(localize) {
  const p = { paper: '#FFF8E9', ink: '#174C3A', accent: '#AD2429', pink: '#D6847A' };
  const { doc, c, scene, add, text, heading, binding, shape, sticker, go, envelope, invitation, reply, music } = openMeDocument('cozy-christmas-invitation', localize, p);
  const border = at => {
    shape(at, `${at}-outer-border`, [12, 14, 366, 811], p.paper, 'rectangle', { strokeColor: p.pink, strokeWidth: 3, radius: 32 });
    shape(at, `${at}-inner-border`, [20, 22, 350, 795], p.paper, 'rectangle', { strokeColor: p.ink, strokeWidth: 1, radius: 26 });
  };
  const bow = (at, prefix, y) => {
    sticker(at, `${prefix}-bow`, [147, y, 96, 70], 'ribbon-bow', p.accent);
    for (let i = 0; i < 6; i++) shape(at, `${prefix}-gingham-${i}`, [152 + i * 15, y + 11, 3, 30], p.paper, 'rectangle');
  };
  const cover = scene('scene-cover', 'scene.cover');
  border(cover);
  text(cover, 'cover-brand', c('kicker'), [30, 48, 330, 32], 13);
  bow(cover, 'cover', 97);
  heading(cover, 'cover-title', c('headline'), [32, 189, 326, 162], 42, p.accent, 'serif');
  text(cover, 'cover-note', c('coverNote'), [35, 365, 320, 55], 18);
  envelope(cover, 454, '#BD292C', '#D54843', '#FFDC9A', 'scene-invitation');
  sticker(cover, 'cover-tea', [25, 724, 40, 40], 'tea-cup', p.accent);
  sticker(cover, 'cover-tree', [316, 724, 36, 40], 'leaf', p.ink);
  text(cover, 'cover-hint', c('hint'), [45, 776, 300, 32], 13);

  const details = scene('scene-invitation', 'scene.invitation');
  bow(details, 'invitation', 25);
  heading(details, 'invitation-heading', c('invitationHeading'), [25, 118, 340, 112], 40, p.accent, 'serif');
  binding(details, 'text-recipient', 'recipientName', [25, 248, 340, 85], 24, p.ink, 'center');
  invitation(details, '2026-12-22T13:00:00.000Z', 350, 414);
  add(details, 'line', 'invitation-rule', [25, 494, 340, 2], { color: p.pink, strokeWidth: 1 });
  binding(details, 'text-message', 'message', [25, 527, 340, 150], 20);
  go(details, 'to-rsvp', 'rsvp', 'scene-reply', [25, 705, 340, 56]);
  go(details, 'to-surprise', 'surprise', 'scene-surprise', [25, 779, 340, 56], p.ink);

  const surprise = scene('scene-surprise', 'scene.surprise');
  heading(surprise, 'surprise-heading', c('surpriseTitle'), [25, 60, 340, 100], 36, p.accent, 'serif');
  text(surprise, 'surprise-note', c('surpriseNote'), [25, 179, 340, 83], 19);
  add(surprise, 'interaction', 'santa-secret', [25, 290, 340, 196], { kind: 'scratch-ticket', color: '#F5E7D0', entries: [{ heading: c('secretLabel'), body: c('secretBody') }] });
  add(surprise, 'interaction', 'christmas-wish', [25, 529, 340, 196], { kind: 'wish-pick', color: '#E5EEDC', entries: Array.from({ length: 3 }, (_, i) => ({ heading: c(`wish${i + 1}Label`), body: c(`wish${i + 1}Body`) })) });
  go(surprise, 'surprise-rsvp', 'rsvp', 'scene-reply', [25, 773, 340, 64]);
  const end = reply();
  binding(end, 'text-sender', 'senderName', [28, 276, 334, 42], 18, p.ink, 'center');
  music('christmas');
  return doc;
}
