// Giao diện chọn nhạc dùng chung cho hai ngôn ngữ; không thay đổi Canvas JSON.
import { currentLocale, message, setText, t } from "../../core/i18n.js";
import { SOUNDTRACKS, SOUNDTRACK_OCCASIONS, soundtrackById } from "../../shared/canvas/soundtracks.js";
import { audioCuration, musicIsSelectable } from '../../shared/canvas/music-curation.js';
import { button, node, select } from "./dom.js";

// Chuẩn hoá dấu tiếng Việt để người dùng có thể gõ "binh minh" hoặc "bình minh".
export function normalizeMusicQuery(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, letter => letter === "Đ" ? "D" : "d")
    .toLocaleLowerCase()
    .trim();
}

// Chỉ tìm trong metadata của các bản nhạc allowlist; không phân tích HTML hay URL ngoài.
export const musicTrackTitle = track => audioCuration(`music:${track.id}`)?.title?.[currentLocale()] || message(track.titleKey);
const occasionFor = track => audioCuration(`music:${track.id}`)?.theme || track.occasion;
const availableTracks = () => SOUNDTRACKS.filter(track => musicIsSelectable(track.id));
export function matchingMusicTracks({ query = "", mood = "all", occasion = "all", market = "all", vocals = "all", translate = t } = {}) {
  const normalizedQuery = normalizeMusicQuery(query);
  return SOUNDTRACKS.filter(track => {
    if (!musicIsSelectable(track.id)) return false;
    if (market !== 'all' && (track.market || 'international') !== market) return false;
    if (vocals !== 'all' && track.instrumental !== (vocals === 'instrumental')) return false;
    if (mood !== "all" && track.mood !== mood) return false;
    if (occasion !== "all" && occasionFor(track) !== occasion) return false;
    if (!normalizedQuery) return true;
    const tokens = [
      translate(track.titleKey),
      translate(track.descriptionKey),
      track.artist, track.originalTitle, audioCuration(`music:${track.id}`)?.keywords || '',
      ...Object.values(audioCuration(`music:${track.id}`)?.title || {}),
      translate(`editor.music.${track.mood}`),
      translate(`editor.music.occasion.${occasionFor(track)}`),
    ];
    return tokens.some(value => normalizeMusicQuery(value).includes(normalizedQuery));
  });
}

export function createMusicPanel(soundtrack) {
  const selectedId = soundtrack?.id || "";
  const selectedTrack = soundtrackById(selectedId);
  const available = availableTracks();
  const legacySelected = selectedTrack && !available.some(track => track.id === selectedId);
  const choices = legacySelected ? [selectedTrack, ...available] : available;
  const volume = Math.round((soundtrack?.volume ?? 0.55) * 100);
  return node("section", { class: "editor-music-card", "aria-label": message("editor.music.title") },
    node("div", { class: "editor-music-heading" },
      node("h3", {}, message("editor.music.title")),
      node("span", { class: "editor-music-caption" }, message("editor.music.badge")),
    ),
    node("p", { class: "editor-music-help" }, message("editor.music.help")),
    node('p',{class:'editor-music-help','data-music-legacy':'',hidden:!legacySelected},message(selectedTrack?.version>=2?'musicLibrary.disabledPinned':'editor.music.legacyPinned')),
    select(message("editor.music.choice"), "soundtrack", selectedId, [
      ["", message("editor.music.none")],
      ...choices.map(track => [track.id, musicTrackTitle(track)]),
    ]),
    node("div", { class: "editor-music-library" },
      node("label", { class: "editor-music-filter" },
        node("span", {}, message("editor.music.mood")),
        node("select", { "data-editor-music-filter": "", "aria-label": message("editor.music.mood") },
          node("option", { value: "all" }, message("editor.music.all")),
          node("option", { value: "gentle" }, message("editor.music.gentle")),
          node("option", { value: "joyful" }, message("editor.music.joyful")),
        ),
      ),
      node("label", { class: "editor-music-occasion-filter" },
        node("span", {}, message("editor.music.occasion")),
        node("select", { "data-editor-music-occasion": "", "aria-label": message("editor.music.occasion") },
          node("option", { value: "all" }, message("editor.music.occasion.all")),
          ...SOUNDTRACK_OCCASIONS.map(occasion => node("option", { value: occasion },
            message(`editor.music.occasion.${occasion}`))),
        ),
      ),
      ...['market', 'vocals'].map(filter => node('label', { class: 'editor-music-filter' },
        node('span', {}, message(`musicLibrary.${filter}`)),
        node('select', { [`data-editor-music-${filter}`]: '', 'aria-label': message(`musicLibrary.${filter}`) },
          ...['all', ...(filter === 'market' ? ['vietnam', 'us-uk', 'korea', 'international'] : ['instrumental', 'vocal'])].map(id =>
            node('option', { value: id }, message(`musicLibrary.${filter}.${id}`)))))),
      node("label", { class: "editor-music-search" },
        node("span", {}, message("editor.music.search")),
        node("input", {
          type: "search", maxlength: "80", "data-editor-music-search": "",
          placeholder: message("editor.music.searchPlaceholder"),
          "aria-label": message("editor.music.search"),
          autocomplete: "off",
        }),
      ),
      node("p", { class: "editor-music-results", role: "status", "aria-live": "polite", "data-editor-music-results": "" },
        message("editor.music.results", { count: available.length })),
      node("div", { class: "editor-music-grid", role: "group", "aria-label": message("editor.music.browse") },
        button(message("editor.music.none"), "soundtrack-pick", {
          class: "editor-music-track", "data-track-id": "", "data-music-mood": "all",
          "aria-pressed": !soundtrack ? "true" : "false",
        }),
        ...available.map(track => node("button", {
          type: "button", class: "editor-music-track", "data-editor-action": "soundtrack-pick",
          "data-track-id": track.id, "data-music-mood": track.mood,
          "data-music-occasion": occasionFor(track),
          "aria-pressed": selectedId === track.id ? "true" : "false",
        },
          node("strong", { class: "editor-music-track-title" }, musicTrackTitle(track)),
          node("span", { class: "editor-music-track-description" }, message(track.descriptionKey)),
          node("span", { class: "editor-music-track-meta" },
            message(`editor.music.occasion.${occasionFor(track)}`),
            " - ",
            message(track.mood === "gentle" ? "editor.music.gentle" : "editor.music.joyful"),
            ` - ${Math.floor(track.durationSeconds / 60)}:${String(Math.floor(track.durationSeconds % 60)).padStart(2, "0")}`,
          ),
        )),
      ),
    ),
    node('p', {class:'editor-music-source','data-music-source':'',hidden:!selectedTrack?.artist},
      ...(selectedTrack?.artist ? [`${selectedTrack.originalTitle} — ${selectedTrack.artist} - ${selectedTrack.license} - `,
        node('a', {href:selectedTrack.sourceUrl,target:'_blank',rel:'noopener noreferrer'}, message('editor.music.source'))] : [])),
    node('p', { class: 'editor-music-help' }, message('musicLibrary.mediaChanges')),
    node("label", { class: "editor-music-volume" },
      node("span", {}, message("editor.music.volume")),
      node("input", {
        type: "range", min: "0", max: "100", step: "5", value: String(volume),
        "data-editor-field": "soundtrack-volume", disabled: !soundtrack,
      }),
      node("output", { class: "editor-music-volume-value", "data-editor-music-percent": "" }, `${volume}%`),
    ),
    button(message("editor.music.listen"), "soundtrack-preview", {
      class: "editor-music-preview", disabled: !soundtrack,
    }),
    node("p", { class: "editor-music-help" }, message("editor.music.privacy")),
  );
}

