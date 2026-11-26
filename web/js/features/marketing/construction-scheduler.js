export function constructionTargetInViewport(rect, viewport) {
  return rect.width > 0 && rect.height > 0 && rect.bottom > (viewport.top || 0) &&
    rect.top < viewport.height && rect.right > 0 && rect.left < viewport.width;
}

// A single live queue serves the whole viewport, regardless of section boundaries.
export function createConstructionScheduler({
  targets, workerCount = 15, available = () => true, visible = () => true,
  group = () => null, build, idle = () => {}, advance,
  pendingContent = () => false, complete, running,
}) {
  const completed = new Set();
  const skipped = new Set();
  const active = new Map();
  const free = Array.from({ length: workerCount }, (_, index) => index);
  const issued = new Map();
  let revision = 0, wake = null, moving = false, failure = null, stalledAt = null;

  function notify({ keepStalled = false } = {}) {
    if (!keepStalled) stalledAt = null;
    revision++;
    wake?.();
    wake = null;
  }

  function dispatch(target, worker) {
    const region = group(target);
    issued.set(region, (issued.get(region) || 0) + 1);
    const task = Promise.resolve().then(() => { if (running()) return build(target, worker); })
      .catch(error => { failure = error; }).finally(() => {
        completed.add(target);
        active.delete(worker);
        free.unshift(worker);
        notify();
      });
    active.set(worker, { target, task, region });
  }

  async function run() {
    while (running()) {
      if (failure) throw failure;
      const before = revision;
      const all = [...new Set(targets())];
      for (const target of skipped) {
        if (all.includes(target) && available(target)) { completed.delete(target); skipped.delete(target); }
      }
      const assigned = new Set([...active.values()].map(job => job.target));
      const unfinished = all.filter(target => !completed.has(target));
      const queued = unfinished.filter(target => !assigned.has(target));
      const shown = new Set();
      const ready = [];
      for (const target of queued) {
        if (!available(target)) { completed.add(target); skipped.add(target); continue; }
        if (!visible(target)) continue;
        shown.add(target);
        if (!unfinished.some(parent => parent !== target && !completed.has(parent) && parent.contains?.(target))) ready.push(target);
      }

      while (running() && free.length && ready.length) {
        const loads = new Map();
        for (const job of active.values()) loads.set(job.region, (loads.get(job.region) || 0) + 1);
        let next = 0;
        for (let index = 1; index < ready.length; index++) {
          const candidate = group(ready[index]), chosen = group(ready[next]);
          const load = loads.get(candidate) || 0, chosenLoad = loads.get(chosen) || 0;
          if (load < chosenLoad || (load === chosenLoad && (issued.get(candidate) || 0) < (issued.get(chosen) || 0))) next = index;
        }
        const [target] = ready.splice(next, 1);
        shown.delete(target);
        dispatch(target, free.shift());
      }

      for (const worker of free) idle(worker);
      const remaining = queued.filter(target => !completed.has(target) && ![...active.values()].some(job => job.target === target));
      // Reveal more page while existing jobs finish, rather than waiting for a whole section.
      if (free.length && !shown.size && !moving && advance && remaining.length && remaining[0] !== stalledAt) {
        moving = true;
        const nextTarget = remaining[0];
        void Promise.resolve().then(() => advance(nextTarget, [...active.values()].map(job => job.target)))
          .then(moved => { if (moved === false) stalledAt = nextTarget; })
          .catch(error => { failure = error; }).finally(() => { moving = false; notify({ keepStalled: true }); });
      }
      if (!remaining.length && !active.size && !moving && !pendingContent()) {
        if (!running()) return false;
        await complete();
        return true;
      }
      if (revision === before) await new Promise(resolve => { wake = resolve; });
    }
    return false;
  }

  return { run, notify };
}
