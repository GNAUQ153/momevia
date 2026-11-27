import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'dist/hostinger-public');
const builtIndex = path.join(root, 'web/assets/app/index.html');
if (!fs.existsSync(builtIndex)) throw new Error('Chạy npm run build trước khi đóng gói Hostinger.');
// Kiểm tra đường dẫn thật trước khi ghi; không đi qua junction hay symlink.
for (const target of [path.join(root, 'dist'), output]) {
  if (fs.existsSync(target) && (fs.lstatSync(target).isSymbolicLink() || fs.realpathSync(target) !== target)) {
    throw new Error('Thư mục build phải nằm trực tiếp trong workspace.');
  }
}
fs.mkdirSync(output, { recursive: true });
for (const name of ['assets', 'css', 'js', 'favicon.svg']) {
  fs.cpSync(path.join(root, 'web', name), path.join(output, name), {
    recursive: true,
    filter: source => !source.split(path.sep).some(part => part.endsWith('-qa')),
  });
}
fs.copyFileSync(builtIndex, path.join(output, 'index.html'));
for (const name of ['.htaccess', 'api-relay.php']) {
  fs.copyFileSync(path.join(root, 'deploy/hostinger', name), path.join(output, name));
}
console.log('Đã tạo dist/hostinger-public từ mã nguồn và cấu hình Hostinger có quản lý phiên bản.');
console.log('Đây là bản build local; lệnh này không upload hoặc triển khai lên website.');
