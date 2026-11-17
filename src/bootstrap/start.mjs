import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadEnvironment, validateSecrets } from '../shared/config.mjs';

// Một tiến trình Node.js cho API và các module nghiệp vụ.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
loadEnvironment();
if (process.env.NODE_ENV !== 'production') {
  for (const name of ['JWT_SECRET', 'INTERNAL_SERVICE_KEY']) {
    process.env[name] ||= randomBytes(32).toString('hex');
  }
}
validateSecrets(process.env);

const { createHttpApp } = await import('../server/app.mjs');
const app = await createHttpApp();
const port = Number(process.env.PORT || 4100);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    try { await app.close(); process.exit(0); }
    catch (error) { console.error(error); process.exit(1); }
  });
  // Không giữ tiến trình vô hạn nếu có kết nối treo khi tắt.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
