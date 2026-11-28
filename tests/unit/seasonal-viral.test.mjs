import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { templates, addedSystemTemplates } from '../../src/modules/catalog/seed.mjs';
import { BASIC_TEMPLATES, createDocument, validateDocument } from '../../web/js/shared/canvas/index.js';
import { vietnamDay, isInSeason, featuredSeasons } from '../../web/js/features/catalog/seasonal.js';
import { RECIPIENT_CREATE_URL, recipientSuggestions, recipientViralCta } from '../../web/js/ui/recipient-viral.js';
import { createGiftViews } from '../../web/js/pages/gifts.js';

const newIds = [
  'winter-wishes-2026', 'new-year-spark-2027', 'spring-blessing-2027', 'velvet-valentine-2027',
  'birthday-radiance', 'thank-you-bloom', 'proud-of-you', 'faraway-hug', 'gentle-apology', 'calm-light',
];

test('Bộ 10 mẫu có ID duy nhất, giá và danh mục rõ, 3 cảnh Canvas chỉnh sửa được', () => {
  assert.equal(templates.length, 45);
  assert.equal(new Set(templates.map(item => item.id)).size, 45);
  for (const id of newIds) {
    const template = templates.find(item => item.id === id);
    assert(template, `Thiếu ${id}`);
    assert(addedSystemTemplates.some(item => item.id === id), `Mẫu ${id} không được seed idempotent`);
    assert.equal(template.status, 'published');
    assert.equal(template.creatorId, 'system');
    assert(template.category !== 'Sinh nhật' || id === 'birthday-radiance');
    assert(Number.isInteger(template.price) && template.price >= 0);
    assert(BASIC_TEMPLATES[id]);
    const doc = createDocument({ template });
    assert.equal(doc.scenes.length, ['birthday-radiance', 'proud-of-you'].includes(id) ? 5 : 3);
    assert(doc.elements.length >= 20);
    assert(doc.elements.some(item => item.type === 'reply'));
    const opener = doc.elements.find(item => doc.scenes[0].elementIds.includes(item.id) && item.actions?.some(action => action.targetSceneId === (['birthday-radiance', 'proud-of-you'].includes(id) ? 'scene-time' : 'scene-surprise')));
    assert(opener, 'Cover has a real control opening the wish scene');
    assert.equal(opener.type, 'button');
    assert(opener.accessibility.label.trim(),'The object has a named keyboard control');
    assert.deepEqual(validateDocument(doc), doc);
    const bound = new Set(doc.elements.filter(item => item.props.textBinding).map(item => item.props.textBinding));
    assert.deepEqual(bound, new Set(['recipientName', 'senderName', 'message']));
    assert(!doc.elements.some(item => item.type === 'sticker'), `Không dùng emoji sticker: ${id}`);
  }
});

test('Lễ hội xuất hiện đúng thời gian theo múi giờ Việt Nam và vẫn giữ trong catalog quanh năm', () => {
  assert.equal(templates.filter(item => item.isSeasonal).length, 4);
  assert.equal(vietnamDay(new Date('2026-12-31T18:00:00Z')), '2027-01-01');
  const winter = templates.find(item => item.id === 'winter-wishes-2026');
  assert(isInSeason(winter, '2026-12-24'));
  assert(!isInSeason(winter, '2027-04-01'));
  assert.equal(featuredSeasons(templates, '2026-12-24')[0].id, winter.id);
  assert.equal(featuredSeasons(templates, '2027-04-01').length, 4, 'Không xóa hoặc ẩn mẫu mua trước đây');
});

test('CTA gửi tiếp không rò rỉ invite token hoặc nội dung quà', () => {
  const html = recipientViralCta('2026-12-24');
  assert.match(html, /Tạo thiệp của riêng bạn/);
  assert.match(html.replace(/<!--[^]*?-->/g, ''), /Tạo bằng <strong>Momevia<\/strong>/);
  assert.equal(RECIPIENT_CREATE_URL, '/explore?source=recipient');
  assert.equal(recipientSuggestions('2027-01-01')[0].id, 'new-year-spark-2027');
  assert.doesNotMatch(html, /(?:invite|token|recipientName|senderName|\/g\/)/);
  assert.match(html, /href="\/template\/winter-wishes-2026"/);
  assert(!html.includes('🎁'));
});

test('Legacy Gift giữ CTA chung, Canvas nhận quà chỉ dựng khung thiệp', () => {
  const legacy = createGiftViews({
    state: { user: null, favorites: new Set() },
    buttonLink: () => '',
    artwork: () => '',
  }).giftPage({
    slug: 'gift-private', theme: 'violet', senderName: 'Người gửi', recipientName: 'Bạn', message: 'Chúc mừng',
    replyPermissions: { canSend: false, canRead: false, repliesDisabled: true }, replyCount: 0,
  });
  assert.match(legacy, /Tạo thiệp của riêng bạn/);
  assert.match(legacy.replace(/<!--[^]*?-->/g, ''), /Tạo bằng <strong>Momevia<\/strong>/);
  assert.doesNotMatch(legacy, /source=gift-private/);
  const main = fs.readFileSync(new URL('../../web/js/app/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /\$\{recipientViralCta\(\)\}/, 'Canvas recipient links show the card without an external promotion');
  assert(!main.includes('Created with momevia.'));
});

test('Chèn thiếu các mẫu mới không ghi đè dữ liệu đã có và không trùng sau lần chạy thứ hai', async () => {
  const { JsonRepository } = await import('../../src/shared/storage.mjs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const folder = mkdtempSync(path.join(os.tmpdir(), 'momevia-seasonal-seed-'));
  try {
    const customized = { ...templates[0], title: 'Tựa đề đã chỉnh trong production', price: 12345 };
    const repo = new JsonRepository(path.join(folder, 'templates.json'), [customized]);
    const addOnlyMissing = () => {
      for (const template of addedSystemTemplates) {
        if (!repo.get(template.id)) repo.insertUnique(template);
      }
    };
    addOnlyMissing();
    const first = repo.all();
    addOnlyMissing();
    assert.deepEqual(repo.all(), first);
    assert.equal(repo.get(customized.id).title, customized.title);
    assert.equal(repo.get(customized.id).price, customized.price);
    assert.equal(first.length, 1 + addedSystemTemplates.length);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('Metadata mùa lễ được xuất cho Catalog API nhưng không ảnh hưởng entitlement và dữ liệu khóa', async () => {
  const { publicTemplate } = await import('../../src/modules/catalog/catalog.service.mjs');
  const source = templates.find(item => item.id === 'spring-blessing-2027');
  const view = publicTemplate(source);
  assert.equal(view.isSeasonal, true);
  assert.equal(view.season, 'Tết Nguyên đán 2027');
  assert.match(view.availableFrom, /^2027-/);
  assert.equal(view.personalization.layout, true);
  assert(!Object.hasOwn(view, 'creatorId'));
  assert(!Object.hasOwn(view, 'privateKey'));
});
