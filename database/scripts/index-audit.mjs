// Inventory chỉ đọc; prefix là ứng viên hỗ trợ truy vấn, không phải kết luận EXPLAIN.
const targets = [
  ['identity-provider', 'users', ['provider', 'provider_id']],
  ['identity-email', 'users', ['email_login']],
  ['session-expiry', 'sessions', ['expires_at']],
  ['gift-owner', 'gifts', ['user_id', 'created_at']],
  ['gift-unread', 'gift_replies', ['gift_id', 'read_status']],
  ['design-owner', 'designs', ['owner_id', 'updated_at', 'id']],
  ['asset-owner', 'design_assets', ['owner_id', 'id']],
  ['design-references', 'design_asset_refs', ['design_id', 'asset_id']],
  ['gift-references', 'gift_asset_refs', ['gift_id', 'asset_id']],
  ['checkout-context', 'checkout_design_contexts', ['owner_id', 'order_id', 'created_at', 'context_id']],
];

export function assessIndexPrefixes(rows) {
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.tableName)) tables.set(row.tableName, new Map());
    const indexes = tables.get(row.tableName);
    if (!indexes.has(row.indexName)) indexes.set(row.indexName, []);
    indexes.get(row.indexName).push(row);
  }
  return targets.map(([query, table, columns]) => {
    const indexes = tables.get(table);
    const candidates = [...(indexes || [])].filter(([, parts]) => {
      const sorted = [...parts].sort((a, b) => Number(a.position) - Number(b.position));
      return columns.every((column, i) => {
        const part = sorted[i];
        return part && Number(part.position) === i + 1 && part.columnName === column &&
          part.prefixLength === null && part.indexType === 'BTREE' && part.visible === 'YES';
      });
    }).map(([name]) => name).sort();
    return { query, table, columns, candidates, status: candidates.length ? 'prefix_found' : 'review_required' };
  });
}

export async function readIndexMetadata(client) {
  const [rows] = await client.execute(`SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName,
    SEQ_IN_INDEX AS position, COLUMN_NAME AS columnName, SUB_PART AS prefixLength,
    INDEX_TYPE AS indexType, IS_VISIBLE AS visible, NON_UNIQUE AS nonUnique, COLLATION AS direction
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
  return { indexes: rows, checks: assessIndexPrefixes(rows) };
}
