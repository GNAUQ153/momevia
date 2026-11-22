// Danh mục nhạc nội bộ: không nhận URL do người dùng cung cấp.
// Tệp nhạc là giai điệu gốc tổng hợp riêng cho Momevia; xem docs/MUSIC_MVP.md.
export const SOUNDTRACKS = Object.freeze([
  Object.freeze({ id: "calm-dawn", titleKey: "editor.music.calmDawn", src: "/assets/music/calm-dawn.mp3" }),
  Object.freeze({ id: "bright-day", titleKey: "editor.music.brightDay", src: "/assets/music/bright-day.mp3" }),
]);

export const soundtrackById = id => SOUNDTRACKS.find(track => track.id === id) ?? null;
