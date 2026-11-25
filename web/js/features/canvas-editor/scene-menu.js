export function sceneMenuPlacement(anchor, menu, viewport) {
  const margin = 12, gap = 8;
  const width = Math.min(menu.width, Math.max(0, viewport.width - margin * 2));
  const maxHeight = Math.max(0, viewport.height - margin * 2);
  const height = Math.min(menu.height, maxHeight);
  const left = Math.max(margin, Math.min(anchor.right - width, viewport.width - width - margin));
  const above = anchor.top - height - gap;
  const top = above >= margin ? above : Math.max(margin, Math.min(anchor.bottom + gap, viewport.height - height - margin));
  return { left, top, maxHeight };
}

export function mountSceneMenus(main, { signal }) {
  const owner = main.ownerDocument;
  const view = owner.defaultView;
  const close = (menu, restore = false) => {
    menu.open = false;
    if (restore) menu.querySelector('summary').focus({ preventScroll: true });
  };
  const closeAll = () => {
    for (const menu of main.querySelectorAll('.editor-scene-menu[open]')) close(menu);
  };
  main.addEventListener('toggle', event => {
    const menu = event.target;
    if (!menu.matches?.('.editor-scene-menu') || !menu.open) return;
    for (const other of main.querySelectorAll('.editor-scene-menu[open]')) if (other !== menu) close(other);
    const panel = menu.querySelector('.editor-scene-menu-actions');
    const position = sceneMenuPlacement(menu.querySelector('summary').getBoundingClientRect(), panel.getBoundingClientRect(), {
      width: owner.documentElement.clientWidth, height: owner.documentElement.clientHeight,
    });
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.style.maxHeight = `${position.maxHeight}px`;
  }, { signal, capture: true });
  owner.addEventListener('pointerdown', event => {
    for (const menu of main.querySelectorAll('.editor-scene-menu[open]')) if (!menu.contains(event.target)) close(menu);
  }, { signal, capture: true });
  main.addEventListener('click', event => {
    const control = event.target.closest('[data-editor-action]');
    const menu = control?.closest('.editor-scene-menu[open]');
    if (menu) close(menu, true);
  }, { signal, capture: true });
  main.addEventListener('focusin', event => {
    for (const menu of main.querySelectorAll('.editor-scene-menu[open]')) if (!menu.contains(event.target)) close(menu);
  }, { signal });
  owner.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = main.querySelector('.editor-scene-menu[open]');
    if (!menu) return;
    event.preventDefault();
    event.stopPropagation();
    close(menu, true);
  }, { signal, capture: true });
  main.addEventListener('scroll', event => {
    if (!event.target.closest?.('.editor-scene-menu-actions')) closeAll();
  }, { signal, capture: true });
  view.addEventListener('resize', closeAll, { signal });
  signal.addEventListener('abort', closeAll, { once: true });
}
