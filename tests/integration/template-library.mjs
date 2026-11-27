import { editInvitation } from '../../web/js/shared/canvas/invitation.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { randomBytes, randomUUID,createHash } from 'node:crypto';
import {EVENT_MEDIA} from '../../web/js/shared/canvas/event-media.js';
import sharp from 'sharp';
import { createDocument, publicDocument, canonicalStringify, BASIC_TEMPLATES, insertPhotoFrame } from '../../web/js/shared/canvas/index.js';
import { materializeTemplateStart } from '../../web/js/features/canvas-editor/template-start.js';
import { templates, addedSystemTemplates } from '../../src/modules/catalog/seed.mjs';
import { builtinMedia } from '../../src/modules/designs/builtin-media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryRoot = fs.realpathSync(os.tmpdir());
const fixtureRoot = fs.mkdtempSync(path.join(temporaryRoot, 'momevia-basic-library-'));
const beforeEnv = { ...process.env }, beforeCwd = process.cwd(), apps = [];
Object.assign(process.env, { NODE_ENV: 'test', IDENTITY_STORAGE: 'json', CATALOG_STORAGE: 'json', CHECKOUT_STORAGE: 'json', GIFTS_STORAGE: 'json', SUPPORT_STORAGE: 'json', DESIGNS_STORAGE: 'json', PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false', CANVAS_READ_ENABLED: 'true', CANVAS_EDIT_ENABLED: 'true', CANVAS_PUBLISH_ENABLED: 'true', TEST_ACCOUNT_ENABLED: 'false' });

async function fixture(name, legacy = false, existingTemplates) {
  const directory = path.join(fixtureRoot, name); fs.mkdirSync(directory);
  for (const item of ['src', 'web']) fs.cpSync(path.join(root, item), path.join(directory, item), { recursive: true });
  fs.copyFileSync(path.join(root, 'package.json'), path.join(directory, 'package.json'));
  fs.symlinkSync(fs.realpathSync(path.join(root, 'node_modules')), path.join(directory, 'node_modules'), 'junction');
  if (existingTemplates) {
    const data = path.join(directory, 'services/catalog/data');
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, 'templates.json'), JSON.stringify(existingTemplates));
  }
  if (legacy) {
    // Explicit fixture for an already-running v1 server: same registry/API, generic preset.
    const file = path.join(directory, 'web/js/shared/canvas/presets.js'), source = fs.readFileSync(file, 'utf8');
    const marker = 'const basic = template ? createBasicTemplate(template, localize) : null;'; assert(source.includes(marker));
    fs.writeFileSync(file, source.replace(marker, 'const basic = null;'));
    const routes = path.join(directory, 'src/modules/designs/routes.mjs');
    const routeSource = fs.readFileSync(routes, 'utf8');
    const localeArgument = ', { locale: requestLocale(req) }'; assert(routeSource.includes(localeArgument));
    fs.writeFileSync(routes, routeSource.replace(localeArgument, ''));
  }
  process.chdir(directory);
  const { createHttpApp } = await import(pathToFileURL(path.join(directory, 'src/server/app.mjs')).href);
  const config = { baseUrl: 'http://127.0.0.1', jwtSecret: randomBytes(32).toString('hex'), internalKey: randomBytes(32).toString('hex'), demoEnabled: false, adminCode: '', giftTtlDays: 365, googleId: '', googleSecret: '', zaloId: '', zaloSecret: '', testAccount: null };
  const app = await createHttpApp(config); apps.push(app);
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening'); const base = `http://127.0.0.1:${app.server.address().port}`; config.baseUrl = base;
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Template QA', email: `${randomUUID()}@example.test`, password: 'BasicTemplatesQA123', confirmPassword: 'BasicTemplatesQA123' }) });
  assert.equal(response.status, 201); const cookie = response.headers.get('set-cookie').split(';')[0];
  async function request(route, body, status = 200, authenticated = true, locale) {
    const result = await fetch(base + '/api' + route, { method: body === undefined ? 'GET' : 'POST', headers: { ...(authenticated ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(locale ? { 'x-momevia-locale': locale } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await result.json(); assert.equal(result.status, status, JSON.stringify(data)); return data;
  }
  const upload = async (designId, bytes,mime='image/png',mutationId=randomUUID()) => {
    const response = await fetch(`${base}/api/designs/designs/${designId}/assets`, { method: 'POST', headers: { cookie, 'content-type': mime, 'x-mutation-id': mutationId }, body: bytes });
    const result = await response.json(); assert.equal(response.status, 201, JSON.stringify(result)); return result.asset;
  };
  return { base, request, upload, cookie };
}

try {
  const current = await fixture('current');
  const catalog = (await current.request('/catalog/templates', undefined, 200, false)).templates;
  assert.equal(catalog.length, 34); let published = 0;
  for (const template of catalog) {
    const mutationId = randomUUID(); const created = await current.request('/designs/designs', { source: { kind: 'template', templateId: template.id }, presetId: 'envelope-basic', mutationId }, 201);
    let d = created.design;
    const expectedPreset = createDocument({ template });
    // A new Sender draft opts into versioned manual recipient naming; the
    // template factory and historical documents remain unchanged.
    expectedPreset.personalization = { version: 1, mode: expectedPreset.invitation && expectedPreset.elements.some(e=>e.type==='reply'&&e.props.replyMode==='attendance')?'self':'manual' };
    assert.equal(d.document.assets.length, expectedPreset.assets.length);
    for (const [index, ref] of expectedPreset.assets.entries()) {
      const media = builtinMedia(ref.assetId), original = ref.assetId, owned = d.document.assets[index].assetId;
      assert(media, 'Only known bundled assets may be materialized');
      assert.match(owned, /^[0-9a-f-]{36}$/); assert.notEqual(original, owned);
      const response = await fetch(`${current.base}/api/designs/designs/${d.id}/assets/${owned}`, { headers: { cookie: current.cookie } });
      assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), media.bytes);
      assert.equal((await fetch(`${current.base}/api/designs/designs/${d.id}/assets/${owned}`)).status, 401);
      ref.assetId = owned;
      for (const element of expectedPreset.elements) if (element.type === 'image' && element.props.assetId === original) element.props.assetId = owned;
    }
    assert.deepEqual(d.document, expectedPreset); assert.equal(d.source.templateId, template.id); assert.equal(d.source.kind, 'template');
    const originalSource = structuredClone(d.source);
    if(d.document.invitation){editInvitation(d.document,'date','2027-01-03T09:45');editInvitation(d.document,'venue','QA event hall');}
    d.document.personalization={version:1,mode:'manual'};
    const prediction = d.document.elements.find(e => e.props.kind === 'prediction-choice');
    if (prediction) Object.assign(prediction.props, { question: 'Bữa tối nào?', optionA: 'Quán mì', optionB: 'Vào bếp', prediction: 'A', reason: 'Kỷ niệm năm nhất.', endingA: 'Hẹn ở quán.', endingB: 'Tớ sẽ nấu.' });
    d.document.bindings.recipientName.value = 'Nguyễn Mai'; d.document.bindings.senderName.value = 'Trần An'; d.document.bindings.message.value = `Lời chúc thử nghiệm mẫu ${template.title}, giữ đầy đủ dấu tiếng Việt.`;
    await current.request(`/designs/designs/${d.id}/save`, { expectedRevision: d.revision, mutationId: randomUUID(), title: d.title, document: d.document });
    const expected = structuredClone(d.document); d = (await current.request(`/designs/designs/${d.id}`)).design; assert.equal(d.revision, 2); assert.deepEqual(d.document, expected); assert.deepEqual(d.source, originalSource);
    if (template.id === 'polaroid') {
      const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#91ACA0' } }).png().toBuffer();
      const asset = await current.upload(d.id, bytes); assert.equal(asset.status, 'ready');
      const withPhoto = insertPhotoFrame(d.document, asset.id);
      await current.request(`/designs/designs/${d.id}/save`, { expectedRevision: d.revision, mutationId: randomUUID(), title: d.title, document: withPhoto });
      d = (await current.request(`/designs/designs/${d.id}`)).design;
      assert.equal(d.revision, 3); assert.deepEqual(d.document, withPhoto); assert.equal(d.document.elements.find(e => e.id === 'photo-window-image').props.assetId, asset.id);
      assert.equal((await fetch(`${current.base}/api/designs/designs/${d.id}/assets/${asset.id}`)).status, 401);
    }
    const preflight = await current.request(`/designs/designs/${d.id}/preflight`, { expectedRevision: d.revision });
    const publish = { designId: d.id, expectedRevision: d.revision, expectedDocumentHash: d.documentHash, idempotencyKey: randomUUID() };
    if (template.price) {
      assert.equal(preflight.authorization.status, 'needs_template_license'); assert.equal(preflight.canPublish, false);
      await current.request('/gifts/gifts/from-design', publish, 402);
    } else {
      assert.equal(preflight.canPublish, true, JSON.stringify(preflight));
      const result = await current.request('/gifts/gifts/from-design', publish, 201); const replay = await current.request('/gifts/gifts/from-design', publish);
      assert.equal(replay.gift.slug, result.gift.slug);
      const view = (await current.request(`/gifts/gifts/${result.gift.slug}`, undefined, 200, false)).gift;
      const projected=publicDocument(expected);
      if(projected.invitation){assert.deepEqual(view.invitation,{eventAt:projected.invitation.eventAt,timeZone:projected.invitation.timeZone,venue:expected.elements.find(e=>e.id===projected.invitation.venueElementId).props.text});delete projected.invitation;}
      assert.deepEqual(view.documentSnapshot, projected); published++;
    }
    const image = await fetch(`${current.base}/assets/basic-templates/${template.id}.svg`); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/svg+xml');
    assert.equal(await image.text(), fs.readFileSync(path.join(root, `web/assets/basic-templates/${template.id}.svg`), 'utf8'));
  }
  assert.equal(published, templates.filter(template => template.price === 0).length); assert.deepEqual((await current.request('/checkout/orders')).orders, []);
  const page = await fetch(current.base + '/template/sunny-wishes'); const markup = await page.text();
  const styles=[...markup.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);assert(styles.length>0);
  const sheets=await Promise.all(styles.map(async url=>{const response=await fetch(current.base+url);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/css/);return response.text();}));
  assert(sheets.some(css=>css.includes('.template-preview-dialog')),'The actual served stylesheet must contain the preview dialog styles');
  assert.doesNotMatch(page.headers.get('content-security-policy'), /unsafe-inline|unsafe-eval/);
  console.log('PASS Current JSON API: 28 templates create/save/reload, free publications, paid license gate, 28 SVG covers.');

  const addedIds = new Set(addedSystemTemplates.map(template => template.id));
  const originals = templates.filter(template => !addedIds.has(template.id));
  const existing = await fixture('existing', false, originals);
  const updated = (await existing.request('/catalog/templates', undefined, 200, false)).templates;
  assert.deepEqual(updated, catalog);
  console.log(`PASS Existing JSON catalog: appended ${updated.length - originals.length} missing templates and preserved all ${originals.length} originals.`);

  const localizedStart = { source: { kind: 'template', templateId: 'sunny-wishes' }, mutationId: randomUUID() };
  const english = (await current.request('/designs/designs', localizedStart, 201, true, 'en')).design;
  const vietnamese = (await current.request('/designs/designs', { ...localizedStart, mutationId: randomUUID() }, 201)).design;
  assert.equal(english.startingLocale, 'en');
  assert.equal(english.document.elements.find(item => item.id === 'cover-title').props.text, 'Your day.\nYour sunshine.');
  assert.equal(english.source.templateVersionId, vietnamese.source.templateVersionId);
  assert.notEqual(english.documentHash, vietnamese.documentHash);
  assert.equal(english.revision, 1);
  assert.deepEqual((await current.request('/designs/designs', localizedStart, 201, true, 'vi')).design, english);
  const matching = await current.request('/catalog/templates?q=A%20Memory%20of%20Us&style=all', undefined, 200, false, 'en');
  assert.deepEqual(matching.templates.map(item => item.id), ['mot-ky-niem']);
  const cover = await fetch(current.base + '/assets/basic-templates/en/sunny-wishes.svg');
  assert.equal(cover.status, 200);
  assert.match(cover.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await cover.text(), /sunshine\.<\/tspan>/);
  console.log('PASS English template search and cover, localized draft revision 1, stable source version and locale across retry.');

  const legacy = await fixture('legacy-cached', true); const key = randomUUID(), template = catalog.find(t => t.id === 'sunny-wishes');
  const original = (await legacy.request('/designs/designs', { source: { kind: 'template', templateId: template.id }, presetId: 'envelope-basic', mutationId: key }, 201)).design;
  assert.notEqual(canonicalStringify(original.document), canonicalStringify(createDocument({ template })));
  let dropAck = true; const writes = [];const aliases=new Map(),initializerMedia={fetchMedia:url=>fetch(legacy.base+url),uploadMedia:async(blob,mutationId)=>{const bytes=Buffer.from(await blob.arrayBuffer()),sha=createHash('sha256').update(bytes).digest('hex'),source=Object.keys(EVENT_MEDIA).find(id=>EVENT_MEDIA[id].sha256===sha),asset=await legacy.upload(original.id,bytes,blob.type,mutationId);assert(source);aliases.set(asset.id,source);return asset;}};
  const request = async (route, body) => {
    if (body) writes.push(structuredClone(body)); const result = await legacy.request(route, body);
    if (body && dropAck) { dropAck = false; throw new Error('Injected lost initialization ACK after commit'); } return result;
  };
  await assert.rejects(materializeTemplateStart(original, { template, createMutationId: key, request,...initializerMedia }), /lost initialization ACK/);
  const recovered = await materializeTemplateStart(original, { template, createMutationId: key, request,...initializerMedia });
  assert.equal(recovered.revision, 2); assert.deepEqual(writes[0], writes[1]); assert.deepEqual(recovered.source, original.source); assert.deepEqual(recovered.policy, original.policy); const normalized=structuredClone(recovered.document);for(const ref of normalized.assets)ref.assetId=aliases.get(ref.assetId)||ref.assetId;for(const e of normalized.elements)if(e.type==='image')e.props.assetId=aliases.get(e.props.assetId)||e.props.assetId;assert.deepEqual(normalized,createDocument({template}));
  recovered.document.bindings.message.value = 'Nội dung ở một tab khác';
  await legacy.request(`/designs/designs/${recovered.id}/save`, { expectedRevision: 2, mutationId: randomUUID(), title: recovered.title, document: recovered.document });
  const latest = await materializeTemplateStart(original, { template, createMutationId: key, request,...initializerMedia }); assert.equal(latest.revision, 3); assert.equal(latest.document.bindings.message.value, 'Nội dung ở một tab khác');
  assert.equal(Object.keys(BASIC_TEMPLATES).length, 34);
  console.log('PASS Cached-v1 fixture: updated client materializes template through real CAS; lost ACK retries identical key/body; latest draft edits/source/policy survive.');
} finally {
  for (const app of apps) { await new Promise(resolve => app.server.close(resolve)); await app.close(); }
  process.chdir(beforeCwd);
  for (const key of Object.keys(process.env)) if (!(key in beforeEnv)) delete process.env[key]; Object.assign(process.env, beforeEnv);
  const relative = path.relative(temporaryRoot, fixtureRoot);
  if (!relative.startsWith('momevia-basic-library-') || relative.includes(path.sep) || path.isAbsolute(relative)) throw new Error('Refuse unexpected fixture cleanup path.');
  for (const directory of fs.readdirSync(fixtureRoot)) {
    const modules = path.join(fixtureRoot, directory, 'node_modules');
    if (fs.lstatSync(modules, {throwIfNoEntry:false})?.isSymbolicLink()) fs.unlinkSync(modules);
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
