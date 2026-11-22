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
  let failed = false;
  const publish = () => onState({ playing, error: failed });

  // Đồng bộ nút phát khi trình duyệt hoặc thiết bị tạm dừng nhạc bên ngoài UI.
  function onAudioPause() {
    if (disposed || (!playing && !pending)) return;
    version++;
    pending = false;
    playing = false;
    failed = false;
    publish();
  }

  // Có thể phát lỗi sau khi play() đã resolve: không giữ nút ở trạng thái Đang phát.
  function onAudioError() {
    if (disposed || failed) return;
    version++;
    pending = false;
    playing = false;
    failed = true;
    audio.pause();
    publish();
  }

  audio.addEventListener?.("pause", onAudioPause);
  audio.addEventListener?.("ended", onAudioPause);
  audio.addEventListener?.("error", onAudioError);

  function pause() {
    if (disposed) return;
    version++;
    pending = false;
    playing = false;
    failed = false;
    audio.pause();
    publish();
  }

  async function toggle() {
    if (disposed) return false;
    if (playing || pending) {
      pause();
      return false;
    }
    const intent = ++version;
    pending = true;
    failed = false;
    try {
      await audio.play();
      if (disposed || intent !== version) {
        // Promise phát có thể hoàn thành muộn sau khi pause/đóng trình phát.
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
        failed = true;
        publish();
      }
      return false;
    }
  }

  return {
    track,
    toggle,
    pause,
    // Âm lượng của người nghe chỉ tồn tại trong phiên; không ghi lại Canvas JSON.
    setVolume(value) {
      if (disposed || !Number.isFinite(value) || value < 0 || value > 1) return false;
      audio.volume = value;
      return true;
    },
    get volume() { return audio.volume; },
    get playing() { return playing; },
    dispose() {
      if (disposed) return;
      disposed = true;
      version++;
      audio.removeEventListener?.("pause", onAudioPause);
      audio.removeEventListener?.("ended", onAudioPause);
      audio.removeEventListener?.("error", onAudioError);
      audio.pause();
      audio.removeAttribute?.("src");
      audio.load?.();
      playing = false;
      pending = false;
    },
  };
}
