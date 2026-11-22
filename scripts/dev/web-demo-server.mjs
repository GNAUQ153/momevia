import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { demoStorage } from './web-demo-config.mjs';

// Load after a stopped-writer cutover even when an older watch launcher is alive.
Object.assign(process.env, demoStorage(path.resolve('..')).env);

// Run code from the isolated profile, not from the developer's live data.
const { createHttpApp } = await import(pathToFileURL(path.resolve('src/server/app.mjs')));
const app = await createHttpApp(undefined, { staticOptions: { cacheControl: 'no-store' } });
const server = app.listen(Number(process.env.PORT), '127.0.0.1');
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    try { await app.close(); process.exit(0); }
    catch (error) { console.error(error); process.exit(1); }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('message', message => { if (message === 'demo-stop') stop(); });
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
