import { openMeDocument } from './open-me-document.js';

export function createClub22(localize) {
  const p = { paper: '#FFDC54', ink: '#193FBE', accent: '#193FBE', pink: '#F4A9CC', cream: '#FFFBEF' };
  const { doc, c, scene, add, text, heading, binding, shape, sticker, go, envelope, invitation, reply } = openMeDocument('club-22-invitation', localize, p);
  const cover = scene('scene-cover', 'scene.cover');
  text(cover, 'cover-brand', 'MOMEVIA', [34, 35, 322, 30], 15);
  text(cover, 'cover-kicker', c('kicker'), [45, 117, 300, 35], 13);
  heading(cover, 'cover-title', c('headline'), [35, 175, 320, 126], 48);
  text(cover, 'cover-note', c('coverNote'), [32, 317, 326, 52], 17);
  sticker(cover, 'cover-star', [20, 81, 65, 65], 'sparkles', p.cream);
  sticker(cover, 'cover-flower', [301, 686, 64, 64], 'flower', '#A93E6C');
  envelope(cover, 414, '#5470F1', '#9DAEFF', p.paper, 'scene-invitation');
  text(cover, 'cover-hint', c('hint'), [34, 767, 322, 48], 15);

  const details = scene('scene-invitation', 'scene.invitation', p.ink);
  text(details, 'invitation-kicker', c('kicker'), [28, 25, 334, 30], 13, p.cream);
  heading(details, 'invitation-heading', c('invitationHeading'), [28, 75, 334, 60], 36, p.cream);
  binding(details, 'text-recipient', 'recipientName', [28, 145, 334, 80], 27, p.paper, 'center');
  heading(details, 'birthday-age', '22', [65, 240, 260, 120], 100, p.paper);
  shape(details, 'ticket-ribbon', [30, 385, 330, 118], p.cream, 'rectangle', { radius: 5 });
  invitation(details, '2026-12-12T12:00:00.000Z', 392, 447);
  binding(details, 'text-message', 'message', [28, 535, 334, 150], 20, p.cream);
  go(details, 'to-rsvp', 'rsvp', 'scene-reply', [28, 705, 334, 56], '#1736A0');
  go(details, 'to-surprise', 'surprise', 'scene-surprise', [28, 779, 334, 56], '#1736A0');

  const surprise = scene('scene-surprise', 'scene.surprise');
  heading(surprise, 'surprise-heading', c('surpriseTitle'), [28, 55, 334, 100], 34);
  add(surprise, 'interaction', 'birthday-candle', [35, 198, 320, 220], { kind: 'light-a-candle', color: p.cream,
    entries: [{ heading: c('candleLabel'), body: c('candleWish') }] });
  add(surprise, 'interaction', 'birthday-secret', [28, 465, 334, 202], { kind: 'scratch-ticket', color: p.cream,
    entries: [{ heading: c('secretLabel'), body: c('secretBody') }] });
  go(surprise, 'surprise-rsvp', 'rsvp', 'scene-reply', [28, 741, 334, 64]);
  const end = reply({ background: '#F8D4E5' });
  binding(end, 'text-sender', 'senderName', [28, 276, 334, 42], 18, p.ink, 'center');
  return doc;
}
