import { createHash } from 'node:crypto';
import { canonicalStringify } from '../../../web/js/shared/canvas/index.js';

// Dùng chung fingerprint cho revision, phiên bản mẫu và idempotency.
export const hash = value => `sha256:${createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
