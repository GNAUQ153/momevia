import { auditRepository, assessSchema, readSchemaMetadata } from './migration-audit.mjs';

try {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const requireLatest = args.includes('--require-latest');
  if (args.some(arg => !['--live', '--require-latest'].includes(arg)) || (requireLatest && !live)) {
    throw new Error('Cách dùng: npm run db:audit [-- --live [--require-latest]]');
  }
  const repository = await auditRepository();
  const report = { mode: live ? 'metadata' : 'offline', repository };
  if (live && !repository.issues.length) {
    // Chỉ nạp client khi người vận hành yêu cầu kết nối; không chạy migration.
    const { MySqlClient } = await import('../../src/infrastructure/mysql/client.mjs');
    const client = new MySqlClient();
    try {
      report.schema = assessSchema(repository.migrations, await readSchemaMetadata(client), { requireLatest });
    } finally {
      await client.close();
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (repository.issues.length || report.schema?.issues.length) process.exitCode = 1;
} catch (error) {
  // Không in cấu hình kết nối, SQL driver message hoặc thông tin xác thực.
  console.error('Database audit không hoàn tất. Kiểm tra tham số, file baseline hoặc quyền đọc metadata.', error.code || 'AUDIT_ERROR');
  process.exitCode = 1;
}
