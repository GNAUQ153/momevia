import { auditRepository, assessSchema, readSchemaMetadata } from './migration-audit.mjs';

try {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const requireLatest = args.includes('--require-latest');
  const indexes = args.includes('--indexes');
  const integrity = args.includes('--integrity');
  const authSchema = args.includes('--auth-schema');
  if (args.some(arg => !['--live', '--require-latest', '--indexes', '--integrity', '--auth-schema'].includes(arg)) || ((requireLatest || indexes || integrity || authSchema) && !live)) {
    throw new Error('Cách dùng: npm run db:audit [-- --live [--require-latest] [--indexes] [--integrity] [--auth-schema]]');
  }
  const repository = await auditRepository();
  const report = { mode: live ? 'metadata' : 'offline', repository };
  if (live && !repository.issues.length) {
    // Chỉ nạp client khi người vận hành yêu cầu kết nối; không chạy migration.
    const { MySqlClient } = await import('../../src/infrastructure/mysql/client.mjs');
    const client = new MySqlClient();
    try {
      report.schema = assessSchema(repository.migrations, await readSchemaMetadata(client), { requireLatest: requireLatest || integrity || authSchema });
      if (indexes) {
        const { readIndexMetadata } = await import('./index-audit.mjs');
        report.indexAudit = await readIndexMetadata(client);
      }
      if (authSchema) {
        const { auditAuthSchema } = await import('./auth-schema-audit.mjs');
        report.authSchema = await auditAuthSchema(client, report.schema);
      }
      if (integrity) {
        const { auditIntegrity } = await import('./integrity-audit.mjs');
        report.integrity = await auditIntegrity(client, report.schema);
      }
    } finally {
      await client.close();
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (repository.issues.length || report.schema?.issues.length || (integrity && report.integrity?.status !== 'ok') || (authSchema && report.authSchema?.status !== 'ok')) process.exitCode = 1;
} catch (error) {
  // Không in cấu hình kết nối, SQL driver message hoặc thông tin xác thực.
  console.error('Database audit không hoàn tất. Kiểm tra tham số, file baseline hoặc quyền đọc metadata.', error.code || 'AUDIT_ERROR');
  process.exitCode = 1;
}
