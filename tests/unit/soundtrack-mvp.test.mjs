import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, publicDocument, duplicateDocument } from '../../web/js/shared/canvas/schema.js';
import { cleanGiftLayout } from '../../web/js/shared/canvas/clean-layout.js';
import { soundtrackById, SOUNDTRACKS } from '../../web/js/shared/canvas/soundtracks.js';
import { createSoundtrackPlayback } from '../../web/js/features/gift-runtime/soundtrack.js';

const withSoundtrack = (id = 'calm-dawn') => {
  const doc = createDocument({ presetId: 'blank' });
  doc.schemaVersion = 2;
  doc.registryVersion = 2;
  doc.soundtrack = { id, volume: 0.55 };
  return doc;
};

test('Legacy Canvas remains valid and music is opt-in', () => {
  const original = createDocument({ presetId: 'blank' });
  assert.equal(Object.hasOwn(original, 'soundtrack'), false);
  assert.equal(Object.hasOwn(validateDocument(original), 'soundtrack'), false);
  assert.equal(publicDocument(original).soundtrack, undefined);
});

test('A known track survives save, duplicate, and explicit public projection', () => {
  const doc = withSoundtrack();
  const validated = validateDocument(doc, { mode: 'publish', requiredBindings: [] });
  assert.deepEqual(validated.soundtrack, { id: 'calm-dawn', volume: 0.55 });
  assert.deepEqual(publicDocument(validated).soundtrack, validated.soundtrack);
  assert.deepEqual(duplicateDocument(validated).soundtrack, validated.soundtrack);
});

test('V1 cannot silently store a V2 feature', () => {
  const doc = withSoundtrack();
  doc.schemaVersion = 1;
  doc.registryVersion = 1;
  assert.throws(() => validateDocument(doc), /phiên bản 2/);
});

test('Reject unknown, remote, and malformed track references', () => {
  const unknown = withSoundtrack('https://example.com/track.mp3');
  assert.throws(() => validateDocument(unknown), error => error.code === 'SOUNDTRACK_NOT_ALLOWED');
  const extra = withSoundtrack();
  extra.soundtrack.src = 'https://example.com/track.mp3';
  assert.throws(() => validateDocument(extra), /chưa được hỗ trợ/);
  for (const volume of [-0.01, 1.01, Infinity, '1']) {
    const doc = withSoundtrack();
    doc.soundtrack.volume = volume;
    assert.throws(() => validateDocument(doc));
  }
});

test('Local allowlist contains only known paths and regifting removes previous sender music', () => {
  assert.equal(SOUNDTRACKS.length, 50);
  for (const track of SOUNDTRACKS) {
    assert.ok(track.src.startsWith('/assets/music/'));
    assert.ok(track.src.endsWith('.mp3'));
    assert.equal(soundtrackById(track.id), track);
  }
  assert.equal(soundtrackById('../../secret'), null);
  assert.equal(cleanGiftLayout(withSoundtrack()).soundtrack, undefined);
});

function mediaMock({reject = false} = {}) {
  const media = {
    src: '', preload: '', loop: false, volume: 0,
    playCount: 0, pauseCount: 0, removed: false,
    play() { this.playCount++; return reject ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve(); },
    pause() { this.pauseCount++; },
    removeAttribute() { this.removed = true; },
    load() {},
  };
  return media;
}

test('Audio starts only after explicit toggle and cleans up on dispose', async () => {
  const media = mediaMock();
  const changes = [];
  const player = createSoundtrackPlayback({ id: 'bright-day', volume: .4 }, { createAudio: () => media, onState: state => changes.push(state) });
  assert.equal(media.playCount, 0);
  assert.equal(media.preload, 'none');
  assert.equal(media.volume, .4);
  assert.equal(media.loop, true);
  assert.equal(player.playing, false);
  assert.equal(await player.toggle(), true);
  assert.equal(player.playing, true);
  assert.equal(await player.toggle(), false);
  assert.equal(player.playing, false);
  player.dispose();
  assert.equal(media.removed, true);
  assert.ok(media.pauseCount >= 2);
  assert.equal(await player.toggle(), false);
  assert.equal(media.playCount, 1);
  assert.deepEqual(changes.map(s=>s.playing), [true, false]);
});

test('Playback denial is communicated and never claims a track is playing', async () => {
  const media = mediaMock({reject:true});
  const states = [];
  const player = createSoundtrackPlayback({ id: 'calm-dawn', volume: .5 }, { createAudio:()=>media, onState:s=>states.push(s) });
  assert.equal(await player.toggle(), false);
  assert.equal(player.playing, false);
  assert.deepEqual(states, [{playing:false,error:true}]);
  player.dispose();
});

test('Late play resolution cannot restart audio after pause or dispose', async () => {
  const media = mediaMock();
  let release;
  media.play = () => new Promise(resolve => { release = resolve; });
  const player = createSoundtrackPlayback({id:'calm-dawn',volume:.5}, { createAudio:()=>media });
  const started = player.toggle();
  player.pause();
  release();
  assert.equal(await started, false);
  assert.equal(player.playing, false);
  player.dispose();
});

test('Static server serves only bundled MP3 with correct MIME', async () => {
  const http = await import('node:http');
  const { staticFile } = await import('../../src/gateway/static.mjs');
  const server = http.createServer((req, res) => staticFile(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${url}/assets/music/calm-dawn.mp3`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /audio\/mpeg/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 1000 && bytes.length < 600_000);
    assert.equal(bytes.toString('ascii', 0, 3), 'ID3');
    const missing = await fetch(`${url}/assets/music/unknown.mp3`);
    assert.equal(missing.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Creator template allows music personalization without unlocking layout', async () => {
  const { DesignsService } = await import('../../src/modules/designs/designs.service.mjs');
  const service = new DesignsService({});
  const current = {
    document: createDocument({ presetId: 'blank' }),
    policy: { kind: 'creator-template', editableBindings: [], photoId: null },
  };
  assert.equal(current.document.schemaVersion, 1);
  const withMusic = structuredClone(current.document);
  withMusic.schemaVersion = 2;
  withMusic.registryVersion = 2;
  withMusic.soundtrack = { id: 'calm-dawn', volume: .55 };
  assert.doesNotThrow(() => service.enforcePolicy(current, withMusic));
  const altered = structuredClone(withMusic);
  altered.artboard.baseSize.width += 20;
  assert.throws(() => service.enforcePolicy(current, altered), error => error.code === 'LOCKED_ELEMENT');
});
