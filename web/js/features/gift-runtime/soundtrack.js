import { soundtrackById } from "../../shared/canvas/soundtracks.js";

// Bộ phát chỉ tạo nguồn thuộc danh mục nội bộ. Không autoplay khi mở thiệp.
export function createSoundtrackPlayback(config, { createAudio = () => new Audio(), onState = () => {} } = {}) {
  const track = soundtrackById(config?.id);
  if (!track) return null;
  const audio = createAudio();
  audio.preload = "none";
  audio.src = track.src;
  audio.loop = true;
  audio.volume = config.volume;
  let disposed = false;
  let version = 0;
  let playing = false;
  let pending = false;
  const publish = (error = false) => onState({ playing, error });
  function pause() {
    version++;
    audio.pause();
    playing = false;
    pending = false;
    if (!disposed) publish();
  }
  async function toggle() {
    if (disposed) return false;
    if (playing || pending) { pause(); return false; }
    const intent = ++version;
    pending = true;
    try {
      await audio.play();
      if (disposed || intent !== version) {
        if (disposed || (!pending && !playing)) audio.pause();
        return false;
      }
      pending = false;
      playing = true;
      publish();
      return true;
    } catch {
      if (!disposed && intent === version) {
        pending = false;
        playing = false;
        publish(true);
      }
      return false;
    }
  }
  return {
    track,
    toggle,
    pause,
    get playing() { return playing; },
    dispose() {
      if (disposed) return;
      disposed = true;
      version++;
      audio.pause();
      audio.removeAttribute?.("src");
      audio.load?.();
      playing = false;
      pending = false;
    },
  };
}
