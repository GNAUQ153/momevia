import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSoundtrackPlayback } from '../../web/js/features/gift-runtime/soundtrack.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';

function mockAudio() {
  return {
    volume: 0,
    preload: '',
    loop: false,
    src: '',
    pause() {},
    play() { return Promise.resolve(); },
    removeAttribute() {},
    load() {},
  };
}

test('Âm lượng có thể điều chỉnh mà không tự phát nhạc', async () => {
  const audio = mockAudio();
  const player = createSoundtrackPlayback({ id: 'calm-dawn', volume: 0.55 }, { createAudio: () => audio });
  assert.equal(player.volume, 0.55);
  assert.equal(player.playing, false);
  assert.equal(player.setVolume(0.25), true);
  assert.equal(player.volume, 0.25);
  assert.equal(player.playing, false);
  assert.equal(await player.toggle(), true);
  assert.equal(player.setVolume(0.75), true);
  assert.equal(player.volume, 0.75);
  player.dispose();
  assert.equal(player.setVolume(0.5), false);
});

test('Từ chối âm lượng không hợp lệ và giữ nguyên giá trị cũ', () => {
  const audio = mockAudio();
  const player = createSoundtrackPlayback({ id: 'bright-day', volume: .55 }, { createAudio: () => audio });
  for (const input of [-0.1, 1.1, NaN, Infinity, -Infinity, '0.5', null]) {
    assert.equal(player.setVolume(input), false);
    assert.equal(player.volume, 0.55);
  }
  assert.equal(player.setVolume(0), true);
  assert.equal(player.volume, 0);
  assert.equal(player.setVolume(1), true);
  assert.equal(player.volume, 1);
  player.dispose();
});

test('Snapshot công khai giữ âm lượng của Sender, không có âm lượng Recipient', () => {
  const doc = createDocument({presetId:'blank'});
  doc.schemaVersion = 2;
  doc.registryVersion = 2;
  doc.soundtrack = {id:'bright-day', volume:0.25};
  const result = publicDocument(validateDocument(doc, {mode:'publish',requiredBindings:[]}));
  assert.deepEqual(result.soundtrack, {id:'bright-day',volume:0.25});
});

test('Control VI/EN có đầy đủ khóa dịch và không thêm nguồn phát ngoài danh mục', () => {
  const vi = JSON.parse(fs.readFileSync('web/assets/locales/vi.json', 'utf8'));
  const en = JSON.parse(fs.readFileSync('web/assets/locales/en.json', 'utf8'));
  for (const key of ['editor.music.volume','editor.history.setMusicVolume','gift.music.volume']) {
    assert.equal(typeof vi[key], 'string');
    assert.equal(typeof en[key], 'string');
    assert.ok(vi[key].length > 1 && en[key].length > 1);
  }
  const designer = fs.readFileSync('web/js/pages/designer.js', 'utf8');
  const player = fs.readFileSync('web/js/features/gift-runtime/index.js', 'utf8');
  assert.match(designer, /data-editor-field['"]:\s*['"]soundtrack-volume['"]/);
  assert.match(designer, /editor\.music\.volume/);
  assert.match(player, /gift\.music\.volume/);
  assert.match(player, /soundtrackPlayback\.setVolume\(percent \/ 100\)/);
});
