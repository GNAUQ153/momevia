import { openMeDocument } from './open-me-document.js';

export function createTetLetter(localize) {
  const p = { paper: '#FAF0E2', ink: '#8E1931', accent: '#A51935', pink: '#D76D82', gold: '#F4D192', green: '#147568' };
  const { doc, c, scene, add, text, heading, binding, shape, sticker, go, replay, envelope, reply, music } = openMeDocument('tet-phong-thu', localize, p);
  const flowers = (at, prefix, bottom = true) => {
    add(at, 'line', `${prefix}-branch-left`, [0, 58, 117, 2, 37], { color: '#96604B', strokeWidth: 3 });
    if (bottom) add(at, 'line', `${prefix}-branch-right`, [273, 806, 117, 2, 37], { color: '#96604B', strokeWidth: 3 });
    const points = [[2, 25, 38], [42, 45, 45], [83, 73, 28], ...(bottom ? [[271, 784, 28], [305, 800, 38], [350, 821, 28]] : [])];
    for (const [i, [x, y, size]] of points.entries()) {
      sticker(at, `${prefix}-flower-${i}`, [x, y, size, size], 'flower', p.pink);
      shape(at, `${prefix}-flower-heart-${i}`, [x + size * .4, y + size * .4, size * .2, size * .2], p.gold, 'ellipse');
    }
  };
  const cover = scene('scene-cover', 'scene.cover');
  flowers(cover, 'cover');
  text(cover, 'cover-brand', c('kicker'), [32, 166, 326, 34], 14);
  heading(cover, 'cover-title', c('headline'), [28, 223, 334, 100], 33, p.ink, 'heading');
  envelope(cover, 383, '#B71430', '#CF2B45', p.gold, 'scene-letter');
  text(cover, 'cover-hint', c('hint'), [32, 682, 326, 58], 18);

  const letter = scene('scene-letter', 'scene.letter');
  doc.scenes.find(row => row.id === letter).effects.ambience = { id: 'B02', speed: 'normal', density: 'sparse', loop: false };
  flowers(letter, 'letter', false);
  // The paper continues below reflowing text; a finite bottom frame would cross long messages.
  shape(letter, 'letter-paper', [20, 120, 350, 2400], '#FFFAEF', 'rectangle', { strokeColor: '#C99550', strokeWidth: 1, radius: 3 });
  heading(letter, 'letter-heading', c('letterTitle'), [30, 145, 330, 95], 33, p.ink, 'serif');
  text(letter, 'letter-year', c('year'), [33, 255, 324, 30], 15, p.green);
  binding(letter, 'text-recipient', 'recipientName', [33, 306, 324, 68], 23, p.ink, 'center');
  add(letter, 'line', 'letter-rule', [51, 399, 288, 2], { color: '#C99550', strokeWidth: 1 });
  binding(letter, 'text-message', 'message', [33, 425, 324, 242], 19, '#643F34');
  text(letter, 'letter-signoff', c('signOff'), [33, 683, 324, 28], 16, '#643F34', 'serif', 'right');
  binding(letter, 'text-sender', 'senderName', [33, 724, 324, 46], 20, p.ink, 'right');
  go(letter, 'to-reply', 'reply', 'scene-reply', [28, 784, 164, 58]);
  replay(letter, [202, 784, 160, 58], p.accent, 'letter-replay');
  reply();
  music('tet');
  return doc;
}
