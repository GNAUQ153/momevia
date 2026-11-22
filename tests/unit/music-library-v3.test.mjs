import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { SOUNDTRACKS, soundtrackById, tracksForMood } from '../../web/js/shared/canvas/soundtracks.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const translations = lang => JSON.parse(readFileSync(resolve(root, `web/assets/locales/${lang}.json`), 'utf8'));

test('Thư viện có bốn bản nội bộ, ID/đường dẫn cố định và metadata rõ ràng', () => {
  assert.equal(SOUNDTRACKS.length, 4);
  assert.equal(new Set(SOUNDTRACKS.map(track => track.id)).size, 4);
  for (const track of SOUNDTRACKS) {
    assert.match(track.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(track.src, `/assets/music/${track.id}.mp3`);
    assert.ok(['gentle', 'joyful'].includes(track.mood));
    assert.equal(track.durationSeconds, 24);
    assert.equal(soundtrackById(track.id), track);
    const file = resolve(root, 'web', track.src.slice(1));
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 3).toString('ascii'), 'ID3');
    assert.ok(statSync(file).size > 50_000 && statSync(file).size < 600_000);
  }
  assert.equal(soundtrackById('https://example.com/song.mp3'), null);
  assert.equal(soundtrackById('../private'), null);
});

test('Bộ lọc tâm trạng không sửa dữ liệu và từ chối giá trị không xác định', () => {
  const gentle = tracksForMood('gentle');
  const joyful = tracksForMood('joyful');
  assert.equal(gentle.length, 2);
  assert.equal(joyful.length, 2);
  assert.deepEqual([...gentle, ...joyful].map(track => track.id).sort(), SOUNDTRACKS.map(track => track.id).sort());
  assert.equal(tracksForMood('all'), SOUNDTRACKS);
  assert.deepEqual(tracksForMood('https://evil.example'), []);
});

test('Tất cả metadata đều có bản dịch VI/EN và dùng cùng bố cục', () => {
  const vi = translations('vi');
  const en = translations('en');
  const keys = ['editor.music.browse', 'editor.music.mood', 'editor.music.all', 'editor.music.gentle', 'editor.music.joyful'];
  for (const track of SOUNDTRACKS) keys.push(track.titleKey, track.descriptionKey);
  for (const key of keys) {
    assert.equal(typeof vi[key], 'string', key);
    assert.equal(typeof en[key], 'string', key);
    assert.ok(vi[key].trim() && en[key].trim());
  }
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
});

test('Bản mới và bản cũ lưu cùng schema Canvas; không lưu mood, URL hoặc metadata', () => {
  for (const track of SOUNDTRACKS) {
    const doc = createDocument({ presetId: 'blank' });
    doc.schemaVersion = 2;
    doc.registryVersion = 2;
    doc.soundtrack = { id: track.id, volume: 0.55 };
    const saved = validateDocument(doc);
    assert.deepEqual(saved.soundtrack, { id: track.id, volume: 0.55 });
    assert.deepEqual(publicDocument(saved).soundtrack, saved.soundtrack);
  }
  const legacy = createDocument({ presetId: 'blank' });
  assert.equal(validateDocument(legacy).soundtrack, undefined);
  const malicious = createDocument({ presetId: 'blank' });
  malicious.schemaVersion = 2;
  malicious.registryVersion = 2;
  malicious.soundtrack = { id: 'little-celebration', volume: .55, url: 'https://evil.example' };
  assert.throws(() => validateDocument(malicious));
});

test('Designer giữ select, dùng cùng handler để commit và hỗ trợ aria-pressed cho thẻ', () => {
  const designer = readFileSync(resolve(root, 'web/js/pages/designer.js'), 'utf8');
  const panel = readFileSync(resolve(root, 'web/js/features/canvas-editor/music-panel.js'), 'utf8');
  const css = readFileSync(resolve(root, 'web/css/music-controls.css'), 'utf8');
  assert.match(designer, /soundtrack-pick/);
  assert.match(designer, /await change\(\{ target: musicSelect \}\)/);
  assert.match(panel, /data-editor-music-filter/);
  assert.match(panel, /aria-pressed/);
  assert.match(css, /\.editor-music-track\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(css, /prefers-reduced-motion/);
});
