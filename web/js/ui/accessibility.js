import { createInertLock } from './inert-lock.js';

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
  let release = null;
  return {
    activate() {
      if (release) return;
      const controls = [...new Set(getRegions().filter(Boolean))].map(createInertLock);
      for (const setInert of controls) setInert(true);
      release = () => {
        for (const setInert of controls) setInert(false);
      };
    },
    restore() {
      if (!release) return;
      release();
      release = null;
    },
  };
}
