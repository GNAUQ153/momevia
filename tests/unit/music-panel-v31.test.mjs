import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchingMusicTracks, normalizeMusicQuery, filterMusicPanel } from "../../web/js/features/canvas-editor/music-panel.js";
import { SOUNDTRACKS } from "../../web/js/shared/canvas/soundtracks.js";
import vi from "../../web/assets/locales/vi.json" with { type: "json" };
import en from "../../web/assets/locales/en.json" with { type: "json" };
import { translate } from "../../web/js/shared/locale.js";

const localize = (dict, code) => key => translate(dict, code, key);

test("Tìm tên bài nhạc bằng tiếng Việt có dấu hoặc không dấu", () => {
  assert.equal(normalizeMusicQuery("  Đêm MƠ MÀNG  "), "dem mo mang");
  assert.deepEqual(matchingMusicTracks({ query: "binh minh", translate: localize(vi, "vi") }).map(x => x.id), ["calm-dawn"]);
  assert.deepEqual(matchingMusicTracks({ query: "MƠ MÀNG", translate: localize(vi, "vi") }).map(x => x.id), ["dreamy-night"]);
});

test("Tìm theo tên và mô tả tiếng Anh; kết hợp bộ lọc cảm xúc", () => {
  assert.deepEqual(matchingMusicTracks({ query: "Bright", occasion: "general", translate: localize(en, "en") }).map(x => x.id), ["bright-day"]);
  assert.deepEqual(matchingMusicTracks({ query: "warm", mood: "joyful", occasion: "general", translate: localize(en, "en") }).map(x => x.id), ["bright-day"]);
  assert.equal(matchingMusicTracks({ query: "warm", mood: "gentle", occasion: "general", translate: localize(en, "en") }).length, 0);
  assert.equal(matchingMusicTracks({ mood: "other" }).length, 0);
  assert.equal(matchingMusicTracks({}).length, SOUNDTRACKS.length);
});

test("Bộ lọc UI chỉ ẩn track không khớp, giữ lựa chọn không dùng nhạc", () => {
  const buttons = [
    { dataset: { trackId: "" }, hidden: true },
    ...SOUNDTRACKS.map(track => ({ dataset: { trackId: track.id }, hidden: false })),
  ];
  const elements = {
    '[data-editor-music-filter]': { value: "joyful" },
    '[data-editor-music-search]': { value: "bright" },
    '[data-editor-music-results]': { textContent: "" },
  };
  const root = {
    querySelector: selector => elements[selector] ?? null,
    querySelectorAll: selector => selector === '[data-editor-action="soundtrack-pick"]' ? buttons : [],
  };
  // Hàm sẽ dùng bản dịch đang active (VI mặc định); lọc theo mood trước.
  const result = filterMusicPanel(root);
  assert.equal(result, 0);
  assert.equal(buttons[0].hidden, false);
  assert.ok(buttons.slice(1).every(button => button.hidden));
});

test("Khóa dịch UI có đủ VI/EN và dùng chung cấu trúc", () => {
  for (const key of ["editor.music.search", "editor.music.searchPlaceholder", "editor.music.results", "editor.music.empty"]) {
    assert.equal(typeof vi[key], "string", key);
    assert.equal(typeof en[key], "string", key);
    assert.notEqual(vi[key], en[key]);
  }
  assert.equal(translate(vi, "vi", "editor.music.results", { count: 2 }), "Hiển thị 2 bản nhạc");
  assert.equal(translate(en, "en", "editor.music.results", { count: 2 }), "Showing 2 tracks");
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
});

test("Designer dùng panel tách riêng nhưng giữ hành vi chọn và Undo/Redo", () => {
  const src = readFileSync("web/js/pages/designer.js", "utf8");
  const panel = readFileSync("web/js/features/canvas-editor/music-panel.js", "utf8");
  assert.match(src, /createMusicPanel\(store\.get\(\)\.document\.soundtrack\)/);
  assert.match(src, /syncMusicPanel\(main, doc\.soundtrack/);
  assert.match(src, /filterMusicPanel\(main\)/);
  assert.match(src, /await change\(\{ target: musicSelect \}\)/);
  assert.match(src, /editor\.history\.setMusicVolume/);
  assert.match(panel, /aria-pressed/);
  assert.match(panel, /type: "search"/);
});
