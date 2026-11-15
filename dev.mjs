import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from './services/shared/config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
loadEnvironment();
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.INTERNAL_SERVICE_KEY || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Production yêu cầu JWT_SECRET và INTERNAL_SERVICE_KEY mạnh.');
}
const services = [
  ['identity', 'services/identity/server.mjs'],
  ['catalog', 'services/catalog/server.mjs'],
  ['checkout', 'services/checkout/server.mjs'],
  ['gifts', 'services/gifts/server.mjs'],
  ['support', 'services/support/server.mjs'],
  ['gateway', 'gateway.mjs'],
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
