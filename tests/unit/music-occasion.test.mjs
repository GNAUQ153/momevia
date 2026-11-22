import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { SOUNDTRACKS, SOUNDTRACK_OCCASIONS, soundtrackById } from '../../web/js/shared/canvas/soundtracks.js';
import { matchingMusicTracks, normalizeMusicQuery } from '../../web/js/features/canvas-editor/music-panel.js';
import { createSoundtrackPlayback } from '../../web/js/features/gift-runtime/soundtrack.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import vi from '../../web/assets/locales/vi.json' with { type: 'json' };
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { translate } from '../../web/js/shared/locale.js';

const translated = (dictionary, locale) => key => translate(dictionary, locale, key);
const names = ['birthday', 'wedding', 'christmas', 'newyear', 'tet', 'valentine'];

test('Thư viện tăng lên 10 bài với sáu dịp riêng và không trùng ID', () => {
  assert.equal(SOUNDTRACKS.length, 10);
  assert.equal(new Set(SOUNDTRACKS.map(track => track.id)).size, SOUNDTRACKS.length);
  assert.deepEqual(SOUNDTRACK_OCCASIONS, ['general', ...names]);
  for (const occasion of names) {
    const tracks = SOUNDTRACKS.filter(track => track.occasion === occasion);
    assert.equal(tracks.length, 1, occasion);
    assert.equal(tracks[0].durationSeconds, 24);
    assert.ok(['gentle', 'joyful'].includes(tracks[0].mood));
    assert.equal(soundtrackById(tracks[0].id), tracks[0]);
  }
  assert.equal(SOUNDTRACKS.filter(track => track.occasion === 'general').length, 4);
});

test('Mỗi MP3 là asset nội bộ, không cho đường dẫn hoặc URL từ ngoài', () => {
  for (const item of SOUNDTRACKS) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.equal(item.src, `/assets/music/${item.id}.mp3`);
    const file = new URL(`../../web${item.src}`, import.meta.url);
    const magic = readFileSync(file).subarray(0, 3).toString('ascii');
    assert.equal(magic, 'ID3', item.id);
    assert.ok(statSync(file).size > 50_000 && statSync(file).size < 500_000);
  }
  assert.equal(soundtrackById('https://example.org/a.mp3'), null);
  assert.equal(soundtrackById('../private'), null);
});

test('Bộ lọc dịp và tâm trạng chỉ đọc metadata, không thay đổi thứ tự danh mục', () => {
  for (const occasion of names) {
    const matches = matchingMusicTracks({ occasion });
    assert.equal(matches.length, 1, occasion);
    assert.equal(matches[0].occasion, occasion);
  }
  assert.equal(matchingMusicTracks({ occasion: 'invalid' }).length, 0);
  assert.equal(matchingMusicTracks({ occasion: 'wedding', mood: 'joyful' }).length, 0);
  assert.equal(matchingMusicTracks({ occasion: 'wedding', mood: 'gentle' }).length, 1);
  assert.deepEqual(matchingMusicTracks({ occasion: 'all' }), SOUNDTRACKS);
});

test('Tìm nhạc theo dịp ở VI/EN và hỗ trợ tiếng Việt không dấu', () => {
  assert.equal(normalizeMusicQuery('  ĐÁM CƯỚI  '), 'dam cuoi');
  assert.equal(matchingMusicTracks({ query: 'dam cuoi', occasion: 'wedding', translate: translated(vi, 'vi') }).length, 1);
  assert.equal(matchingMusicTracks({ query: 'sinh nhat', occasion: 'birthday', translate: translated(vi, 'vi') }).length, 1);
  assert.equal(matchingMusicTracks({ query: 'Christmas', occasion: 'christmas', translate: translated(en, 'en') }).length, 1);
  assert.equal(matchingMusicTracks({ query: 'wedding', occasion: 'wedding', translate: translated(en, 'en') }).length, 1);
  assert.equal(matchingMusicTracks({ query: 'sinh nhat', occasion: 'birthday', translate: translated(en, 'en') }).length, 0);
});

test('VI/EN có đủ khóa cho tất cả dịp và bài nhạc, dùng chung DOM layout', () => {
  for (const key of ['editor.music.occasion', 'editor.music.occasion.all',
    ...SOUNDTRACK_OCCASIONS.map(value => `editor.music.occasion.${value}`),
    ...SOUNDTRACKS.flatMap(track => [track.titleKey, track.descriptionKey])]) {
    assert.ok(typeof vi[key] === 'string' && vi[key].length > 1, key);
    assert.ok(typeof en[key] === 'string' && en[key].length > 1, key);
  }
  assert.deepEqual(Object.keys(vi), Object.keys(en));
  const panel = readFileSync(new URL('../../web/js/features/canvas-editor/music-panel.js', import.meta.url), 'utf8');
  const designer = readFileSync(new URL('../../web/js/pages/designer.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
  assert.match(panel, /data-editor-music-occasion/);
  assert.match(panel, /occasion: occasion\?\.value \|\| "all"/);
  assert.match(designer, /data-editor-music-filter\], \[data-editor-music-occasion\]/);
  assert.match(html, /href="\/css\/music-occasion\.css"/);
});

test('Bản nhạc theo dịp giữ schema Canvas V2, không cho metadata/URL vào dữ liệu', () => {
  for (const occasion of names) {
    const track = SOUNDTRACKS.find(item => item.occasion === occasion);
    const doc = createDocument({ presetId: 'blank' });
    doc.schemaVersion = 2;
    doc.registryVersion = 2;
    doc.soundtrack = { id: track.id, volume: 0.45 };
    const valid = validateDocument(doc);
    assert.deepEqual(valid.soundtrack, { id: track.id, volume: 0.45 });
    assert.deepEqual(publicDocument(valid).soundtrack, valid.soundtrack);
    doc.soundtrack.src = track.src;
    assert.throws(() => validateDocument(doc));
  }
});

test('Recipient không tự bật nhạc trước hành động phát của người dùng', () => {
  const calls = { play: 0 };
  const audio = {
    preload: '', loop: false, volume: 0,
    play() { calls.play++; return Promise.resolve(); },
    pause() {}, removeAttribute() {}, load() {},
  };
  const player = createSoundtrackPlayback({ id: 'christmas-lights', volume: .55 }, { createAudio: () => audio });
  assert.ok(player);
  assert.equal(calls.play, 0);
  assert.equal(audio.preload, 'none');
  assert.equal(player.playing, false);
  player.dispose();
});

test('Styling theo dịp có kích thước thao tác và hỗ trợ reduced motion', () => {
  const css = readFileSync(new URL('../../web/css/music-occasion.css', import.meta.url), 'utf8');
  const sharedCss = readFileSync(new URL('../../web/css/music-controls.css', import.meta.url), 'utf8');
  assert.match(css, /min-height: var\(--ui-control-min-height\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /font-family: var\(--font-body\)/);
  assert.match(sharedCss, /perspective: 1000px/);
});
