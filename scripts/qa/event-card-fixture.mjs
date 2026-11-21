// Persistent, synthetic loopback fixture. Never reads the workspace .env or user data.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = path.join(root, 'local/event-cards/app');
const mode = process.argv[2];
if (mode === 'sync') {
  fs.mkdirSync(fixture, { recursive: true });
  for (const dir of ['src', 'web', 'services']) fs.cpSync(path.join(root, dir), path.join(fixture, dir), {
    recursive: true, filter: source => !['data', 'node_modules'].includes(path.basename(source)),
  });
  fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  if (!fs.existsSync(path.join(fixture, 'node_modules'))) fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
  console.log('Synced code only; isolated synthetic data preserved.');
} else if (mode === 'serve') {
  process.chdir(fixture);
  Object.assign(process.env, { NODE_ENV: 'test', DEMO_AUTH_ENABLED: 'true', PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false',
    CANVAS_READ_ENABLED: 'true', CANVAS_EDIT_ENABLED: 'true', CANVAS_PUBLISH_ENABLED: 'true', TEST_ACCOUNT_ENABLED: 'false' });
  for (const key of ['IDENTITY', 'CATALOG', 'CHECKOUT', 'GIFTS', 'SUPPORT', 'DESIGNS']) process.env[key + '_STORAGE'] = 'json';
  const configFile = path.join(fixture, '../config.json');
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile)) : {
    baseUrl: 'http://127.0.0.1:4178', jwtSecret: randomBytes(32).toString('hex'), internalKey: randomBytes(32).toString('hex'),
    demoEnabled: true, adminCode: '', giftTtlDays: 365, testAccount: null, googleId: '', googleSecret: '', zaloId: '', zaloSecret: '',
  };
  fs.writeFileSync(configFile, JSON.stringify(config));
  const { createHttpApp } = await import(pathToFileURL(path.join(fixture, 'src/server/app.mjs')));
  const app = await createHttpApp(config);
  app.server.listen(4178, '127.0.0.1', () => console.log('EVENT_CARDS_BASE=' + config.baseUrl));
} else throw new Error('Use sync or serve');
