import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('lược đồ MySQL sử dụng InnoDB, UTF8, khóa ngoài và chống double-charge', () => {
  const sql = fs.readFileSync(new URL('../../database/migrations/001_initial.sql', import.meta.url), 'utf8');
  for (const name of ['users', 'templates', 'sessions', 'favorites', 'gifts', 'gift_replies', 'orders', 'support_requests', 'payment_transactions', 'payment_events', 'template_entitlements', 'creator_ledger', 'outbox_events']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\(`));
  }
  assert.match(sql, /ENGINE=InnoDB/g);
  assert.match(sql, /utf8mb4/g);
  assert.match(sql, /FOREIGN KEY/g);
  assert.match(sql, /CHECK \(gross_vnd = platform_fee_vnd \+ creator_amount_vnd\)/);
  assert.match(sql, /UNIQUE KEY payment_event_uk/);
  assert.doesNotMatch(sql, /TIMESTAMPTZ|JSONB|CREATE SCHEMA|ON CONFLICT|GENERATED ALWAYS AS IDENTITY/i);
});
