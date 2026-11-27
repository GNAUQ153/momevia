const locks = new WeakMap();

// Mỗi bên chỉ được nhả khóa của mình; giữ trạng thái ban đầu đến khi hết khóa.
export function createInertLock(node) {
  let held = false;
  return active => {
    if (active === held) return;
    held = active;
    if (active) {
      const state = locks.get(node) ?? { count: 0, original: node.inert };
      state.count++;
      locks.set(node, state);
      node.inert = true;
    } else {
      const state = locks.get(node);
      state.count--;
      if (state.count === 0) {
        node.inert = state.original;
        locks.delete(node);
      }
    }
  };
}
