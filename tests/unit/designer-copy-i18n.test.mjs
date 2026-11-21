import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { translate, vi } from '../../web/js/shared/locale.js';
import { checkDesignerCopy, persistedCanvasCopy, readUiLiterals } from '../../scripts/quality/check-ui-i18n.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const designer = fs.readFileSync(path.join(root, 'web/js/pages/designer.js'), 'utf8');
const historyKeys = [
  'editCardText', 'editPhotoSlot', 'editFocalPoint', 'replacePhoto', 'fabricInline',
  'fabricDialog', 'useUploadedPhoto', 'addUploadedPhoto', 'insertOpening',
  'removeAlbumPhoto', 'removeEffect', 'addScene', 'duplicateScene',
  'changeEntryScene', 'deleteScene', 'centerLayer', 'fitLayer', 'resetCrop',
  'deleteElement', 'duplicateElement', 'reorderLayers', 'reorderScenes',
  'describeMemoryPhoto', 'editProperties', 'keyboardMove',
];

test('Designer labels and history commands have independent English copy', () => {
  for (const suffix of historyKeys) {
    const key = `editor.history.${suffix}`;
    assert.equal(typeof en[key], 'string', `Missing English ${key}`);
    assert.equal(typeof vi[key], 'string', `Missing Vietnamese ${key}`);
    assert.notEqual(en[key], vi[key], `Untranslated ${key}`);
    assert(!/[À-ỹđĐ]/u.test(en[key]), `Vietnamese visible in English ${key}`);
    assert(designer.includes(`t("${key}")`), `Designer does not use ${key}`);
  }
  for (const key of ['editor.designer.cardText', 'editor.designer.photo', 'editor.history.insertBlock']) {
    assert.notEqual(en[key], vi[key]);
  }
});

test('History for added library block is English and does not persist a renamed block', () => {
  assert.equal(translate(en, 'en', 'editor.history.insertBlock', {
    name: { format: 'message', key: 'editor.library.item.greeting' },
  }), `Insert ${en['editor.library.item.greeting']}`);
  assert(designer.includes('models.at(-1).name ||= block.title'));
  assert(designer.includes('key: `editor.library.item.${block.id}`'));
});

test('UI literal audit ignores comments but detects new untranslated UI copy', () => {
  assert.deepEqual(checkDesignerCopy(designer), []);
  assert.deepEqual(readUiLiterals('// Nút bằng tiếng Việt\nconst title = "Tên nút";').map(item => item.value), ['Tên nút']);
  const changed = designer + '\nconst newButton = "Gửi lời chúc";\n';
  assert(checkDesignerCopy(changed).some(item => item.value === 'Gửi lời chúc'));
  assert.equal(persistedCanvasCopy.size, 6);
});

test('Data-bearing Canvas defaults stay unchanged', () => {
  for (const raw of ['"Nội dung kỷ niệm"', '"Chú thích ảnh"', '"Món quà của tôi"',
    '"Lời chúc của bạn"', '`Cảnh ${value.document.scenes.length + 1}`']) {
    assert(designer.includes(raw), `Missing persisted Canvas value ${raw}`);
  }
});

test('Fabric UI controls use shared focus and touch target tokens', () => {
  const tokens = fs.readFileSync(path.join(root, 'web/css/tokens.css'), 'utf8');
  assert(tokens.includes('--ui-control-min-height: 44px;'));
  assert(tokens.includes('--ui-focus-ring:'));
  for (const file of ['editor-fabric-quickbar.css', 'editor-fabric-properties.css', 'editor-fabric-inspector.css']) {
    const css = fs.readFileSync(path.join(root, 'web/css', file), 'utf8');
    assert(css.includes('min-height: var(--ui-control-min-height);'), file);
    assert(css.includes('var(--ui-focus-ring)'), file);
    assert(css.includes('@media (prefers-reduced-motion: reduce)'), file);
  }
});
