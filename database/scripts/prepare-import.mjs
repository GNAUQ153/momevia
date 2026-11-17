import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot } from '../../src/shared/paths.mjs';
import { templates as systemTemplates } from '../../src/modules/catalog/seed.mjs';

const collections = Object.freeze([
  ['users', 'identity', 'users.json'],
  ['sessions', 'identity', 'sessions.json'],
  ['templates', 'catalog', 'templates.json'],
  ['favorites', 'catalog', 'favorites.json'],
  ['gifts', 'gifts', 'gifts.json'],
  ['replies', 'gifts', 'replies.json'],
  ['orders', 'checkout', 'orders.json'],
  ['requests', 'support', 'requests.json'],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredText(value, label) {
  assert(typeof value === 'string' && value.length > 0 && !value.includes('\0'), `${label} phải là chuỗi không rỗng.`);
  return value;
}

function optionalText(value, label) {
  return value == null ? null : requiredText(value, label);
}

function validUuid(value, label) {
  assert(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), `${label} không phải UUID hợp lệ.`);
  return value;
}

function validDate(value, label) {
  requiredText(value, label);
  const date = new Date(value);
  assert(Number.isFinite(date.getTime()), `${label} không phải thời gian hợp lệ.`);
  return date.toISOString();
}

function vnd(value, label) {
  assert(Number.isSafeInteger(value) && value >= 0 && value <= 2147483647, `${label} phải là số VND nguyên không âm trong giới hạn MySQL INT.`);
  return value;
}

function ensureUnique(values, key, label) {
  const seen = new Set();
  for (const row of values) {
    const value = key(row);
    assert(!seen.has(value), `${label} bị trùng: ${value}`);
    seen.add(value);
  }
}

// Dùng UTF-8 hex để sinh SQL an toàn, kể cả khi người dùng nhập dấu nháy hoặc tiếng Việt.
export function sqlText(value) {
  if (value == null) return 'NULL';
  assert(typeof value === 'string' && !value.includes('\0'), 'Giá trị SQL không hợp lệ.');
  if (value === '') return "''";
  return `CONVERT(0x${Buffer.from(value, 'utf8').toString('hex')} USING utf8mb4)`;
}

function sqlUuid(value) {
  if (value == null) return 'NULL';
  return sqlText(validUuid(value, 'uuid'));
}

function sqlJson(value) {
  // MySQL kiểm tra tính hợp lệ khi nhập vào cột JSON.
  return sqlText(JSON.stringify(value));
}

function sqlDate(value, label) {
  // Giữ mili-giây, chuẩn hóa tất cả ISO date về UTC khi lưu DATETIME(3).
  return sqlText(validDate(value, label).replace('T', ' ').replace('Z', ''));
}

function sqlNumber(value) {
  return String(value);
}

function sqlBoolean(value) {
  return value ? 'TRUE' : 'FALSE';
}

export function collectSnapshot(root = projectRoot) {
  const result = {};
  for (const [key, service, filename] of collections) {
    const absolutePath = path.join(root, 'services', service, 'data', filename);
    const fallback = key === 'templates' ? systemTemplates : [];
    const rows = fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : structuredClone(fallback);
    assert(Array.isArray(rows), `${absolutePath} phải là mảng JSON.`);
    result[key] = rows;
  }
  return result;
}

export function validateSnapshot(snapshot) {
  for (const [key] of collections) assert(Array.isArray(snapshot[key]), `Thiếu collection ${key}.`);
  const users = snapshot.users;
  const templates = snapshot.templates;
  const gifts = snapshot.gifts;
  const orders = snapshot.orders;

  for (const u of users) {
    validUuid(u.id, 'users.id');
    requiredText(u.provider, 'users.provider');
    requiredText(u.providerId, 'users.providerId');
    requiredText(u.name, 'users.name');
    assert(['sender', 'creator', 'admin'].includes(u.role), 'users.role không hợp lệ.');
    validDate(u.createdAt, 'users.createdAt');
    if (u.provider === 'email') {
      requiredText(u.email, 'users.email');
      requiredText(u.passwordHash, 'users.passwordHash');
    }
  }
  ensureUnique(users, u => u.id, 'users.id');
  ensureUnique(users, u => `${u.provider}\0${u.providerId}`, 'users(provider, provider_id)');
  ensureUnique(users.filter(u => u.provider === 'email'), u => u.email.toLowerCase(), 'email đăng nhập');
  const userIds = new Set(users.map(u => u.id));

  for (const t of templates) {
    requiredText(t.id, 'templates.id');
    requiredText(t.title, 'templates.title');
    requiredText(t.style, 'templates.style');
    requiredText(t.theme, 'templates.theme');
    vnd(t.price, 'templates.price');
    assert(t.price <= 500000, 'templates.price vượt hạn mức hiện tại.');
    assert(['published', 'pending', 'rejected'].includes(t.status), 'templates.status không hợp lệ.');
    validDate(t.createdAt, 'templates.createdAt');
    if (t.creatorId && t.creatorId !== 'system') assert(userIds.has(t.creatorId), `Creator ${t.creatorId} chưa có tài khoản.`);
  }
  ensureUnique(templates, t => t.id, 'templates.id');
  const templateIds = new Set(templates.map(t => t.id));

  for (const row of snapshot.sessions) {
    requiredText(row.id, 'sessions.id');
    assert(userIds.has(row.userId), `Session ${row.id} trỏ tới user không có.`);
    assert(Number.isSafeInteger(row.exp) && row.exp > 0, 'sessions.exp không hợp lệ.');
  }
  ensureUnique(snapshot.sessions, row => row.id, 'sessions.id');

  for (const row of snapshot.favorites) {
    assert(userIds.has(row.userId), `Favorite user ${row.userId} không tồn tại.`);
    assert(templateIds.has(row.templateId), `Favorite template ${row.templateId} không tồn tại.`);
    validDate(row.createdAt, 'favorites.createdAt');
  }
  ensureUnique(snapshot.favorites, row => `${row.userId}\0${row.templateId}`, 'favorite(user,template)');

  for (const g of gifts) {
    validUuid(g.id, 'gifts.id');
    requiredText(g.slug, 'gifts.slug');
    assert(userIds.has(g.userId), `Gift ${g.id} trỏ tới user không tồn tại.`);
    assert(templateIds.has(g.templateId), `Gift ${g.id} trỏ tới template không tồn tại.`);
    requiredText(g.recipientName, 'gifts.recipientName');
    requiredText(g.senderName, 'gifts.senderName');
    requiredText(g.message, 'gifts.message');
    assert(Number.isSafeInteger(g.replyCount) && g.replyCount >= 0, 'gifts.replyCount không hợp lệ.');
    assert(new Date(validDate(g.expiresAt, 'gifts.expiresAt')) > new Date(validDate(g.createdAt, 'gifts.createdAt')), 'gifts.expiresAt phải sau createdAt.');
    if (g.imageFile) assert(path.basename(g.imageFile) === g.imageFile, 'gifts.imageFile không được chứa đường dẫn.');
  }
  ensureUnique(gifts, g => g.id, 'gifts.id');
  ensureUnique(gifts, g => g.slug, 'gifts.slug');
  const giftIds = new Set(gifts.map(g => g.id));
  for (const r of snapshot.replies) {
    validUuid(r.id, 'replies.id');
    assert(giftIds.has(r.giftId), `Reply ${r.id} trỏ tới gift không tồn tại.`);
    requiredText(r.name, 'replies.name');
    requiredText(r.message, 'replies.message');
    validDate(r.createdAt, 'replies.createdAt');
  }
  ensureUnique(snapshot.replies, r => r.id, 'replies.id');

  for (const o of orders) {
    validUuid(o.id, 'orders.id');
    assert(userIds.has(o.userId), `Order ${o.id} trỏ tới user không tồn tại.`);
    assert(templateIds.has(o.templateId), `Order ${o.id} trỏ tới template không tồn tại.`);
    vnd(o.grossAmount, 'orders.grossAmount');
    vnd(o.platformFee, 'orders.platformFee');
    vnd(o.creatorAmount, 'orders.creatorAmount');
    assert(o.platformFee + o.creatorAmount === o.grossAmount, `Order ${o.id} không cân đối số tiền.`);
    assert(o.currency === 'VND', `Order ${o.id} khác VND.`);
    requiredText(o.status, 'orders.status');
    requiredText(o.paymentProvider, 'orders.paymentProvider');
    validDate(o.createdAt, 'orders.createdAt');
  }
  ensureUnique(orders, o => o.id, 'orders.id');

  for (const r of snapshot.requests) {
    validUuid(r.id, 'requests.id');
    requiredText(r.code, 'requests.code');
    if (r.userId != null) assert(userIds.has(r.userId), `Support request ${r.id} trỏ tới user không tồn tại.`);
    for (const key of ['name', 'email', 'topic', 'message', 'status']) requiredText(r[key], `requests.${key}`);
    validDate(r.createdAt, 'requests.createdAt');
  }
  ensureUnique(snapshot.requests, r => r.id, 'requests.id');
  ensureUnique(snapshot.requests, r => r.code, 'requests.code');
  return Object.fromEntries(collections.map(([name]) => [name, snapshot[name].length]));
}

// Chỉ import vào database trống; không tự merge hoặc ghi đè dữ liệu production.
export function generateImportSql(snapshot) {
  validateSnapshot(snapshot);
  const output = [
    '-- Momevia v0.8 (MySQL). Dữ liệu cá nhân: KHÔNG commit hoặc chia sẻ.',
    '-- Chỉ dùng database DEV trống đã chạy migration 001 và 002.',
    'SET NAMES utf8mb4;',
    "SET time_zone = '+00:00';",
    'DELIMITER $$',
    'DROP PROCEDURE IF EXISTS momevia_import_guard$$',
    `CREATE PROCEDURE momevia_import_guard()
    BEGIN
      IF ((SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM sessions) +
          (SELECT COUNT(*) FROM templates) + (SELECT COUNT(*) FROM favorites) +
          (SELECT COUNT(*) FROM gifts) + (SELECT COUNT(*) FROM gift_replies) +
          (SELECT COUNT(*) FROM orders) + (SELECT COUNT(*) FROM support_requests)) > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Database đã có dữ liệu, từ chối import snapshot.';
      END IF;
    END$$`,
    'DELIMITER ;',
    'CALL momevia_import_guard();',
    'DROP PROCEDURE momevia_import_guard;',
    'START TRANSACTION;',
  ];

  function insert(table, columns, values) {
    output.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
  }

  for (const u of snapshot.users) insert('users',
    ['id', 'provider', 'provider_id', 'name', 'email', 'password_hash', 'avatar', 'role', 'created_at', 'legacy_payload'],
    [sqlUuid(u.id), sqlText(u.provider), sqlText(u.providerId), sqlText(u.name), sqlText(optionalText(u.email, 'users.email')), sqlText(optionalText(u.passwordHash, 'users.passwordHash')), sqlText(optionalText(u.avatar, 'users.avatar')), sqlText(u.role), sqlDate(u.createdAt, 'users.createdAt'), sqlJson(u)]);

  for (const t of snapshot.templates) insert('templates',
    ['id', 'creator_id', 'title', 'style', 'theme', 'price_vnd', 'status', 'created_at', 'payload'],
    [sqlText(t.id), sqlUuid(t.creatorId && t.creatorId !== 'system' ? t.creatorId : null), sqlText(t.title), sqlText(t.style), sqlText(t.theme), sqlNumber(t.price), sqlText(t.status), sqlDate(t.createdAt, 'templates.createdAt'), sqlJson(t)]);

  for (const s of snapshot.sessions) insert('sessions', ['id', 'user_id', 'expires_at'],
    [sqlText(s.id), sqlUuid(s.userId), `FROM_UNIXTIME(${sqlNumber(s.exp)})`]);
  for (const f of snapshot.favorites) insert('favorites', ['user_id', 'template_id', 'created_at'],
    [sqlUuid(f.userId), sqlText(f.templateId), sqlDate(f.createdAt, 'favorites.createdAt')]);

  for (const g of snapshot.gifts) insert('gifts',
    ['id', 'slug', 'user_id', 'template_id', 'recipient_name', 'sender_name', 'message', 'image_file', 'reply_count', 'created_at', 'expires_at', 'payload'],
    [sqlUuid(g.id), sqlText(g.slug), sqlUuid(g.userId), sqlText(g.templateId), sqlText(g.recipientName), sqlText(g.senderName), sqlText(g.message), sqlText(optionalText(g.imageFile, 'gifts.imageFile')), sqlNumber(g.replyCount), sqlDate(g.createdAt, 'gifts.createdAt'), sqlDate(g.expiresAt, 'gifts.expiresAt'), sqlJson(g)]);
  for (const r of snapshot.replies) insert('gift_replies', ['id', 'gift_id', 'name', 'message', 'created_at'],
    [sqlUuid(r.id), sqlUuid(r.giftId), sqlText(r.name), sqlText(r.message), sqlDate(r.createdAt, 'replies.createdAt')]);

  for (const o of snapshot.orders) insert('orders',
    ['id', 'user_id', 'template_id', 'gross_vnd', 'platform_fee_vnd', 'creator_amount_vnd', 'currency', 'status', 'payment_provider', 'is_test', 'created_at', 'payload'],
    [sqlUuid(o.id), sqlUuid(o.userId), sqlText(o.templateId), sqlNumber(o.grossAmount), sqlNumber(o.platformFee), sqlNumber(o.creatorAmount), sqlText(o.currency), sqlText(o.status), sqlText(o.paymentProvider), sqlBoolean(true), sqlDate(o.createdAt, 'orders.createdAt'), sqlJson(o)]);

  for (const r of snapshot.requests) insert('support_requests',
    ['id', 'code', 'user_id', 'legacy_user_id', 'name', 'email', 'topic', 'message', 'status', 'created_at'],
    [sqlUuid(r.id), sqlText(r.code), 'NULL', sqlUuid(r.userId), sqlText(r.name), sqlText(r.email), sqlText(r.topic), sqlText(r.message), sqlText(r.status), sqlDate(r.createdAt, 'requests.createdAt')]);

  output.push('COMMIT;', '');
  return output.join('\n');
}

function parseCli(args) {
  const index = args.indexOf('--output');
  assert(index < 0 || (args[index + 1] && !args[index + 1].startsWith('--')), '--output cần đường dẫn file.');
  const target = index < 0 ? path.join(projectRoot, 'database/private/import.sql') : path.resolve(args[index + 1]);
  const allowedDir = path.resolve(projectRoot, 'database/private');
  assert(target.startsWith(`${allowedDir}${path.sep}`), 'Chỉ cho phép ghi file vào database/private/ để tránh commit dữ liệu riêng tư.');
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const target = parseCli(process.argv.slice(2));
    const snapshot = collectSnapshot();
    const counts = validateSnapshot(snapshot);
    const sql = generateImportSql(snapshot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, sql, { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(target, 0o600);
    console.log('Đã tạo SQL snapshot riêng tư tại:', target);
    console.log('Số bản ghi:', counts);
    console.log('Lưu ý: dữ liệu ảnh trong services/gifts/data/images cần chuyển riêng sang Object Storage.');
    console.log('Lưu ý: đơn hàng demo KHÔNG được cấp quyền thanh toán production.');
  } catch (error) {
    console.error('Không thể chuẩn bị snapshot:', error.message);
    process.exitCode = 1;
  }
}
