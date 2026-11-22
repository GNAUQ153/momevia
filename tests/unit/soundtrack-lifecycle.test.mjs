import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createSoundtrackPlayback } from "../../web/js/features/gift-runtime/soundtrack.js";

function fakeAudio() {
  const listeners = new Map();
  const audio = {
    src: "", preload: "", volume: 0, loop: false, pauseCount: 0,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    emit(type) { for (const callback of listeners.get(type) || []) callback(); },
    listenerCount(type) { return listeners.get(type)?.size || 0; },
    play() { return Promise.resolve(); },
    pause() { this.pauseCount++; },
    removeAttribute(name) { if (name === "src") this.src = ""; },
    load() {},
  };
  return audio;
}

const track = { id: "calm-dawn", volume: 0.55 };

test("Lỗi audio đến sau khi đã phát chuyển UI về trạng thái an toàn", async () => {
  const audio = fakeAudio();
  const states = [];
  const player = createSoundtrackPlayback(track, { createAudio: () => audio, onState: state => states.push(state) });
  assert.equal(await player.toggle(), true);
  assert.equal(player.playing, true);
  audio.emit("error");
  assert.equal(player.playing, false);
  assert.deepEqual(states.at(-1), { playing: false, error: true });
  assert.ok(audio.pauseCount >= 1);
  // Sau khi người dùng nhấn lại, một lượt phát mới vẫn hoạt động.
  assert.equal(await player.toggle(), true);
  assert.deepEqual(states.at(-1), { playing: true, error: false });
  player.dispose();
});

test("Media controls bên ngoài phát pause/ended phải đồng bộ UI", async () => {
  const audio = fakeAudio();
  const states = [];
  const player = createSoundtrackPlayback(track, { createAudio: () => audio, onState: state => states.push(state) });
  await player.toggle();
  audio.emit("pause");
  assert.equal(player.playing, false);
  assert.deepEqual(states.at(-1), { playing: false, error: false });
  await player.toggle();
  audio.emit("ended");
  assert.equal(player.playing, false);
  player.dispose();
});

test("Error trong khi play pending không bị Promise muộn bật lại", async () => {
  const audio = fakeAudio();
  let resolvePlay;
  audio.play = () => new Promise(resolve => { resolvePlay = resolve; });
  const states = [];
  const player = createSoundtrackPlayback(track, { createAudio: () => audio, onState: state => states.push(state) });
  const action = player.toggle();
  audio.emit("error");
  resolvePlay();
  assert.equal(await action, false);
  assert.equal(player.playing, false);
  assert.deepEqual(states.at(-1), { playing: false, error: true });
  player.dispose();
});

test("Dispose tháo listeners và không cập nhật state sau khi đóng", async () => {
  const audio = fakeAudio();
  const states = [];
  const player = createSoundtrackPlayback(track, { createAudio: () => audio, onState: state => states.push(state) });
  await player.toggle();
  const before = states.length;
  player.dispose();
  for (const name of ["pause", "ended", "error"]) {
    assert.equal(audio.listenerCount(name), 0);
    audio.emit(name);
  }
  assert.equal(states.length, before);
  assert.equal(await player.toggle(), false);
});

test("Designer dừng nghe thử khi tab ẩn và tháo listener theo vòng đời", () => {
  const source = fs.readFileSync("web/js/pages/designer.js", "utf8");
  assert.match(source, /addEventListener\("visibilitychange",/);
  assert.match(source, /globalThis\.document\.hidden\) musicPreview\?\.pause\(\)/);
  assert.match(source, /\}, \{ signal \}\)/);
  assert.match(source, /lifecycle\.abort\(\)/);
});
