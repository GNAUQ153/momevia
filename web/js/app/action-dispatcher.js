// Chỉ điều phối các action đã đăng ký; lỗi handler được trả về listener hiện tại.
export function createActionDispatcher(...groups) {
  const handlers = new Map();
  for (const group of groups) {
    for (const [names, handler] of group) {
      for (const name of names) {
        if (handlers.has(name)) throw new Error(`Duplicate action: ${name}`);
        handlers.set(name, handler);
      }
    }
  }
  return async function dispatch(action, element) {
    return handlers.get(action)?.(action, element);
  };
}
