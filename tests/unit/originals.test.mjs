import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINALS, ORIGINAL_IDS } from '../../web/js/shared/canvas/originals-data.js';
import { templatePreviewDocument, createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, duplicateDocument } from '../../web/js/shared/canvas/schema.js';
import { systemCardType } from '../../web/js/shared/card-type.js';
import { editInvitation, publicInvitation } from '../../web/js/shared/canvas/invitation.js';
import { eventCalendar, eventMapUrl, eventRemaining } from '../../web/js/features/gifts/invitation-tools.js';
import { publicTemplate } from '../../src/modules/catalog/catalog.service.mjs';
import { templates, addedSystemTemplates } from '../../src/modules/catalog/seed.mjs';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { serverText } from '../../src/shared/locale.mjs';

// Vai trò lớp mà signature-opening.js cần để chạy hoạt ảnh mở bìa 3D.
const RIG_ROLES = {
  gift: ['bow', 'lid', 'lid-ribbon', 'body-ribbon', 'letter'],
  envelope: ['flap', 'seal', 'letter'],
  gatefold: ['door-left', 'door-right', 'seal'],
  polaroid: ['shutter', 'screen', 'print'],
  calendar: ['peel', 'calendar-paper', 'disco'],
  lens: ['dial-knob', 'lens', 'crosshair'],
};

// Đi theo mọi nút goToScene từ bìa: mọi cảnh đều tới được và đều dẫn tới phần hồi đáp.
function reachable(doc) {
  const seen = new Set([doc.entrySceneId]);
  const queue = [doc.entrySceneId];
  while (queue.length) {
    const current = queue.shift();
    const scene = doc.scenes.find(s => s.id === current);
    for (const element of doc.elements.filter(e => scene.elementIds.includes(e.id))) {
      for (const action of element.actions || []) {
        if (action.type === 'goToScene' && !seen.has(action.targetSceneId)) {
          seen.add(action.targetSceneId);
          queue.push(action.targetSceneId);
        }
      }
    }
  }
  return seen;
}

test('16 mẫu Originals có câu chuyện riêng, bìa 3D và luồng hợp lệ trong VI/EN', () => {
  assert.equal(new Set(ORIGINAL_IDS).size, 16);
  assert.equal(ORIGINALS.filter(p => p.cardType === 'invitation').length, 10);
  assert.deepEqual([...new Set(ORIGINALS.map(p => p.category))].sort(), ['birthday', 'christmas', 'graduation', 'meetup', 'wedding']);
  const art = new Set();
  const stories = new Set();
  for (const item of ORIGINALS) {
    assert.equal(systemCardType(item.id), item.cardType);
    for (const locale of ['vi', 'en']) {
      const doc = templatePreviewDocument(item, (key, params) => serverText(locale, key, params));
      assert.equal(doc.scenes.length, item.branch ? 6 : 4);
      assert.doesNotThrow(() => validateDocument(doc, { mode: 'publish' }));
      assert.doesNotThrow(() => validateDocument(duplicateDocument(doc)));
      // Bìa: một nút mở + một đường bỏ qua hiệu ứng, cả hai tới lời mời/lời chúc.
      assert.equal(doc.elements.find(e => e.id === 'open-gift').actions[0].targetSceneId, 'scene-main');
      assert.equal(doc.elements.find(e => e.id === 'skip-surprise').actions[0].targetSceneId, 'scene-main');
      assert.equal(doc.elements.find(e => e.id === 'open-gift').effects, undefined);
      const kinds = new Set(doc.elements.map(e => e.props.kind));
      for (const role of ['cover-decoration', ...RIG_ROLES[item.rig]]) assert(kinds.has('signature-' + role), `${item.id} thiếu ${role}`);
      assert.equal(doc.elements.find(e => e.id === 'surprise').props.kind, item.discover);
      if (item.branch) {
        const targets = doc.elements.find(e => e.id === 'surprise').actions.map(a => a.targetSceneId);
        assert.deepEqual(targets, ['scene-path-a', 'scene-path-b']);
      }
      assert.equal(doc.elements.some(e => e.id === 'event-countdown'), item.extra === 'countdown');
      assert.deepEqual([...reachable(doc)].sort(), doc.scenes.map(s => s.id).sort());
      assert.equal(doc.elements.find(e => e.id === 'replay-gift').actions[0].type, 'replay');
      assert(doc.elements.some(e => e.type === 'reply'));
      // Không còn chữ minh họa kiểu "(minh họa)" hay khóa chưa dịch trên thiệp.
      for (const e of doc.elements.filter(e => e.type === 'text' && typeof e.props.text === 'string')) {
        assert(!/^(stories|templates|originals)\./.test(e.props.text), `${item.id} ${locale} thiếu bản dịch ${e.props.text}`);
        assert(!/minh họa|\(sample\)/i.test(e.props.text), `${item.id} ${locale} còn chữ minh họa`);
      }
      if (locale === 'vi') {
        art.add(JSON.stringify(doc.elements.find(e => e.id === 'cover-art').artwork));
        stories.add(doc.elements.find(e => e.id === 'open-gift').props.label + item.rig + item.discover);
      }
    }
  }
  assert.equal(art.size, 16);
  assert.equal(stories.size, 16);
});

