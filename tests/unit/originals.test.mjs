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

test('16 mẫu Originals có bốn scene, artwork riêng và action hợp lệ trong VI/EN', () => {
  assert.equal(new Set(ORIGINAL_IDS).size, 16);
  assert.equal(ORIGINALS.filter(p => p.cardType === 'invitation').length, 10);
  const art = new Set();
  for (const item of ORIGINALS) {
    assert.equal(systemCardType(item.id), item.cardType);
    for (const locale of ['vi','en']) {
      const doc = templatePreviewDocument(item, (key, params) => serverText(locale, key, params));
      assert.equal(doc.scenes.length, 4);
      assert.doesNotThrow(() => validateDocument(doc, { mode: 'publish' }));
      assert.doesNotThrow(() => validateDocument(duplicateDocument(doc)));
      assert.equal(doc.elements.find(e => e.id === 'open-gift').actions[0].targetSceneId, 'scene-main');
      assert.equal(doc.elements.find(e => e.id === 'to-discover').actions[0].targetSceneId, 'scene-discover');
      assert.equal(doc.elements.find(e => e.id === 'to-finish').actions[0].targetSceneId, 'scene-finish');
      assert.equal(doc.elements.find(e => e.id === 'replay-gift').actions[0].type, 'replay');
      assert.equal(doc.elements.find(e => e.id === 'event-album').props.photos.length, 3);
      if (locale === 'vi') art.add(JSON.stringify(doc.elements.find(e => e.id === 'cover-art').artwork));
    }
  }
  assert.equal(art.size, 16);
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
