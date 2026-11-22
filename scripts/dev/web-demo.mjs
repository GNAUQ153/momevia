import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { seedWebDemo } from './web-demo-fixture.mjs';
import { demoStorage } from './web-demo-config.mjs';
import { parseAllowedOrigins } from '../../src/shared/request-origin.mjs';
import { publishDemoRevision, syncWebDemo, watchWebDemo } from './web-demo-sync.mjs';

const { values } = parseArgs({ options: {
  port: { type: 'string', default: '4110' },
  prepare: { type: 'boolean', default: false },
  'no-watch': { type: 'boolean', default: false },
  'allowed-origin': { type: 'string', multiple: true, default: [] },
} });
const port = Number(values.port);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Chọn cổng loopback từ 1024 đến 65535.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const demoDir = path.join(root, 'local', `web-demo-${port}`);
const appDir = path.join(demoDir, 'app');
const base = `http://127.0.0.1:${port}`;
const allowedOrigins = parseAllowedOrigins([process.env.ALLOWED_ORIGINS || '', ...values['allowed-origin']].join(','));
const writeJson = (name, value) => fs.writeFileSync(path.join(demoDir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const readJson = file => JSON.parse(fs.readFileSync(path.join(demoDir, file), 'utf8'));
const prepared = fs.existsSync(path.join(demoDir, 'trang-thai-demo.json'));
const key = () => randomBytes(32).toString('hex');
const account = (role, name) => ({ name, email: `${role}@momevia.test`, password: `Demo-${key()}` });

const probe = net.createServer();
probe.listen(port, '127.0.0.1');
await once(probe, 'listening');
await new Promise(resolve => probe.close(resolve));

if (!prepared) {
  if (fs.existsSync(demoDir)) throw new Error(`Demo chưa hoàn tất ở ${demoDir}. Dùng cổng mới để giữ dữ liệu hiện có.`);
  fs.mkdirSync(demoDir, { recursive: true, mode: 0o700 });
  writeJson('runtime.json', { jwtSecret: key(), internalKey: key() });
  writeJson('tai-khoan-demo.json', {
    admin: account('admin', 'Admin demo Momevia'),
    creator: account('creator', 'Mai Vy · Creator'),
    sender: account('sender', 'Minh Khôi · Sender'),
  });
  fs.mkdirSync(appDir);
}
syncWebDemo(root, appDir);
if (!fs.existsSync(path.join(appDir, 'node_modules')))
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(appDir, 'node_modules'), 'junction');
const runtime = readJson('runtime.json');
const accounts = readJson('tai-khoan-demo.json');
const storage = demoStorage(demoDir);
const env = {
  ...process.env,
  NODE_ENV: 'development', PUBLIC_BASE_URL: base, HOST: '127.0.0.1', PORT: String(port),
  ALLOWED_ORIGINS: allowedOrigins.join(','),
  JWT_SECRET: runtime.jwtSecret, INTERNAL_SERVICE_KEY: runtime.internalKey,
  IDENTITY_STORAGE: 'json', CATALOG_STORAGE: 'json', CHECKOUT_STORAGE: 'json',
  GIFTS_STORAGE: 'json', SUPPORT_STORAGE: 'json', DESIGNS_STORAGE: 'json',
  PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ZALO_APP_ID: '', ZALO_APP_SECRET: '',
  DEMO_AUTH_ENABLED: 'true', DEMO_TEMPLATE_CHECKOUT_ENABLED: 'true', DEMO_ADMIN_CODE: '',
  TEST_ACCOUNT_ENABLED: 'true', TEST_ACCOUNT_ROLE: 'admin', TEST_ACCOUNT_NAME: accounts.admin.name,
  TEST_ACCOUNT_EMAIL: accounts.admin.email, TEST_ACCOUNT_PASSWORD: accounts.admin.password,
  CANVAS_EDIT_ENABLED: 'true', CANVAS_PUBLISH_ENABLED: 'true', CANVAS_READ_ENABLED: 'true', GIFT_TTL_DAYS: '365',
  ...storage.env,
};
let child, exited, stopping = false, finish, disposeWatch, debounce;
let refreshWork = Promise.resolve();
const done = new Promise(resolve => { finish = resolve; });
function launch() {
  child = spawn(process.execPath, [fileURLToPath(new URL('./web-demo-server.mjs', import.meta.url))], {
    cwd: appDir, env, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true,
  });
  exited = once(child, 'exit');
  // Keep watch mode alive after a syntax error so saving the fix can restart it.
  child.on('error', error => console.error('Demo:', error.message));
}
async function stopChild() {
  const current = child, ended = exited;
  if (!current || current.exitCode !== null || current.signalCode !== null) return;
  if (current.connected) current.send('demo-stop', () => {});
  const force = setTimeout(() => current.kill(), 11_000);
  try { await ended; } finally { clearTimeout(force); }
}
const stop = () => { stopping = true; finish(); };
const messageStop = message => { if (message === 'demo-stop') stop(); };
process.on('message', messageStop);
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function ready() {
  for (let i = 0; i < 40; i++) {
    if (stopping || child.exitCode !== null || child.signalCode !== null) throw new Error('Máy chủ demo đã dừng.');
    const payload = await fetch(base + '/api/designs/health', { signal: AbortSignal.timeout(1500) })
      .then(response => response.ok ? response.json() : null).catch(() => null);
    if (payload?.ok && payload.profile.mode === storage.mode) return;
    await delay(250);
  }
  throw new Error('Máy chủ demo chưa sẵn sàng.');
}

try {
  launch();
  await Promise.race([ready(), exited.then(() => { throw new Error('Máy chủ demo đã dừng khi khởi động.'); })]);
  if (!prepared) writeJson('trang-thai-demo.json', await seedWebDemo({ base, accounts, appDir }));
  publishDemoRevision(appDir, randomUUID());
  console.log(`Momevia Web Demo: ${base}\nTài khoản và link các bước: ${demoDir}`);
  if (!values.prepare) {
    if (!values['no-watch']) {
      const changed = new Set();
      disposeWatch = watchWebDemo(root, file => {
        changed.add(file);
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const batch = [...changed];
          changed.clear();
          refreshWork = refreshWork.then(async () => {
            if (stopping) return;
            syncWebDemo(root, appDir);
            if (batch.some(file => !file.startsWith('web' + path.sep))) {
              await stopChild();
              if (stopping) return;
              launch();
              await ready();
            }
            if (!stopping) publishDemoRevision(appDir, randomUUID());
            console.log('Demo đã cập nhật mã nguồn mới; giữ nguyên dữ liệu thử.');
          }).catch(error => console.error('Chưa cập nhật demo:', error.message));
        }, 200);
      }, error => console.error('Không theo dõi được file demo:', error.message));
      console.log('Tự cập nhật khi lưu file. Trang giới thiệu tự tải lại; trang đang chỉnh thiệp giữ nguyên cho tới khi bạn tải lại.');
      await done;
    } else {
      const result = await Promise.race([exited, done.then(() => [0])]);
      if (result[0]) process.exitCode = result[0];
    }
  }
} finally {
  stopping = true;
  clearTimeout(debounce);
  disposeWatch?.();
  await refreshWork;
  await stopChild();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  process.removeListener('message', messageStop);
  if (process.connected) process.disconnect();
}