test('chỉ thiệp mời có slot sự kiện; thông tin cần được điền và xác thực', () => {
  for (const p of ORIGINALS) {
    const doc = createDocument({ template: p });
    assert.equal(Boolean(doc.elements.find(e => e.id === 'event-date')), p.cardType === 'invitation');
    if (p.cardType !== 'invitation') continue;
    editInvitation(doc, 'enabled', true);
    assert.equal(publicInvitation(doc), undefined);
    editInvitation(doc, 'date', '2027-06-01T17:00');
    editInvitation(doc, 'venue', 'Hội trường A');
    assert.deepEqual(publicInvitation(doc), { eventAt:'2027-06-01T10:00:00.000Z', timeZone:'Asia/Ho_Chi_Minh', venue:'Hội trường A' });
    // Đồng hồ đếm ngược dùng đúng ngày giờ Sender vừa nhập, không cần nhập lần hai.
    assert.equal(doc.elements.find(e => e.id === 'event-countdown').props.eventAt, '2027-06-01T10:00:00.000Z');
  }
});

test('seed Catalog và thư viện có đầy đủ 16 mẫu độc lập', () => {
  const rows = builtinLibraryItems();
  for (const p of ORIGINALS) {
    const template = templates.find(t => t.id === p.id);
    assert(addedSystemTemplates.some(t => t.id === p.id));
    const publicRow = publicTemplate(template);
    assert.equal(publicRow.cardType, p.cardType);
    assert.deepEqual(publicRow.paletteColors, [p.bg,p.ink,p.button,p.detail]);
    const row = rows.find(r => r.kind === 'template' && r.id === p.id);
    assert(row.definition.documents.vi && row.definition.documents.en);
  }
});

test('lịch, URL bản đồ và đếm ngược không chèn thêm nội dung hoặc token', () => {
  const event = { eventAt:'2027-06-01T10:00:00.000Z', venue:'A, B; C\r\nATTENDEE:malicious' };
  const url = new URL(eventMapUrl(event.venue));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('query'), event.venue);
  const ics = eventCalendar(event, 'A\r\nATTENDEE:malicious', { now:0, uid:'test' });
  assert(ics.includes('DTSTART:20270601T100000Z'));
  assert(!ics.includes('\r\nATTENDEE:'));
  assert(ics.includes('LOCATION:A\\, B\\; C\\nATTENDEE:malicious'));
  assert.deepEqual(eventRemaining(event.eventAt, Date.parse(event.eventAt) - 90061000), [1,1,1,1]);
  assert.deepEqual(eventRemaining(event.eventAt, Date.parse(event.eventAt) + 1000), [0,0,0,0]);
});

test('Catalog lấy số cảnh và hiệu ứng theo thiết kế, kể cả khi bản ghi MySQL cũ còn ghi 4 cảnh', () => {
  for (const p of ORIGINALS) {
    const stale = { ...templates.find(t => t.id === p.id), scenes: 4, effect: 'Mở thư' };
    const view = publicTemplate(stale);
    assert.equal(view.scenes, p.branch ? 6 : 4, p.id);
    assert.equal(view.scenes, templatePreviewDocument(p, (key, params) => serverText('vi', key, params)).scenes.length, p.id);
    assert.notEqual(view.effect, '', p.id);
  }
});
