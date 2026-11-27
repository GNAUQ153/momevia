const position = (x, y, scale = 1) => `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
const ease = value => 1 - (1 - value) ** 3;

// Pointer coordinates stay in viewport space, independent of the tour's scroll.
// Touch and keyboard-only visits use an anchor until a mouse/pen position is known.
export function trackConstructionPointer(view, signal) {
  let point;
  const remember = event => {
    if (event.pointerType && !['mouse', 'pen'].includes(event.pointerType)) return;
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) point = { x: event.clientX, y: event.clientY };
  };
  for (const name of ['pointermove', 'pointerover', 'pointerdown']) {
    view.addEventListener(name, remember, { signal, passive: true });
  }
  return () => ({
    x: Math.max(0, Math.min(view.innerWidth - 1, point?.x ?? view.innerWidth / 2)),
    y: Math.max(0, Math.min(view.innerHeight - 1, point?.y ?? view.innerHeight * 0.3)),
  });
}

// Animate only cursor transforms/opacity. A moving pointer is sampled each frame
// during reunion, so the workers converge on the user's current position.
export function handoffConstructionCursors({ view, workers, pointer, signal, running, mode, duration = 550 }) {
  if (signal.aborted || !running()) return Promise.resolve(false);
  const origin = pointer();
  const starts = workers.map(worker => mode === 'split' ? origin : { x: worker.x, y: worker.y });
  const destinations = workers.map((_, index) => {
    const angle = index * 2.3999632297;
    const radius = 40 + Math.sqrt((index + 1) / workers.length) * Math.min(90, view.innerWidth * 0.18);
    return {
      x: Math.max(12, Math.min(view.innerWidth - 24, origin.x + Math.cos(angle) * radius)),
      y: Math.max(12, Math.min(view.innerHeight - 24, origin.y + Math.sin(angle) * radius)),
    };
  });
  for (const [index, worker] of workers.entries()) {
    Object.assign(worker, starts[index]);
    worker.cursor.style.transform = position(worker.x, worker.y, mode === 'split' ? 0.65 : 1);
    worker.cursor.style.opacity = mode === 'split' ? '0' : '1';
  }
  return new Promise(resolve => {
    let frame = null, started = null, settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      signal.removeEventListener('abort', cancel);
      resolve(result);
    };
    const cancel = () => finish(false);
    const tick = now => {
      frame = null;
      if (!running() || signal.aborted) { finish(false); return; }
      started ??= now;
      const progress = Math.min((now - started) / duration, 1), travel = ease(progress);
      const destination = pointer();
      for (const [index, worker] of workers.entries()) {
        const from = starts[index], to = mode === 'split' ? destinations[index] : destination;
        const bend = Math.sin(Math.PI * travel) * Math.min(24, Math.hypot(to.x - from.x, to.y - from.y) * 0.07);
        const direction = index % 2 ? 1 : -1;
        worker.x = from.x + (to.x - from.x) * travel + bend * direction;
        worker.y = from.y + (to.y - from.y) * travel;
        const fade = mode === 'split' ? Math.min(1, progress * 5) : 1 - ease(Math.max(0, (progress - 0.78) / 0.22));
        const scale = mode === 'split' ? 0.65 + 0.35 * travel : 1 - 0.65 * (1 - fade);
        worker.cursor.style.transform = position(worker.x, worker.y, scale);
        worker.cursor.style.opacity = String(fade);
      }
      if (progress === 1) finish(true);
      else frame = view.requestAnimationFrame(tick);
    };
    signal.addEventListener('abort', cancel, { once: true });
    frame = view.requestAnimationFrame(tick);
  });
}
