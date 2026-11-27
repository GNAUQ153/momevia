// Điều khiển hành trình giới thiệu quà: không gọi API và không thay đổi dữ liệu nghiệp vụ.
export const journeySteps = Object.freeze(['create', 'share', 'open', 'reply', 'keep']);

// Chỉ nhận một cử chỉ vuốt ngang có chủ đích; không chiếm thao tác cuộn dọc.
export function journeySwipeDirection(start, end) {
  if (!start || !end || ![start.x, start.y, end.x, end.y].every(Number.isFinite)) return 0;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.4) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function mountJourney(root, { signal } = {}) {
  const host = root?.querySelector?.('[data-mkt-journey]');
  if (!host) return () => {};

  const buttons = [...host.querySelectorAll('[data-mkt-step]')];
  const panels = [...host.querySelectorAll('[data-mkt-panel]')];
  const scene = host.querySelector('[data-mkt-journey-scene]');
  const openPanel = panels.find(panel => panel.dataset.mktPanel === 'open');
  const giftToggle = openPanel?.querySelector?.('[data-mkt-gift-toggle]');
  const giftClosedLabel = giftToggle?.querySelector?.('[data-mkt-gift-label-closed]');
  const giftOpenLabel = giftToggle?.querySelector?.('[data-mkt-gift-label-open]');
  const giftMessage = openPanel?.querySelector?.('[data-mkt-gift-message]');
  let giftOpened = false;
  let activeIndex = 0;
  let touchStart = null;
  const lifetime = new AbortController();
  let disposed = false;

  // Demo chỉ quản lý trạng thái hiển thị, không tạo quà hoặc gọi API.
  function setGiftOpened(opened) {
    giftOpened = opened;
    if (scene) scene.dataset.giftOpen = String(opened);
    giftToggle?.setAttribute('aria-expanded', String(opened));
    // Khi đã mở quà, ưu tiên tạo thiệp; nút replay trở thành hành động phụ.
    giftToggle?.classList.toggle('mkt-primary', !opened);
    giftToggle?.classList.toggle('mkt-secondary', opened);
    if (giftClosedLabel) giftClosedLabel.hidden = opened;
    if (giftOpenLabel) giftOpenLabel.hidden = !opened;
    if (giftMessage) giftMessage.hidden = !opened;
  }

  function activate(step, { focus = false } = {}) {
    if (disposed || !journeySteps.includes(step)) return false;
    const selected = buttons.find(button => button.dataset.mktStep === step);
    if (!selected) return false;

    if (step !== 'open' || journeySteps[activeIndex] !== 'open') setGiftOpened(false);
    activeIndex = journeySteps.indexOf(step);
    for (const button of buttons) {
      const current = button === selected;
      button.setAttribute('aria-pressed', String(current));
      // Một điểm Tab vào nhóm; phím mũi tên vẫn di chuyển giữa các bước.
      button.setAttribute('tabindex', current ? '0' : '-1');
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.mktPanel !== step;
    }
    if (scene) scene.dataset.stage = step;
    if (focus) selected.focus();
    // Keep keyboard and swipe selections visible inside the mobile step strip.
    if (selected.parentElement?.scrollWidth > selected.parentElement?.clientWidth) {
      const strip = selected.parentElement;
      const left = selected.offsetLeft - strip.offsetLeft;
      if (left < strip.scrollLeft) strip.scrollLeft = left;
      else if (left + selected.offsetWidth > strip.scrollLeft + strip.clientWidth) {
        strip.scrollLeft = left + selected.offsetWidth - strip.clientWidth;
      }
    }
    return true;
  }

  function onClick(event) {
    if (disposed) return;
    const toggle = event.target.closest?.('[data-mkt-gift-toggle]');
    if (giftToggle && toggle === giftToggle) {
      if (journeySteps[activeIndex] === 'open') setGiftOpened(!giftOpened);
      return;
    }
    const button = event.target.closest?.('[data-mkt-step]');
    if (button && host.contains(button)) activate(button.dataset.mktStep);
  }

  function onKeydown(event) {
    if (disposed || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const button = event.target.closest?.('[data-mkt-step]');
    if (!button || !host.contains(button)) return;
    const current = journeySteps.indexOf(button.dataset.mktStep);
    if (current === -1) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? journeySteps.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + journeySteps.length) % journeySteps.length;
    event.preventDefault();
    activate(journeySteps[next], { focus: true });
  }

  function onTouchStart(event) {
    // Cử chỉ nhiều ngón không được phép làm thay đổi bước giới thiệu.
    touchStart = event.touches?.length === 1
      ? { id: event.touches[0].identifier, x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  }

  function onTouchEnd(event) {
    if (!touchStart || disposed) return;
    const start = touchStart;
    touchStart = null;
    const touch = [...(event.changedTouches || [])].find(item => item.identifier === start.id);
    if (!touch || event.touches?.length) return;
    const direction = journeySwipeDirection(start, { x: touch.clientX, y: touch.clientY });
    if (!direction) return;
    // Không quay vòng tự động ở hai đầu, để nội dung không bất ngờ nhảy ngược.
    const nextIndex = Math.max(0, Math.min(journeySteps.length - 1, activeIndex + direction));
    if (nextIndex === activeIndex) return;
    // activate chỉ cuộn rail ngang; không kéo viewport dọc theo nút.
    activate(journeySteps[nextIndex]);
  }

  function onTouchCancel() {
    touchStart = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    touchStart = null;
    signal?.removeEventListener?.('abort', dispose);
  }

  host.addEventListener('click', onClick, { signal: lifetime.signal });
  host.addEventListener('keydown', onKeydown, { signal: lifetime.signal });
  // Cử chỉ gắn riêng cho artwork, không chặn click hoặc scroll của trang.
  scene?.addEventListener?.('touchstart', onTouchStart, { signal: lifetime.signal, passive: true });
  scene?.addEventListener?.('touchend', onTouchEnd, { signal: lifetime.signal, passive: true });
  scene?.addEventListener?.('touchcancel', onTouchCancel, { signal: lifetime.signal, passive: true });
  activate('create');
  if (signal?.aborted) dispose();
  else signal?.addEventListener?.('abort', dispose, { once: true });
  return dispose;
}
