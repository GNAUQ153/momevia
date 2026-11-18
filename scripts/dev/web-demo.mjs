import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { seedWebDemo } from './web-demo-fixture.mjs';

const { values } = parseArgs({ options: {
  port: { type: 'string', default: '4110' },
  prepare: { type: 'boolean', default: false },
} });
const port = Number(values.port);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Chọn cổng loopback từ 1024 đến 65535.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const demoDir = path.join(root, 'local', `web-demo-${port}`);
const appDir = path.join(demoDir, 'app');
const base = `http://127.0.0.1:${port}`;
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
  for (const name of ['src', 'web', 'package.json', 'dev.mjs'])
    fs.cpSync(path.join(root, name), path.join(appDir, name), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(appDir, 'node_modules'), 'junction');
}
const runtime = readJson('runtime.json');
const accounts = readJson('tai-khoan-demo.json');
const env = {
  ...process.env,
  NODE_ENV: 'development', PUBLIC_BASE_URL: base, HOST: '127.0.0.1', PORT: String(port),
  JWT_SECRET: runtime.jwtSecret, INTERNAL_SERVICE_KEY: runtime.internalKey,
  IDENTITY_STORAGE: 'json', CATALOG_STORAGE: 'json', CHECKOUT_STORAGE: 'json',
  GIFTS_STORAGE: 'json', SUPPORT_STORAGE: 'json', DESIGNS_STORAGE: 'json',
  PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ZALO_APP_ID: '', ZALO_APP_SECRET: '',
  DEMO_AUTH_ENABLED: 'true', DEMO_TEMPLATE_CHECKOUT_ENABLED: 'true', DEMO_ADMIN_CODE: '',
  TEST_ACCOUNT_ENABLED: 'true', TEST_ACCOUNT_ROLE: 'admin', TEST_ACCOUNT_NAME: accounts.admin.name,
  TEST_ACCOUNT_EMAIL: accounts.admin.email, TEST_ACCOUNT_PASSWORD: accounts.admin.password,
  CANVAS_EDIT_ENABLED: 'true', CANVAS_PUBLISH_ENABLED: 'true', CANVAS_READ_ENABLED: 'true', GIFT_TTL_DAYS: '365',
};
const child = spawn(process.execPath, ['dev.mjs'], { cwd: appDir, env, stdio: 'inherit', windowsHide: true });
const exited = once(child, 'exit');
const stop = () => { if (child.exitCode === null && child.signalCode === null) child.kill(); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function ready() {
  for (let i = 0; i < 40; i++) {
    const payload = await fetch(base + '/api/designs/health', { signal: AbortSignal.timeout(1500) })
      .then(response => response.ok ? response.json() : null).catch(() => null);
    if (payload?.ok && payload.profile.mode === 'json') return;
    await delay(250);
  }
  throw new Error('Máy chủ demo chưa sẵn sàng.');
}

try {
  await Promise.race([ready(), exited.then(() => { throw new Error('Máy chủ demo đã dừng khi khởi động.'); })]);
  if (!prepared) writeJson('trang-thai-demo.json', await seedWebDemo({ base, accounts, appDir }));
  console.log(`Momevia Web Demo: ${base}\nTài khoản và link các bước: ${demoDir}`);
  if (!values.prepare) {
    const [code] = await exited;
    if (code) process.exitCode = code;
  }
} finally {
  stop();
  await exited;
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
