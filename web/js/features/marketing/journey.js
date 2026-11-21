// Điều khiển hành trình giới thiệu quà: không gọi API và không thay đổi dữ liệu nghiệp vụ.
export const journeySteps = Object.freeze(['create', 'share', 'open', 'reply', 'keep']);

export function mountJourney(root, { signal } = {}) {
  const host = root?.querySelector?.('[data-mkt-journey]');
  if (!host) return () => {};

  const buttons = [...host.querySelectorAll('[data-mkt-step]')];
  const panels = [...host.querySelectorAll('[data-mkt-panel]')];
  const scene = host.querySelector('[data-mkt-journey-scene]');
  const lifetime = new AbortController();
  let disposed = false;

  function activate(step, { focus = false } = {}) {
    if (!journeySteps.includes(step)) return false;
    const selected = buttons.find(button => button.dataset.mktStep === step);
    if (!selected) return false;

    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button === selected));
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.mktPanel !== step;
    }
    if (scene) scene.dataset.stage = step;
    if (focus) selected.focus();
    return true;
  }

  function onClick(event) {
    const button = event.target.closest?.('[data-mkt-step]');
    if (button && host.contains(button)) activate(button.dataset.mktStep);
  }

  function onKeydown(event) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const button = event.target.closest?.('[data-mkt-step]');
    if (!button || !host.contains(button)) return;
    const current = journeySteps.indexOf(button.dataset.mktStep);
    if (current === -1) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? journeySteps.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + journeySteps.length) % journeySteps.length;
    event.preventDefault();
    activate(journeySteps[next], { focus: true });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    signal?.removeEventListener?.('abort', dispose);
  }

  host.addEventListener('click', onClick, { signal: lifetime.signal });
  host.addEventListener('keydown', onKeydown, { signal: lifetime.signal });
  activate('create');
  if (signal?.aborted) dispose();
  else signal?.addEventListener?.('abort', dispose, { once: true });
  return dispose;
}
