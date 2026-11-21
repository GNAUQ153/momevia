import { loadEnvironment } from '../../src/shared/config.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';

const requiredTables = [
  'users', 'sessions', 'templates', 'favorites', 'gifts', 'gift_replies',
  'orders', 'demo_purchases', 'support_requests', 'payment_transactions', 'payment_events',
  'template_entitlements', 'creator_ledger', 'outbox_events',
  'payment_intents', 'payment_checkout_keys', 'payment_receipts',
  'payment_reconciliation_attempts',
  'refund_review_requests', 'refund_review_events',
];

loadEnvironment();
const client = new MySqlClient();
try {
  const [tables] = await client.execute(`
    SELECT table_name AS name, ENGINE AS engine
    FROM information_schema.TABLES
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
  `);
  const names = new Set(tables.map(row => row.name));
  for (const name of new Set(requiredTables)) {
    if (!names.has(name)) throw new Error(`Thiếu bảng: ${name}`);
  }
  for (const row of tables) {
    if (requiredTables.includes(row.name) && row.engine !== 'InnoDB') {
      throw new Error(`Bảng ${row.name} không dùng InnoDB`);
    }
  }
  const [migrations] = await client.execute('SELECT version FROM schema_migrations ORDER BY version');
  const versions = migrations.map(row => row.version);
  if (!versions.includes('010_refund_review') || !versions.includes('009_payment_reconciliation_audit') || !versions.includes('001_initial') || !versions.includes('002_support_user_bridge') || !versions.includes('003_identity_catalog') || !versions.includes('004_gifts_checkout') || !versions.includes('005_payment_receipts')) {
    throw new Error('Thiếu migration Refund Review 010 hoặc một trong các migration nền tảng.');
  }
  const [bridge] = await client.execute(`
    SELECT column_name AS name FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'support_requests' AND column_name = 'legacy_user_id'
  `);
  if (bridge.length !== 1) throw new Error('Thiếu cột bridge Support.');
  const [counts] = await client.execute(`
    SELECT (SELECT COUNT(*) FROM users) AS users_count,
           (SELECT COUNT(*) FROM templates) AS templates_count,
           (SELECT COUNT(*) FROM support_requests) AS support_count,
           (SELECT COUNT(*) FROM template_entitlements) AS paid_rights_count,
           (SELECT COUNT(*) FROM gifts) AS gifts_count,
           (SELECT COUNT(*) FROM gift_replies) AS replies_count,
           (SELECT COUNT(*) FROM orders) AS orders_count,
           (SELECT COUNT(*) FROM demo_purchases) AS demo_purchases_count,
           (SELECT COUNT(*) FROM payment_receipts) AS payment_receipts_count,
           (SELECT COUNT(*) FROM payment_intents) AS payment_intents_count,
           (SELECT COUNT(*) FROM refund_review_requests) AS refund_requests_count,
           (SELECT COUNT(*) FROM refund_review_events) AS refund_events_count
  `);
  console.log('PASS — MySQL Schema', versions);
  console.log('Số bản ghi:', counts[0]);
} catch (error) {
  console.error('FAIL — MySQL:', error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
