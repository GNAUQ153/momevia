import test from 'node:test';
import assert from 'node:assert/strict';
import { signatureQaEnabled, signatureQaTemplates } from '../../src/modules/catalog/signature-qa.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { addedSystemTemplates, templates } from '../../src/modules/catalog/seed.mjs';
import { templateFieldKey } from '../../web/js/shared/template-copy.js';
import { createDocument, templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { captureSemanticRoles } from '../../web/js/shared/canvas/template-slots.js';
import { duplicateDocument, validateDocument } from '../../web/js/shared/canvas/schema.js';
import { invitationSlotIds } from '../../src/modules/designs/design-views.mjs';
import { signatureTemplateIds } from '../../web/js/shared/canvas/signature/templates.js';
import { serverText } from '../../src/shared/locale.mjs';

const qaEnv = {
  MOMEVIA_SIGNATURE_QA: 'true', NODE_ENV: 'development', HOST: '127.0.0.1',
  PORT: '4116', PUBLIC_BASE_URL: 'http://127.0.0.1:4116', DEMO_AUTH_ENABLED: 'true',
  PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false',
  ...Object.fromEntries(['IDENTITY','CATALOG','CHECKOUT','GIFTS','DESIGNS','SUPPORT'].map(name => [`${name}_STORAGE`, 'json'])),
};

test('Signature QA mặc định tắt, chỉ bật ở loopback JSON không thanh toán', () => {
  assert.equal(signatureQaEnabled({}), false);
  assert.equal(signatureQaEnabled({ ...qaEnv, MOMEVIA_SIGNATURE_QA: 'false' }), false);
  assert.equal(signatureQaEnabled(qaEnv), true);
  for (const invalid of [
    { NODE_ENV: 'production' }, { HOST: '0.0.0.0' }, { PUBLIC_BASE_URL: 'https://example.test' },
    { PUBLIC_BASE_URL: 'http://127.0.0.1:4117' }, { PORT: '0' }, { RAILWAY_ENVIRONMENT: 'production' },
    { CATALOG_STORAGE: 'mysql' }, { DESIGNS_STORAGE: 'mysql' }, { MOMEVIA_DATA_DIR: '/other/profile' },
    { ALLOWED_ORIGINS: 'https://example.test' }, { PAYMENT_ENABLED: 'true' },
    { PAYMENT_LIVE_ENABLED: 'true' }, { DEMO_AUTH_ENABLED: 'false' },
  ]) assert.throws(() => signatureQaEnabled({ ...qaEnv, ...invalid }), /Signature QA/);
});

const rows = signatureQaTemplates();
const repo = { async all() { return rows; }, async get(id) { return rows.find(row => row.id === id); } };
test('Sáu mẫu QA không vào seed chuẩn và mặc định không được đọc qua Catalog', async () => {
  assert.deepEqual(rows.map(row => row.id), signatureTemplateIds);
  assert(rows.every(row => !templates.some(t => t.id === row.id) && !addedSystemTemplates.some(t => t.id === row.id)));
  const service = new CatalogService(repo);
  assert.deepEqual(await service.publicList(), []);
  assert.equal((await service.publishedIds()).size, 0);
  for (const row of rows) await assert.rejects(service.publicOne(row.id), error => error.status === 404 || error.statusCode === 404);
});

test('Catalog QA trả về sáu mẫu hệ thống có cover, dữ liệu VI/EN và đúng loại thiệp', async () => {
  const service = new CatalogService(repo, null, { signatureQa: true });
  const found = await service.search({ q: 'Signature', cardType: 'invitation' });
  assert.equal(found.length, 6);
  assert.deepEqual(await service.search({ cardType: 'greeting' }), []);
  for (const row of rows) {
    const template = await service.publicOne(row.id);
    assert.equal(template.systemOwned, true);
    assert.equal(template.cardType, 'invitation');
    assert.equal(template.coverRevision, 'signature-qa-v1');
    assert.equal(template.price, 0);
    assert.equal(template.personalization.layout, true);
    assert(template.personalization.photoFrames >= 2);
    assert.equal(templateFieldKey(template, 'title'), `templates.${row.id}.title`);
    assert.equal(templateFieldKey(template, 'subtitle'), `templates.${row.id}.subtitle`);
    assert.equal(await service.isPublic({ ...row, status: 'rejected' }), false);
    assert.equal(await service.isPublic({ ...row, creatorId: 'other' }), false);
    for (const locale of ['vi', 'en']) {
      const localize = (key, params) => serverText(locale, key, params);
      const preview = templatePreviewDocument(template, localize);
      assert.match(previewSvg(preview), /<svg/);
      assert.equal(preview.scenes.length, 4);
      const draft = createDocument({ template, localize });
      assert.doesNotThrow(() => validateDocument(draft));
      assert.equal(invitationSlotIds({ source: { templateId: row.id }, policy: { kind: 'sender-basic' }, document: draft }).dateElementId, 'event-date');
      const copy = duplicateDocument(draft);
      const map = new Map(draft.elements.map((element, i) => [element.id, copy.elements[i].id]));
      const slots = invitationSlotIds({ source: { templateId: row.id }, policy: { kind: 'sender-basic' }, document: copy,
        provenance: { slotMap: { elements: captureSemanticRoles(draft, {}, map) } } });
      assert.deepEqual(slots, { dateElementId: map.get('event-date'), venueElementId: map.get('event-location') });
    }
  }
});
