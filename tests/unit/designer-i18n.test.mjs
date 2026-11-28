import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import vi from '../../web/assets/locales/vi.json' with { type: 'json' };
import { translateUi as translate } from '../../web/js/shared/locale.js';
import { catalog } from '../../web/js/features/canvas-editor/library.js';
import { filteredIds } from '../../web/js/features/canvas-editor/library-discovery.js';
import { matchesLocalizedBlock } from '../../web/js/features/canvas-editor/discovery-panel.js';
import { effectFamilies } from '../../web/js/shared/canvas/effects.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const english = key => translate(en, 'en', key);
const matchesEnglish = (block, query) => matchesLocalizedBlock(block, query, english);
const vietnameseLetters = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;

test('all Canvas library IDs and group names have independent English display copy', () => {
  assert.equal(catalog.reduce((count, group) => count + group.items.length, 0), 312);
  for (const [index, group] of catalog.entries()) {
    assert.equal(translate(vi, 'vi', `editor.library.group.${index}`), group.label);
    assert(!vietnameseLetters.test(english(`editor.library.group.${index}`)));
    for (const block of group.items) {
      assert.equal(vi[`editor.library.item.${block.id}`], block.title);
      const translated = english(`editor.library.item.${block.id}`);
      assert(translated && translated !== `editor.library.item.${block.id}`);
      assert(!vietnameseLetters.test(translated), `${block.id}: ${translated}`);
    }
  }
});

test('English library searches retain original block identity and filters', () => {
  const before = JSON.stringify(catalog.map(group => group.items.map(({ id, title }) => [id, title])));
  const result = filteredIds(catalog, { query: 'lucky coins', matches: matchesEnglish });
  assert(result.has('m55-lucky-coins'));
  assert(!result.has('m55-star-trail'));
  const seasonal = filteredIds(catalog, { query: 'lunar new year', mode: 'season', matches: matchesEnglish });
  assert(seasonal.size >= 6);
  const vietnamese = filteredIds(catalog, { query: 'bong tuyet', matches: matchesEnglish });
  assert(vietnamese.has('m54-snowflake'));
  assert.equal(JSON.stringify(catalog.map(group => group.items.map(({ id, title }) => [id, title]))), before);
});

test('all effect IDs and UI keys have English copy, without changing effect presets', () => {
  for (const [family, definition] of Object.entries(effectFamilies)) {
    const key = `editor.effects.family.${family}`;
    assert(Object.hasOwn(en, key));
    assert.equal(vi[key], definition.label);
    for (const [id, label] of Object.entries(definition.presets)) {
      const presetKey = `editor.effects.preset.${id}`;
      assert.equal(vi[presetKey], label);
      assert(Object.hasOwn(en, presetKey));
      assert(!vietnameseLetters.test(en[presetKey]));
    }
  }
  for (const key of Object.keys(vi).filter(key => key.startsWith('editor.interface.') || key.startsWith('editor.recovery.') || key.startsWith('editor.crop.'))) {
    assert(Object.hasOwn(en, key), key);
    assert(!vietnameseLetters.test(en[key]), `English copy still contains Vietnamese characters: ${key}`);
  }
});

test('Canvas UI panels bind translated labels instead of displaying hardcoded copy', () => {
  const sources = [
    'web/js/features/canvas-editor/discovery-panel.js',
    'web/js/features/canvas-editor/recovery-center.js',
    'web/js/features/canvas-editor/crop.js',
  ].map(name => fs.readFileSync(path.join(root, name), 'utf8'));
  assert(sources[0].includes('editor.library.item.${block.id}'));
  assert(sources[0].includes('editor.interface.searchPlaceholder'));
  assert(sources[1].includes('setText(badge, message('));
  assert(sources[1].includes('editor.recovery.serverSummary'));
  assert(sources[2].includes('editor.crop.anchor.${anchor.id}'));
  const designer = fs.readFileSync(path.join(root, 'web/js/pages/designer.js'), 'utf8');
  assert(designer.includes('createDiscoveryPanel('));
  assert(designer.includes('filterDiscoveryPanel('));
  assert(designer.includes('signal.addEventListener(\'abort\', removeLocaleListener'));
  assert(!designer.includes('button("Bản nháp", "recovery-center"'));
});

test('nested translated message parameters update without leaking Vietnamese into English', () => {
  const nested = { format: 'message', key: 'editor.interface.photoNumber', params: { index: 2 } };
  assert.equal(translate(en, 'en', 'editor.interface.replaceNamedPhoto', { name: nested }), 'Replace Photo 2');
  assert.equal(translate(vi, 'vi', 'editor.interface.replaceNamedPhoto', { name: nested }), 'Thay Ảnh 2');
});
