// Giữ hành vi liên kết gốc nếu người dùng mở tab mới hoặc dùng phím bổ trợ.
export function skipToMain(event, main) {
  if (!main?.isConnected || main.inert || event.defaultPrevented || event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  event.preventDefault();
  main.focus({ preventScroll: true });
  main.scrollIntoView({ block: 'start', behavior: 'instant' });
  return true;
}

// Lưu trạng thái inert ban đầu, kể cả khi nội dung modal được thay thế.
export function createModalIsolation(getRegions) {
  let previous = null;
  return {
    activate() {
      if (previous) return;
      previous = new Map(getRegions().filter(Boolean).map(node => [node, node.inert]));
      for (const node of previous.keys()) node.inert = true;
    },
    restore() {
      if (!previous) return;
      for (const [node, inert] of previous) node.inert = inert;
      previous = null;
    },
  };
}
