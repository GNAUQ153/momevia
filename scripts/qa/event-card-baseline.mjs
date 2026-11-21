import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { createDocument, templatePreviewDocument, canonicalStringify } from '../../web/js/shared/canvas/index.js';
import { serverText } from '../../src/shared/locale.mjs';
const base = 'http://127.0.0.1:4178';
const ids = ['birthday-radiance', 'hai-phong-bi', 'proud-of-you'];
if (fs.existsSync('tests/fixtures/event-cards-before.json'))
  throw new Error('Baseline already captured at 6c09d33. Refusing to replace historical evidence.');
const folder = 'docs/event-cards/before'; fs.mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const auth = await context.request.post(base + '/api/auth/demo', { data: { deviceId: 'event-cards-baseline', name: 'Event Cards QA' } });
  if (!auth.ok()) throw new Error(await auth.text());
  const cookie = (await context.cookies()).map(c => c.name + '=' + c.value).join('; ');
  fs.writeFileSync('local/event-cards/session.json', JSON.stringify({ cookie }));
  const request = async (route, body, status = 200) => {
    const r = await context.request.fetch(base + '/api' + route, { method: body ? 'POST' : 'GET', data: body });
    if (r.status() !== status) throw new Error(route + ' ' + await r.text()); return r.json();
  };
  const fixtures = [];
  for (const id of ids) {
    let { design } = await request('/designs/designs', { source: { kind: 'template', templateId: id }, mutationId: randomUUID() }, 201);
    for (const [key, value] of Object.entries({ recipientName: 'Nguyễn Hoàng Minh Anh', senderName: 'Trần Khánh An', message: 'Lời chúc cũ đã chỉnh.\nGiữ nguyên nội dung và quyền.' })) design.document.bindings[key].value = value;
    design.document.elements[0].layout.x += 3;
    await request(`/designs/designs/${design.id}/save`, { document: design.document, expectedRevision: design.revision, mutationId: randomUUID(), title: design.title });
    design = (await request(`/designs/designs/${design.id}`)).design;
    const { gift } = await request('/gifts/gifts/from-design', { designId: design.id, expectedRevision: design.revision, expectedDocumentHash: design.documentHash, idempotencyKey: randomUUID() }, 201);
    const publicGift = (await request(`/gifts/gifts/${gift.slug}`)).gift;
    fixtures.push({ id, design, gift: publicGift });
  }
  fs.writeFileSync('local/event-cards/old-records.json', JSON.stringify(fixtures, null, 2));
  fs.writeFileSync('tests/fixtures/event-cards-before.json', JSON.stringify({ commit: '6c09d33', templates: templates.map(t => ({ ...t, documentHash: createHash('sha256').update(canonicalStringify(createDocument({ template: t }))).digest('hex') })), documents: Object.fromEntries(ids.map(id => [id, createDocument({ template: templates.find(t => t.id === id) })])) }, null, 2) + '\n');
  const page = await context.newPage();
  for (const locale of ['vi', 'en']) for (const id of ids) {
    await page.goto(base + '/template/' + id);
    await page.locator('#site-header [data-locale-select]').first().selectOption(locale, { force: true });
    await page.locator('[data-template-preview]').first().click();
    const dialog = page.locator('dialog.template-preview-dialog[open]');
    await dialog.locator('.gift-runtime-stage').waitFor();
    const doc = templatePreviewDocument({ id }, key => serverText(locale, key));
    for (const index of doc.scenes.keys()) {
      await dialog.locator('.gift-runtime-navigation button').nth(index).click();
      await dialog.locator('.gift-runtime-stage').screenshot({ path: `${folder}/${id}-${locale}-${index + 1}.png` });
    }
    await dialog.locator('[data-template-close]').click();
  }
  console.log('Saved 18 old scene screenshots, all 24 hashes, 3 edited drafts and 3 published gifts.');
} finally { await browser.close(); }
