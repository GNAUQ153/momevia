// Bộ gom sự kiện thành một lượt cập nhật cho mỗi animation frame.
// Thuần JavaScript, không phụ thuộc DOM, có thể unit test độc lập.
export function createLatestFrameScheduler({ requestFrame, cancelFrame, render }) {
  if ([requestFrame, cancelFrame, render].some(callback => typeof callback !== 'function')) {
    throw new TypeError('Animation frame callbacks are required');
  }

  let frame = null;
  let pending = null;
  let generation = 0;
  let disposed = false;

  function enqueue(point) {
    if (disposed || !Number.isFinite(point?.clientX) || !Number.isFinite(point?.clientY)) return false;
    // Sao chép tọa độ, không giữ lại object PointerEvent đã hết vòng đời.
    pending = { clientX: point.clientX, clientY: point.clientY };
    if (frame !== null) return true;
    const current = ++generation;
    frame = requestFrame(() => {
      if (disposed || current !== generation) return;
      frame = null;
      const latest = pending;
      pending = null;
      if (latest) render(latest);
    });
    return true;
  }

  function clear() {
    ++generation;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    pending = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
  }

  return { enqueue, clear, dispose };
}