// Giữ lựa chọn và trạng thái nghe thử khi cập nhật UI; không thay đổi bản nháp.
export function syncMusicPanel(main, soundtrack, { playing = false } = {}) {
  const selectedId = soundtrack?.id || "";
  const track=soundtrackById(selectedId),credit=main.querySelector('[data-music-source]');
  const legacyHint=main.querySelector('[data-music-legacy]');if(legacyHint){legacyHint.hidden=!track||availableTracks().some(item=>item.id===selectedId);setText(legacyHint,message(track?.version>=2?'musicLibrary.disabledPinned':'editor.music.legacyPinned'));}
  if(credit){credit.hidden=!track?.artist;credit.replaceChildren(...(track?.artist?[`${track.originalTitle} — ${track.artist} - ${track.license} - `,node('a',{href:track.sourceUrl,target:'_blank',rel:'noopener noreferrer'},message('editor.music.source'))]:[]));}
  const selectControl = main.querySelector('[data-editor-field="soundtrack"]');
  if (selectControl && selectControl !== document.activeElement) selectControl.value = selectedId;
  for (const control of main.querySelectorAll('[data-editor-action="soundtrack-pick"]')) {
    const selected = control.dataset.trackId === selectedId;
    control.setAttribute("aria-pressed", String(selected));
    control.classList.toggle("is-selected", selected);
  }
  const slider = main.querySelector('[data-editor-field="soundtrack-volume"]');
  const percent = Math.round((soundtrack?.volume ?? 0.55) * 100);
  if (slider) {
    slider.disabled = !selectedId;
    if (slider !== document.activeElement) slider.value = String(percent);
  }
  const readout = main.querySelector("[data-editor-music-percent]");
  if (readout && slider !== document.activeElement) setText(readout, `${percent}%`);
  const preview = main.querySelector('[data-editor-action="soundtrack-preview"]');
  if (preview) {
    preview.disabled = !selectedId;
    setText(preview, message(playing ? "editor.music.stop" : "editor.music.listen"));
  }
}

// Kết hợp bộ lọc cảm xúc và ô tìm kiếm, luôn giữ lựa chọn "không dùng nhạc".
export function filterMusicPanel(main) {
  const filter = main.querySelector("[data-editor-music-filter]");
  const occasion = main.querySelector("[data-editor-music-occasion]");
  const input = main.querySelector("[data-editor-music-search]");
  if (!filter || !input) return 0;
  const tracks = matchingMusicTracks({ mood: filter.value, occasion: occasion?.value || "all", query: input.value,
    market: main.querySelector('[data-editor-music-market]')?.value || 'all', vocals: main.querySelector('[data-editor-music-vocals]')?.value || 'all' });
  const ids = new Set(tracks.map(track => track.id));
  for (const button of main.querySelectorAll('[data-editor-action="soundtrack-pick"]')) {
    button.hidden = Boolean(button.dataset.trackId) && !ids.has(button.dataset.trackId);
  }
  const status = main.querySelector("[data-editor-music-results]");
  if (status) setText(status, message(tracks.length ? "editor.music.results" : "editor.music.empty", { count: tracks.length }));
  return tracks.length;
}
