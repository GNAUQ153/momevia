import { createHmac, timingSafeEqual } from 'node:crypto';
import { localizedError, parseJson, sendJson } from '../../shared/http.mjs';
import { sessionToken } from '../../shared/security.mjs';

export const sessionInventoryLimit = 50;

// Tham chiếu hành động không phải JWT/JTI, được ràng buộc với phiên yêu cầu.
export function sessionActionRef(claims, targetId, secret) {
  return createHmac('sha256', secret).update(JSON.stringify(['session-revoke-v1', claims.sub, claims.jti, claims.cv || 0, targetId])).digest('hex');
}
export function validSessionRef(ref) {
  return typeof ref === 'string' && ref.length === 64 && /^[a-f0-9]{64}$/.test(ref);
}
export function findRevocationTarget(rows, claims, ref, secret) {
  if (!validSessionRef(ref)) return null;
  const supplied = Buffer.from(ref, 'hex');
  return rows.find(row => row.id !== claims.jti && timingSafeEqual(supplied, Buffer.from(sessionActionRef(claims, row.id, secret), 'hex'))) ?? null;
}

export function inventoryResult(rows, claims, unclassifiedCount, secret) {
  const currentId = claims.jti;
  if (!rows.some(row => row.id === currentId)) return null;
  return {
    sessions: rows.slice(0, sessionInventoryLimit).map(row => ({
      current: row.id === currentId, issuedAt: row.issuedAt ?? null, expiresAt: row.expiresAt,
      ...(row.id !== currentId ? { revokeRef: sessionActionRef(claims, row.id, secret) } : {}),
    })),
    truncated: rows.length > sessionInventoryLimit,
    unclassifiedCount,
  };
}

export function registerSessionInventoryRoute(router, sessions) {
  router.on('GET', '/sessions', async ({ req, res }) => {
    const result = await sessions.listActive(sessionToken(req));
    if (!result) throw localizedError(401, 'errors.unauthorized');
    sendJson(res, 200, result);
  });
}

export function registerSessionRevocationRoute(router, sessions, authLimits) {
  router.on('POST', '/sessions/revoke', async ({ req, res }) => {
    authLimits.consume('session', req, res);
    const body = await parseJson(req, 1024);
    if (body.confirm !== true || !validSessionRef(body.ref)) throw localizedError(400, 'errors.validation');
    const result = await sessions.revokeOne(sessionToken(req), body.ref);
    if (result === null) throw localizedError(401, 'errors.unauthorized');
    if (result !== true) throw localizedError(404, 'accountSessions.unavailable');
    sendJson(res, 200, { ok: true });
  });
}
