// Document commands are independent of DOM, network and editor view state.
export function createEditorStore(design, { historyLimit = 60 } = {}) {
  let value = structuredClone({
    title: design.title,
    document: design.document,
  });
  let sequence = 0;
  let mergeKey = null;
  const undo = [],
    redo = [],
    listeners = new Set();
  const emit = (kind, label) => {
    sequence++;
    for (const fn of listeners) fn({ kind, label, sequence });
  };
  function replace(
    next,
    label = "Chỉnh sửa",
    { record = true, merge = null } = {},
  ) {
    if (JSON.stringify(next) === JSON.stringify(value)) return false;
    if (record) {
      if (!merge || merge !== mergeKey) {
        undo.push(structuredClone(value));
        if (undo.length > historyLimit) undo.shift();
      }
      // Mọi chỉnh sửa mới đều tạo một nhánh lịch sử mới, kể cả khi đang gộp.
      redo.length = 0;
    } else {
      // Đồng bộ lại bản authoritative: tuyệt đối không Undo về snapshot cũ.
      undo.length = 0;
      redo.length = 0;
    }
    mergeKey = record ? merge : null;
    value = structuredClone(next);
    emit("change", label);
    return true;
  }
  return {
    get: () => value,
    get sequence() {
      return sequence;
    },
    update(mutate, label, options) {
      const next = structuredClone(value);
      mutate(next);
      return replace(next, label, options);
    },
    replace,
    endMerge() {
      mergeKey = null;
    },
    undo() {
      if (!undo.length) return false;
      mergeKey = null;
      redo.push(structuredClone(value));
      value = undo.pop();
      emit("undo");
      return true;
    },
    redo() {
      if (!redo.length) return false;
      mergeKey = null;
      undo.push(structuredClone(value));
      value = redo.pop();
      emit("redo");
      return true;
    },
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function logicalPoint(client, rect, baseSize) {
  return {
    x: ((client.x - rect.left) * baseSize.width) / rect.width,
    y: ((client.y - rect.top) * baseSize.height) / rect.height,
  };
}

export function gestureLayout(
  original,
  start,
  current,
  mode = "move",
  { keepAspect = false } = {},
) {
  const dx = current.x - start.x,
    dy = current.y - start.y;
  if (mode === "move")
    return { ...original, x: original.x + dx, y: original.y + dy };
  let width = Math.max(24, original.width + dx),
    height = Math.max(24, original.height + dy);
  if (keepAspect) {
    height = (width * original.height) / original.width;
    width = Math.max(24, width);
  }
  return { ...original, width, height };
}

export function snapLayout(layout, baseSize, tolerance = 6) {
  const next = { ...layout },
    guides = { x: null, y: null };
  for (const [axis, size, dimension] of [
    ["x", "width", "width"],
    ["y", "height", "height"],
  ]) {
    const candidates = [
      0,
      (baseSize[size] - layout[dimension]) / 2,
      baseSize[size] - layout[dimension],
    ];
    const nearest = candidates.reduce((a, b) =>
      Math.abs(layout[axis] - a) <= Math.abs(layout[axis] - b) ? a : b,
    );
    if (Math.abs(layout[axis] - nearest) <= tolerance) {
      next[axis] = nearest;
      guides[axis] =
        nearest === 0
          ? 0
          : nearest === candidates[1]
            ? baseSize[size] / 2
            : baseSize[size];
    }
  }
  return { layout: next, guides };
}
