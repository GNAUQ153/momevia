import fs from 'node:fs';
import net from 'node:net';
import { request as httpsRequest } from 'node:https';
import { rootCertificates } from 'node:tls';
import { loadTlsOptions } from '../../src/shared/tls.mjs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { seedWebDemo } from './web-demo-fixture.mjs';
import { demoProfile, demoEndpoints, existingDemoKeys, demoStorage } from './web-demo-config.mjs';
import { publishDemoRevision, syncWebDemo, watchWebDemo } from './web-demo-sync.mjs';

const { values } = parseArgs({ options: {
  port: { type: 'string', default: '4110' },
  prepare: { type: 'boolean', default: false },
  'no-watch': { type: 'boolean', default: false },
  profile: { type: 'string' },
  signature: { type: 'boolean', default: false },
  'https-cert': { type: 'string' },
  'https-key': { type: 'string' },
  'public-base-url': { type: 'string' },
  'allowed-origin': { type: 'string', multiple: true, default: [] },
} });
const port = Number(values.port);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Chọn cổng loopback từ 1024 đến 65535.');
const root = fileURLToPath(new URL('../../', import.meta.url));
if (values.signature && (values.profile || values['https-cert'] || values['https-key'] ||
    values['public-base-url'] || values['allowed-origin'].length || process.env.ALLOWED_ORIGINS ||
    Object.keys(process.env).some(key => key.startsWith('RAILWAY_'))))
  throw new Error('Signature QA chỉ chạy HTTP loopback, dùng profile riêng tự động.');
const demoDir = values.signature ? path.join(root, 'local', `signature-demo-${port}`) : demoProfile(root, port, values.profile);
if (values.signature && (demoStorage(demoDir).mode !== 'json' ||
    (fs.existsSync(demoDir) && fs.lstatSync(demoDir).isSymbolicLink())))
  throw new Error('Signature QA không sử dụng profile MySQL hoặc liên kết thư mục.');
const appDir = path.join(demoDir, 'app');
const certFile = values['https-cert'] ? path.resolve(values['https-cert']) : '';
const keyFile = values['https-key'] ? path.resolve(values['https-key']) : '';
const { localBase: base, publicBase, allowedOrigins } = demoEndpoints(port, values['public-base-url'],
  [process.env.ALLOWED_ORIGINS || '', ...values['allowed-origin']].join(','), Boolean(certFile || keyFile));
const tlsOptions = loadTlsOptions({ baseUrl: publicBase, httpsCertFile: certFile, httpsKeyFile: keyFile });
const writeJson = (name, value) => fs.writeFileSync(path.join(demoDir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const readJson = file => JSON.parse(fs.readFileSync(path.join(demoDir, file), 'utf8'));
const prepared = fs.existsSync(path.join(demoDir, 'trang-thai-demo.json'));
const key = () => randomBytes(32).toString('hex');
const account = (role, name) => ({ name, email: `${role}@momevia.test`, password: `Demo-${key()}` });

const probe = net.createServer();
probe.listen(port, '127.0.0.1');
await once(probe, 'listening');
await new Promise(resolve => probe.close(resolve));

if (!prepared && tlsOptions) throw new Error('Khởi tạo profile bằng npm run demo:web -- --prepare trước khi bật HTTPS trực tiếp.');
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
if (prepared && !fs.existsSync(path.join(demoDir, 'runtime.json'))) writeJson('runtime.json', existingDemoKeys(demoDir));
const runtime = readJson('runtime.json');
const accounts = readJson('tai-khoan-demo.json');
const storage = demoStorage(demoDir);
const env = {
  ...process.env,
  NODE_ENV: 'development', PUBLIC_BASE_URL: publicBase, HTTPS_CERT_FILE: certFile, HTTPS_KEY_FILE: keyFile, HOST: '127.0.0.1', PORT: String(port),
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
  MOMEVIA_SIGNATURE_QA: values.signature ? 'true' : 'false',
  ...(values.signature ? { MOMEVIA_DATA_DIR: '' } : {}),
};
fs.writeFileSync(path.join(demoDir, 'launcher.pid'), String(process.pid) + '\n');
let child, exited, stopping = false, finish, disposeWatch, debounce;
let refreshWork = Promise.resolve();
const done = new Promise(resolve => { finish = resolve; });
function launch() {
  child = spawn(process.execPath, [fileURLToPath(new URL('./web-demo-server.mjs', import.meta.url))], {
    cwd: appDir, env, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true,
  });
  exited = once(child, 'exit');
  fs.writeFileSync(path.join(demoDir, 'runtime.pid'), String(child.pid) + '\n');
  // Keep watch mode alive after a syntax error so saving the fix can restart it.
  child.on('error', error => console.error('Demo:', error.message));
}
async function stopChild() {
  const current = child, ended = exited;
  if (!current || current.exitCode !== null || current.signalCode !== null) return;
  if (current.connected) current.send('demo-stop', () => {});
  const force = setTimeout(() => current.kill(), 11_000);
  try { await ended; } finally {
    clearTimeout(force);
    const pidFile = path.join(demoDir, 'runtime.pid');
    if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').trim() === String(current.pid)) fs.unlinkSync(pidFile);
  }
}
const stop = () => { stopping = true; finish(); };
const messageStop = message => { if (message === 'demo-stop') stop(); };
process.on('message', messageStop);
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function ready() {
  for (let i = 0; i < 40; i++) {
    if (stopping || child.exitCode !== null || child.signalCode !== null) throw new Error('Máy chủ demo đã dừng.');
    const payload = tlsOptions ? await new Promise(resolve => {
      const expectedHost = new URL(publicBase).hostname;
      const request = httpsRequest(base + '/api/designs/health', { ca: [...rootCertificates, tlsOptions.cert], timeout: 1500,
        ...(!net.isIP(expectedHost) ? { servername: expectedHost } : {}),
      }, response => {
        let body = ''; response.on('data', bytes => { body += bytes; });
        response.on('end', () => { try { resolve(response.statusCode === 200 ? JSON.parse(body) : null); } catch { resolve(null); } });
      });
      request.on('error', () => resolve(null));
      request.on('timeout', () => { request.destroy(); resolve(null); }); request.end();
    }) : await fetch(base + '/api/designs/health', { signal: AbortSignal.timeout(1500) })
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
  console.log(`Momevia Web Demo: ${publicBase}\nTài khoản và link các bước: ${demoDir}`);
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
            // Node also imports shared canvas definitions, seed factories and
            // dictionaries. Refresh its module cache when those files change.
            if (batch.some(file => !file.startsWith('web' + path.sep) ||
                file.startsWith(path.join('web', 'js', 'shared') + path.sep) ||
                file.startsWith(path.join('web', 'js', 'features', 'canvas-editor', 'library')) ||
                file === path.join('web', 'js', 'features', 'catalog', 'filter.js') ||
                file.startsWith(path.join('web', 'assets', 'locales') + path.sep))) {
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
  const launcherFile = path.join(demoDir, 'launcher.pid');
  if (fs.existsSync(launcherFile) && fs.readFileSync(launcherFile, 'utf8').trim() === String(process.pid)) fs.unlinkSync(launcherFile);
  if (process.connected) process.disconnect();
}
