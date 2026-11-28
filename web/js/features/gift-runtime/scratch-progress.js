import { scratchPercent, finishScratchOnRelease } from '../../shared/canvas/scratch-progress.js';

export function mountProgressScratch({ root, scratch, cover, message, bypass, color, signal, motion, tactile=false,keepControl=false,onReveal }) {
  root.classList.add('gift-runtime-scratch-progress');
  // Reserve the message height before the first stroke so the surface never jumps.
  message.hidden = false; message.setAttribute('aria-hidden', 'true');
  const brush = scratch.getContext('2d'), mask = document.createElement('canvas');
  const coverage = mask.getContext('2d', { willReadFrequently: true });
  const strokes = [];
  let pointer, stroke, open = false, percent = 0, frame = 0, measured = 0, cssWidth = 0, cssHeight = 0;
  const listen = (event, handle) => scratch.addEventListener(event, handle, { signal });
  const report = value => { percent = value; };
  const sample = () => {
    if (!mask.width || !mask.height) return;
    report(scratchPercent(coverage.getImageData(0, 0, mask.width, mask.height).data));
  };
  const segment = (context, canvas, previous, point, radius) => {
    context.globalCompositeOperation = 'destination-out';
    context.lineWidth = radius * canvas.width;
    context.lineCap = context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(previous[0] * canvas.width, previous[1] * canvas.height);
    context.lineTo(point[0] * canvas.width + .01, point[1] * canvas.height);
    context.stroke();
  };
  const paintStroke = saved => {
    for (let i = 0; i < saved.points.length; i++) {
      const point = saved.points[i], previous = saved.points[Math.max(0, i - 1)];
      segment(brush, scratch, previous, point, saved.radius);
      segment(coverage, mask, previous, point, saved.radius);
    }
  };
  const resize = () => {
    if (open || signal.aborted) return;
    const rect = scratch.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || (rect.width === cssWidth && rect.height === cssHeight)) return;
    cssWidth = rect.width; cssHeight = rect.height;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    scratch.width = Math.max(1, Math.round(cssWidth * ratio)); scratch.height = Math.max(1, Math.round(cssHeight * ratio));
    mask.width = 160; mask.height = Math.max(1, Math.round(160 * cssHeight / cssWidth));
    const foil = brush.createLinearGradient(0, 0, scratch.width, scratch.height);
    foil.addColorStop(0, '#92734E'); foil.addColorStop(.5, color); foil.addColorStop(1, '#92734E');
    brush.globalCompositeOperation = 'source-over'; brush.fillStyle = foil; brush.fillRect(0, 0, scratch.width, scratch.height);
    if(tactile){brush.strokeStyle='#FFFFFF35';brush.lineWidth=1;for(let y=3;y<scratch.height;y+=6){brush.beginPath();brush.moveTo(0,y);brush.lineTo(scratch.width,y-14);brush.stroke();}}
    coverage.globalCompositeOperation = 'source-over'; coverage.fillStyle = '#000'; coverage.fillRect(0, 0, mask.width, mask.height);
    strokes.forEach(paintStroke); sample();
  };
  const queueSample = () => {
    if (frame) return;
    const tick = time => {
      frame = 0;
      if (open || signal.aborted) return;
      if (time - measured < 80) { frame = requestAnimationFrame(tick); return; }
      measured = time; sample();
    };
    frame = requestAnimationFrame(tick);
  };
  const draw = event => {
    const rect = scratch.getBoundingClientRect();
    if (!rect.width || !rect.height || !stroke) return;
    const events = event.getCoalescedEvents?.() || [];
    for (const next of [...events, event]) {
      const point = [Math.max(0, Math.min(1, (next.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (next.clientY - rect.top) / rect.height))];
      const previous = stroke.points.at(-1) || point;
      segment(brush, scratch, previous, point, stroke.radius);
      segment(coverage, mask, previous, point, stroke.radius);
      stroke.points.push(point);
    }
    queueSample();
  };
  const finish = () => {
    if (open || signal.aborted) return;
    open = true; pointer = undefined; stroke = null; cancelAnimationFrame(frame); frame = 0;
    report(100); bypass.setAttribute('aria-disabled', 'true');
    const reveal = () => {
      if (signal.aborted) return;
      scratch.hidden = cover.hidden = true; message.hidden = false; message.removeAttribute('aria-hidden');
      if (document.activeElement === bypass) { message.tabIndex = -1; message.focus({ preventScroll: true }); }
      bypass.hidden = !keepControl;onReveal?.();
    };
    if (motion?.enabled()) void motion.run(scratch, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }, signal).then(reveal);
    else reveal();
  };
  listen('pointerdown', event => {
    if (event.button !== 0 || open || pointer !== undefined) return;
    event.preventDefault(); resize(); pointer = event.pointerId;
    scratch.setPointerCapture(pointer); stroke = { points: [], radius: 34 / cssWidth }; strokes.push(stroke);
    cover.classList.add('is-scratching'); message.hidden = false; message.setAttribute('aria-hidden', 'true'); draw(event);
  });
  listen('pointermove', event => { if (event.pointerId === pointer && !open) draw(event); });
  listen('pointerup', event => {
    if (event.pointerId !== pointer || open) return;
    draw(event); cancelAnimationFrame(frame); frame = 0; sample();
    pointer = undefined; stroke = null;
    if (finishScratchOnRelease(percent)) finish();
  });
  for (const event of ['pointercancel', 'lostpointercapture']) listen(event, e => {
    if (e.pointerId === pointer) { pointer = undefined; stroke = null; sample(); }
  });
  const observer = globalThis.ResizeObserver ? new ResizeObserver(resize) : null;
  observer?.observe(scratch);
  signal.addEventListener('abort', () => { observer?.disconnect(); cancelAnimationFrame(frame); pointer = undefined; stroke = null; }, { once: true });
  resize();
  return { reveal: finish };
}
