const key = 'momevia:auth-return';
const idPattern = /^[a-z0-9_-]{1,128}$/i;
let memory;

export function authDestination(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || /^\/[/\\]/.test(path) || /[\\\u0000-\u0020]/.test(path)) return null;
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin || url.pathname !== path.split(/[?#]/, 1)[0]) return null;
  if (url.pathname === '/account-sessions') return url.search || url.hash ? null : path;
  const allowed = /^(?:\/|\/(?:explore|pricing|favorites|studio|creator|privacy-center)|\/(?:create|design|template|success|payment-result)\/[a-z0-9_-]{1,128})$/i;
  if (!allowed.test(url.pathname)) return null;

  const keys = /^\/(create|design)\//.test(url.pathname)
    ? { mode: /^(quick|layout)$/, version: idPattern }
    : url.pathname === '/explore'
      ? { q: /^[^\u0000-\u001f]{0,160}$/, style: /^[\p{L}\p{M} \-]{1,60}$/u, free: /^1$/, photo: /^1$/, page: /^\d{1,6}$/ }
      : {};
  for (const [name, value] of url.searchParams) {
    if (!Object.hasOwn(keys, name) || !keys[name].test(value) || url.searchParams.getAll(name).length !== 1) return null;
  }
  if (url.hash && (url.pathname !== '/' || !/^#[a-z][a-z0-9-]{0,59}$/i.test(url.hash))) return null;
  return path;
}

export function rememberAuthReturn(path, favoriteId) {
  memory = { path: authDestination(path) || '/studio', favoriteId: idPattern.test(favoriteId || '') ? favoriteId : null };
  try { sessionStorage.setItem(key, JSON.stringify(memory)); } catch { /* In-memory fallback for the current page. */ }
}

export function clearAuthReturn() {
  memory = undefined;
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

export function takeAuthReturn() {
  let saved = memory;
  if (!saved) {
    try { saved = JSON.parse(sessionStorage.getItem(key)); } catch { /* Optional storage. */ }
  }
  clearAuthReturn();
  const path = authDestination(saved?.path);
  return path ? { path, favoriteId: typeof saved.favoriteId === 'string' && idPattern.test(saved.favoriteId) ? saved.favoriteId : null } : null;
}
