/* global document, location, fetch, setInterval */
// Included only in the isolated demo copy, never in the shipped application.
const revision = document.querySelector('script[data-demo-revision]')?.dataset.demoRevision;
let checking = false;
async function check() {
  // Editing/recipient routes require an intentional refresh. Never discard an
  // unsaved Canvas session, a form, an open preview or a hidden browser tab.
  const safePage = ['/', '/explore', '/about', '/pricing', '/for-creators'].includes(location.pathname) || /^\/template\/[^/]+$/.test(location.pathname);
  if (!revision || checking || !safePage || document.hidden || document.querySelector('dialog[open]') ||
    document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
  checking = true;
  try {
    const response = await fetch(`/assets/__demo-revision.json?t=${Date.now()}`, { cache: 'no-store' });
    if (response.ok && (await response.json()).revision !== revision) location.reload();
  } catch { /* The demo may be restarting; retry after it is ready. */ }
  finally { checking = false; }
}
setInterval(check, 1000);
document.addEventListener('visibilitychange', check);
