import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { collectSnapshot, generateImportSql, sqlText, validateSnapshot } from '../../database/scripts/prepare-import.mjs';

function sample() {
  const userId = randomUUID();
  const giftId = randomUUID();
  const orderId = randomUUID();
  const now = '2026-11-01T00:00:00.000Z';
  return {
    users: [{ id: userId, provider: 'email', providerId: 'a@example.com', email: 'a@example.com', passwordHash: 'salt:hash', name: "O'Brien", role: 'sender', createdAt: now }],
    sessions: [{ id: 'token_jti_X', userId, exp: 1793606400 }],
    templates: [{ id: 'template-1', title: 'Chúc mừng', style: 'Lãng mạn', theme: 'rose', price: 59000, status: 'published', creatorId: 'system', createdAt: now }],
    favorites: [{ userId, templateId: 'template-1', createdAt: now }],
    gifts: [{ id: giftId, slug: 'ABCabc1234567890abcDEF234', userId, templateId: 'template-1', recipientName: 'An', senderName: 'Minh', message: 'Chúc mừng nhé!', imageFile: null, replyCount: 1, createdAt: now, expiresAt: '2027-11-01T00:00:00.000Z' }],
    replies: [{ id: randomUUID(), giftId, name: 'An', message: 'Cảm ơn', createdAt: now }],
    orders: [{ id: orderId, userId, templateId: 'template-1', grossAmount: 59000, platformFee: 11800, creatorAmount: 47200, currency: 'VND', status: 'demo_paid', paymentProvider: 'local_demo_only', createdAt: now }],
    requests: [{ id: randomUUID(), code: 'HT-2026-AB123456', userId, name: 'An', email: 'a@example.com', topic: 'Hỗ trợ', message: 'Cần giúp đỡ', status: 'new', createdAt: now }],
  };
}

test('snapshot đầy đủ có thể chuẩn bị thành SQL transaction', () => {
  const data = sample();
  const counts = validateSnapshot(data);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 8);
  const sql = generateImportSql(data);
  assert.match(sql, /^-- Momevia v0\.8/);
  assert.match(sql, /START TRANSACTION;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /database đã có dữ liệu|Database đã có dữ liệu/);
  assert.match(sql, /INSERT INTO users/);
  assert.match(sql, /INSERT INTO orders/);
  assert.match(sql, /TRUE, CONVERT\(0x[a-f0-9]+ USING utf8mb4\)/);
  assert.doesNotMatch(sql, /O'Brien|Chúc mừng nhé!|a@example\.com/);
  assert.doesNotMatch(sql, /template_entitlements.*VALUES/);
});

test('SQL UTF-8 không đưa văn bản nhập trực tiếp vào câu lệnh', () => {
  const encoded = sqlText("'); DROP TABLE users; -- / Chúc mừng");
  assert.match(encoded, /^CONVERT\(0x[a-f0-9]+ USING utf8mb4\)$/);
  assert.doesNotMatch(encoded, /DROP TABLE|Chúc/);
  assert.equal(sqlText(null), 'NULL');
  assert.equal(sqlText(''), "''");
});

test('không import favorite mồ côi', () => {
  const snapshot = sample();
  snapshot.favorites[0].templateId = 'no-such-template';
  assert.throws(() => validateSnapshot(snapshot), /không tồn tại/);
});

test('không import email trùng', () => {
  const snapshot = sample();
  snapshot.users.push({ ...snapshot.users[0], id: randomUUID() });
  assert.throws(() => validateSnapshot(snapshot), /bị trùng/);
});

test('không import đơn hàng sai cân đối hoặc sai đơn vị tiền', () => {
  const snapshot = sample();
  snapshot.orders[0].creatorAmount = 999;
  assert.throws(() => generateImportSql(snapshot), /không cân đối/);
  snapshot.orders[0].creatorAmount = 47200;
  snapshot.orders[0].currency = 'USD';
  assert.throws(() => generateImportSql(snapshot), /khác VND/);
});

test('không import đường dẫn ảnh chứa path traversal', () => {
  const snapshot = sample();
  snapshot.gifts[0].imageFile = '../../secret.txt';
  assert.throws(() => validateSnapshot(snapshot), /không được chứa đường dẫn/);
});

test('dữ liệu seed mặc định được dùng khi chưa tồn tại file template', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-db-'));
  try {
    const snapshot = collectSnapshot(dir);
    assert.ok(snapshot.templates.length >= 10);
    assert.deepEqual(snapshot.users, []);
    assert.deepEqual(snapshot.orders, []);
    assert.ok(validateSnapshot(snapshot).templates >= 10);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
