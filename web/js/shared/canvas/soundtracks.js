// Danh mục nhạc nội bộ: ID cố định, không dùng URL từ dữ liệu người dùng.
// Bản bổ sung dịp lễ được tổng hợp tại scripts/assets/generate-occasion-music.py.
// Metadata chỉ phục vụ chọn nhạc; Canvas JSON tiếp tục lưu { id, volume }.
export const SOUNDTRACKS = Object.freeze([
  Object.freeze({ id: "calm-dawn", occasion: "general", titleKey: "editor.music.calmDawn", descriptionKey: "editor.music.calmDawnDesc", mood: "gentle", durationSeconds: 24, src: "/assets/music/calm-dawn.mp3" }),
  Object.freeze({ id: "dreamy-night", occasion: "general", titleKey: "editor.music.dreamyNight", descriptionKey: "editor.music.dreamyNightDesc", mood: "gentle", durationSeconds: 24, src: "/assets/music/dreamy-night.mp3" }),
  Object.freeze({ id: "bright-day", occasion: "general", titleKey: "editor.music.brightDay", descriptionKey: "editor.music.brightDayDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/bright-day.mp3" }),
  Object.freeze({ id: "little-celebration", occasion: "general", titleKey: "editor.music.littleCelebration", descriptionKey: "editor.music.littleCelebrationDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/little-celebration.mp3" }),
  Object.freeze({ id: "birthday-sparkle", occasion: "birthday", titleKey: "editor.music.birthdaySparkle", descriptionKey: "editor.music.birthdaySparkleDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/birthday-sparkle.mp3" }),
  Object.freeze({ id: "wedding-promise", occasion: "wedding", titleKey: "editor.music.weddingPromise", descriptionKey: "editor.music.weddingPromiseDesc", mood: "gentle", durationSeconds: 24, src: "/assets/music/wedding-promise.mp3" }),
  Object.freeze({ id: "christmas-lights", occasion: "christmas", titleKey: "editor.music.christmasLights", descriptionKey: "editor.music.christmasLightsDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/christmas-lights.mp3" }),
  Object.freeze({ id: "newyear-countdown", occasion: "newyear", titleKey: "editor.music.newyearCountdown", descriptionKey: "editor.music.newyearCountdownDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/newyear-countdown.mp3" }),
  Object.freeze({ id: "tet-spring", occasion: "tet", titleKey: "editor.music.tetSpring", descriptionKey: "editor.music.tetSpringDesc", mood: "joyful", durationSeconds: 24, src: "/assets/music/tet-spring.mp3" }),
  Object.freeze({ id: "valentine-whisper", occasion: "valentine", titleKey: "editor.music.valentineWhisper", descriptionKey: "editor.music.valentineWhisperDesc", mood: "gentle", durationSeconds: 24, src: "/assets/music/valentine-whisper.mp3" }),
]);

// ID duy nhất, không nhận URL do người dùng nhập và không đọc file từ đường dẫn tuỳ ý.
export const soundtrackById = id => SOUNDTRACKS.find(track => track.id === id) ?? null;
export const SOUNDTRACK_OCCASIONS = Object.freeze([
  "general", "birthday", "wedding", "christmas", "newyear", "tet", "valentine",
]);

// Lọc theo nhóm cảm xúc; không sửa danh mục gốc hoặc dữ liệu thiết kế.
export function tracksForMood(mood = "all") {
  if (mood === "all") return SOUNDTRACKS;
  return ["gentle", "joyful"].includes(mood) ? SOUNDTRACKS.filter(track => track.mood === mood) : [];
}
