import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadEnvironment, validateSecrets } from '../shared/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
loadEnvironment();
if (process.env.NODE_ENV !== 'production') {
  for (const key of ['JWT_SECRET', 'INTERNAL_SERVICE_KEY']) {
    process.env[key] ||= randomBytes(32).toString('hex');
  }
}
validateSecrets(process.env);
const services = [
  ['identity', 'src/modules/identity/server.mjs'],
  ['catalog', 'src/modules/catalog/server.mjs'],
  ['checkout', 'src/modules/checkout/server.mjs'],
  ['gifts', 'src/modules/gifts/server.mjs'],
  ['support', 'src/modules/support/server.mjs'],
  ['gateway', 'src/gateway/server.mjs'],
];
const children = services.map(([name, file]) => {
  const child = spawn(process.execPath, [path.join(root, file)], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  child.on('exit', code => {
    if (!stopping && code) console.error(`Dịch vụ ${name} kết thúc với mã ${code}`);
  });
  return child;
});
let stopping = false;
function stop() {
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('Momevia đang khởi động. Mở http://localhost:4100');
