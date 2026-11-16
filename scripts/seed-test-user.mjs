import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { JsonRepository } from '../services/shared/storage.mjs';
import { CredentialsService } from '../services/identity/credentials.mjs';
import { environment } from '../services/shared/config.mjs';

// Chỉ tạo tài khoản kiểm thử theo yêu cầu, không có mật khẩu cố định trong source.
const hostname = new URL(environment().baseUrl).hostname;
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(hostname)) {
  console.error('Không được tạo tài khoản kiểm thử trong môi trường production.');
  process.exit(1);
}
const repo = new JsonRepository(path.resolve('services/identity/data/users.json'));
const service = new CredentialsService(repo);
const token = randomBytes(5).toString('hex');
const email = `tester-${token}@example.test`;
const password = `Momevia-${randomBytes(12).toString('hex')}Aa1`;
const user = await service.register({ name: 'Tài khoản kiểm thử', email, password });
console.log('\nTÀI KHOẢN KIỂM THỬ MỚI ĐÃ TẠO');
console.log(`Email: ${user.email}`);
console.log(`Mật khẩu: ${password}`);
console.log('Chỉ dùng để kiểm tra trên máy phát triển. Không chia sẻ hoặc commit thông tin này.');
console.log('Dừng các tiến trình ứng dụng trước khi chạy script để tránh ghi dữ liệu đồng thời.\n');
