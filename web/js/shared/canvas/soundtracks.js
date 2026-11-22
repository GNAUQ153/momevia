// Danh mục nhạc nội bộ: ID cố định, không dùng URL từ dữ liệu người dùng.
// Hai bản mới được tổng hợp tại scripts/assets/generate-music-v3.py.
// Metadata chỉ phục vụ chọn nhạc; Canvas JSON tiếp tục lưu { id, volume }.
export const SOUNDTRACKS = Object.freeze([
  Object.freeze({ id: "calm-dawn", titleKey: "editor.music.calmDawn", descriptionKey: "editor.music.calmDawnDesc", mood: "gentle", durationSeconds: 24, src: "/assets/music/calm-dawn.mp3" }),
  Object.freeze({ id: "dreamy-night", titleKey: "editor.music.dreamyNight", descriptionKey: "editor.music.dreamyNightDesc", mood: "gentle", durationSeconds: 24, src: "/assets/music/dreamy-night.mp3" }),
  Object.freeze({ id: "bright-day", titleKey: "editor.music.brightDay", descriptionKey: "editor.music.brightDayDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/bright-day.mp3" }),
  Object.freeze({ id: "little-celebration", titleKey: "editor.music.littleCelebration", descriptionKey: "editor.music.littleCelebrationDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/little-celebration.mp3" }),
]);

export const soundtrackById = id => SOUNDTRACKS.find(track => track.id === id) ?? null;

// Lọc theo nhóm cảm xúc; không sửa danh mục gốc hoặc dữ liệu thiết kế.
export function tracksForMood(mood = "all") {
  if (mood === "all") return SOUNDTRACKS;
  return ["gentle", "joyful"].includes(mood) ? SOUNDTRACKS.filter(track => track.mood === mood) : [];
}
