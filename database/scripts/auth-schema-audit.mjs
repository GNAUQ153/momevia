// Chỉ đọc metadata; marker migration không đủ để chứng minh DDL đã hoàn tất.
export const sessionMigration = '020_session_inventory';
const indexName = 'sessions_owner_version_expiry_idx';
const expected = ['user_id', 'credential_version', 'expires_at'];

export function assessAuthSchema(columns, indexes) {
  const issues = [];
  const credential = columns.filter(row => row.name === 'credential_version');
  const issued = columns.filter(row => row.name === 'issued_at');
  if (credential.length !== 1 || credential[0].type !== 'bigint unsigned' || credential[0].nullable !== 'YES' ||
      credential[0].defaultValue !== null || credential[0].extra !== '') issues.push('sessions.credential_version phải là BIGINT UNSIGNED NULL, không có default khác NULL hoặc generated/auto-update.');
  if (issued.length !== 1 || issued[0].type !== 'datetime(3)' || issued[0].nullable !== 'YES' ||
      issued[0].defaultValue !== null || issued[0].extra !== '') issues.push('sessions.issued_at phải là DATETIME(3) NULL, không có default khác NULL hoặc generated/auto-update.');
  const parts = indexes.filter(row => row.indexName === indexName).sort((a, b) => Number(a.position) - Number(b.position));
  if (parts.length !== expected.length || !expected.every((column, i) => {
    const row = parts[i];
    return row && Number(row.position) === i + 1 && row.columnName === column && row.prefixLength === null &&
      row.indexType === 'BTREE' && row.visible === 'YES' && Number(row.nonUnique) === 1 && row.direction === 'A';
  })) issues.push(`sessions.${indexName} phải là BTREE non-unique, visible, đúng ba cột theo thứ tự ASC.`);
  return { status: issues.length ? 'review_required' : 'ok', migration: sessionMigration, issues };
}

export async function auditAuthSchema(client, schema) {
  if (schema?.status !== 'latest' || schema.issues?.length || schema.pending?.length || schema.remaining?.length ||
      !schema.applied?.includes(sessionMigration)) {
    return { status: 'skipped_schema', migration: sessionMigration, issues: ['Cần xác minh schema mới nhất và marker migration 020 trước.'] };
  }
  const [columns] = await client.execute(`SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable,
    COLUMN_DEFAULT AS defaultValue, EXTRA AS extra FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?, ?)`, ['sessions', 'credential_version', 'issued_at']);
  const [indexes] = await client.execute(`SELECT INDEX_NAME AS indexName, SEQ_IN_INDEX AS position, COLUMN_NAME AS columnName,
    SUB_PART AS prefixLength, INDEX_TYPE AS indexType, IS_VISIBLE AS visible, NON_UNIQUE AS nonUnique, COLLATION AS direction
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, ['sessions', indexName]);
  return assessAuthSchema(columns, indexes);
}
