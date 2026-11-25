// Editor feedback only: stored scene effects and recipient playback stay untouched.
export function createEditorSceneMotion(artboard, { signal, preference }) {
  let previous = null, animation = null;
  const cancel = () => { animation?.cancel(); animation = null; };
  signal.addEventListener('abort', cancel, { once: true });
  preference.addEventListener('change', () => { if (preference.matches) cancel(); }, { signal });
  return {
    sync(sceneId) {
      if (sceneId === previous) return;
      const initial = previous === null;
      previous = sceneId;
      cancel();
      if (initial || signal.aborted || preference.matches || !artboard.animate) return;
      const active = artboard.animate([{ opacity: .6 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      animation = active;
      active.finished.then(() => {
        if (animation === active) cancel();
      }, () => {});
    },
  };
}
