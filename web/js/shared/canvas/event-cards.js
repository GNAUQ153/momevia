import { upgradeEventCard } from './event-upgrade.js';
import { eventMediaId, EVENT_ARTWORK_LABEL } from './event-media.js';
import { expandEventStory } from './event-story.js';
// Photographs, wording and controls stay separate editable layers.
export const EVENT_CARD_IDS = ['birthday-radiance', 'hai-phong-bi', 'proud-of-you'];

export function paintEventCard(id, doc, { shape, line, text, binding, action, add }, p, localize) {
  if (!EVENT_CARD_IDS.includes(id)) return false;
  const copy = field => localize(`templates.${id}.${field}`);
  const rect = (scene, name, box, color, radius = 8) => shape(scene, name, box, color, 'rectangle', { radius });
  const heading = (scene, name, value, box, size, color = p.ink, font = p.font) => {
    const node = text(scene, name, value, box, size, color, font);
    node.accessibility = { role: 'heading', level: 1 }; return node;
  };
  const confetti = (scene, prefix, startY, colors) => {
    for (let i = 0; i < 12; i++) rect(scene, `${prefix}-${i}`, [i % 2 ? 351 : 22, startY + Math.floor(i / 2) * 53, 7, 17, i * 31 % 120 - 60], colors[i % colors.length], 2);
  };
  const signature = (scene, y, ink) => {
    text(scene, 'message-from-label', copy('signOff'), [42, y, 306, 30], 16, ink, 'body', 'right');
    binding(scene, 'text-sender', 'senderName', [42, y + 38, 306, 65], 21, ink, 'right');
  };
  const photo = (scene, name, key, box) => {
    const assetId = eventMediaId(key);
    if (!doc.assets.some(a => a.assetId === assetId)) doc.assets.push({ assetId, kind: 'image' });
    const node = add(scene, 'image', `event-photo-${name}`, box, { assetId, fit: 'contain', radius: 0 }, { accessibility: { decorative: true, label: EVENT_ARTWORK_LABEL } });
    node.name = { birthday: 'Ảnh bánh kem và nến', 'birthday-reply': 'Bánh nhỏ cuối buổi tiệc', 'wedding-memory': 'Ảnh phong bì kỷ niệm', 'wedding-wish': 'Ảnh phong bì lời chúc', 'wedding-keepsake': 'Lá thư giữ kỷ niệm', graduation: 'Ảnh mũ và bằng tốt nghiệp', 'graduation-letter': 'Dấu mốc trên lá thư' }[name];
  };
  const reply = () => {
    heading(2, 'reply-heading', copy('replyHeadline'), [34, 80, 322, 104], 32);
    text(2, 'reply-intro', copy('replyNote'), [42, 207, 306, 75], 18);
    add(2, 'reply', 'reply-card', [24, 320, 342, 300], { title: copy('replyTitle'), submitLabel: localize('templates.copy.sendReply'), color:p.button });
    action(2, 'button', 'replay-gift', copy('replay'), [65, 714, 260, 72]);
  };

  if (id === 'birthday-radiance') {
    text(0, 'cover-kicker', copy('kicker'), [40, 40, 310, 30], 14, p.ink);
    heading(0, 'cover-title', p.headline, [39, 93, 312, 116], 43);
    line(0, 'birthday-rule', [171, 214, 48, 2], p.accent, 3);
    photo(0, 'birthday', 'birthday', [18, 225, 354, 300]);
    rect(0, 'name-ribbon', [28, 544, 334, 94], '#FFD056', 5);
    binding(0, 'text-recipient', 'recipientName', [43, 551, 304, 82], 23);
    text(0, 'cover-note', p.note, [46, 661, 298, 48], 17);
    action(0, 'button', 'open-gift', copy('open'), [60, 737, 270, 72], 'scene-surprise');
    doc.scenes[1].background.color = p.paper;
    rect(1, 'message-ribbon', [27, 46, 336, 13], p.detail, 3);
    heading(1, 'message-heading', copy('wishHeadline'), [42, 88, 306, 83], 30);
    binding(1, 'message-to', 'recipientName', [42, 192, 306, 70], 22);
    binding(1, 'text-message', 'message', [42, 290, 306, 252], 21, p.ink, 'left');
    signature(1, 572, p.ink);
    action(1, 'button', 'to-message', copy('toReply'), [60, 737, 270, 72], 'scene-message');
    photo(2, 'birthday-reply', 'birthday', [286, 19, 76, 51, -8]);
    reply();
  } else if (id === 'hai-phong-bi') {
    doc.scenes[1].name = localize('templates.scene.memory');
    doc.scenes[2].name = copy('wishLabel');
    // Two interlocking rings remain separate editable layers, outside the name region.
    shape(0, 'ring-one', [153, 46, 51, 51], p.bg, 'ellipse', { strokeColor: p.detail, strokeWidth: 4 });
    shape(0, 'ring-two', [187, 46, 51, 51], p.bg, 'ellipse', { strokeColor: p.button, strokeWidth: 4 });
    heading(0, 'cover-title', p.headline, [35, 127, 320, 91], 32);
    binding(0, 'text-recipient', 'recipientName', [40, 229, 310, 96], 24);
    doc.elements.at(-1).props.fontToken = 'serif';
    photo(0, 'wedding-memory', 'wedding', [36, 325, 318, 154, -2]);
    action(0, 'button', 'open-memory', copy('memoryLabel'), [65, 469, 260, 72], 'scene-surprise');
    photo(0, 'wedding-wish', 'wedding', [36, 559, 318, 154, 2]);
    action(0, 'button', 'open-wish', copy('wishLabel'), [65, 703, 260, 72], 'scene-message');
    text(0, 'cover-note', copy('note'), [47, 793, 296, 40], 15);
    // Marginal sprigs do not cross either choice or the names.
    doc.scenes[1].background.color = p.paper;
    rect(1, 'memory-margin', [26, 180, 2, 575], '#F4C9C4', 0);
    heading(1, 'memory-heading', copy('memoryLabel'), [43, 75, 304, 80], 34);
    // Empty on a real draft; only preview supplies an illustrative memory.
    text(1, 'envelope-memory', '', [48, 199, 294, 320], 22, p.ink, 'body', 'left');
    doc.elements.at(-1).name = localize('templates.hai-phong-bi.memoryField');
    photo(1, 'wedding-keepsake', 'wedding', [116, 550, 158, 94, -5]);
    action(1, 'button', 'memory-back', localize('templates.copy.backToEnvelopes'), [62, 711, 266, 72], 'scene-cover');
    doc.scenes[2].background.color = p.paper;
    heading(2, 'message-heading', copy('wishLabel'), [42, 55, 306, 75], 34);
    binding(2, 'text-message', 'message', [42, 162, 306, 320], 19, p.ink, 'left');
    signature(2, 506, p.ink);
    action(2, 'button', 'wish-back', localize('templates.copy.backToEnvelopes'), [62, 644, 266, 64], 'scene-cover');
    add(2, 'reply', 'reply-card', [24, 602, 342, 208], { title: copy('replyTitle'), submitLabel: localize('templates.copy.sendReply'), color:p.button });
  } else {
    text(0, 'cover-kicker', copy('kicker'), [40, 38, 310, 30], 14, p.ink);
    heading(0, 'cover-title', p.headline, [32, 95, 326, 118], 36);
    photo(0, 'graduation', 'graduation', [18, 224, 354, 308]);
    confetti(0, 'graduation-paper', 228, [p.accent, p.detail, '#F78A79']);
    binding(0, 'text-recipient', 'recipientName', [39, 550, 312, 82], 24);
    rect(0, 'graduation-ribbon', [32, 660, 326, 49], p.accent, 4);
    text(0, 'cover-note', p.note, [41, 668, 308, 38], 18, '#172849');
    action(0, 'button', 'open-gift', copy('open'), [60, 752, 270, 72], 'scene-surprise');
    doc.scenes[1].background.color = p.paper;
    photo(1, 'graduation-letter', 'graduation', [143, 21, 104, 70, -7]);
    heading(1, 'message-heading', copy('wishHeadline'), [42, 118, 306, 91], 29, '#172849', 'heading');
    binding(1, 'message-to', 'recipientName', [42, 239, 306, 70], 22, '#172849');
    binding(1, 'text-message', 'message', [42, 338, 306, 215], 21, '#172849', 'left');
    signature(1, 582, '#172849');
    action(1, 'button', 'to-message', copy('toReply'), [60, 746, 270, 72], 'scene-message');
    reply();
  }
  expandEventStory(id, doc, { add, text, binding, action, shape }, p, localize);
  upgradeEventCard(id, doc, localize);
  const names = {
    'cake-bottom': 'Thân bánh', 'cake-top': 'Tầng bánh', 'cake-plate': 'Đĩa bánh', 'cake-icing': 'Lớp kem',
    'name-ribbon': 'Dải giấy tên', 'ring-one': 'Nhẫn xanh', 'ring-two': 'Nhẫn mâm xôi',
    'cap-crown': 'Thân mũ tốt nghiệp', 'cap-board': 'Mặt mũ tốt nghiệp', 'cap-cord': 'Dây tua mũ',
    'cap-cord-drop': 'Dây tua buông', 'cap-tassel': 'Tua mũ vàng', 'graduation-sky': 'Vòm trời',
    'graduation-ribbon': 'Dải băng tốt nghiệp', 'diploma-paper': 'Tấm bằng', 'diploma-ribbon': 'Ruy băng bằng',
    'open-memory': 'Mở kỷ niệm', 'open-wish': 'Mở lời mừng cưới',
  };
  for (const node of doc.elements) if (names[node.id]) node.name = names[node.id];
  return true;
}
