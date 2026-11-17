import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { projectRoot } from '../../src/shared/paths.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { mysqlDate } from '../../src/modules/identity/mysql.repositories.mjs';
import { readIdentityCatalogSnapshot } from './import-identity-catalog.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[A-Za-z0-9_-]{18,48}$/;
const filenamePattern = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const check = (ok, message) => { if (!ok) throw new Error(`Dữ liệu Gifts/Checkout không hợp lệ: ${message}`); };
const date = (s, label) => {
  check(typeof s === 'string' && Number.isFinite(Date.parse(s)), `${label}: ngày không hợp lệ`);
  return mysqlDate(s);
};
const text = (s, label, max) => {
  check(typeof s === 'string' && s.length > 0 && s.length <= max, `${label}: nội dung không hợp lệ`);
  return s;
};
function unique(items, fn, label) {
  const seen = new Set();
  for (const item of items) {
    const value = fn(item);
    check(!seen.has(value), `${label} trùng (${value})`);
    seen.add(value);
  }
}
function rows(root, service, file) {
  const filename = path.join(root, 'services', service, 'data', file);
  if (!fs.existsSync(filename)) return [];
  const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
  check(Array.isArray(value), `${service}/${file} phải là JSON array`);
  return value;
}

export function readGiftsCheckoutSnapshot(root = projectRoot) {
  return {
    gifts: rows(root, 'gifts', 'gifts.json'),
    replies: rows(root, 'gifts', 'replies.json'),
    orders: rows(root, 'checkout', 'orders.json'),
  };
}

export function prepareGiftsCheckout(snapshot, identityCatalog, { root = projectRoot } = {}) {
  check(identityCatalog && Array.isArray(identityCatalog.users) && Array.isArray(identityCatalog.templates),
    'thiếu danh sách Users/Templates dùng để kiểm tra khóa ngoại');
  for (const type of ['gifts','replies','orders']) check(Array.isArray(snapshot[type]), `thiếu mảng ${type}`);
  const userIds = new Set(identityCatalog.users.map(item => item.id));
  const templateIds = new Set(identityCatalog.templates.map(item => item.id));
  const paidTemplateIds = new Set(identityCatalog.templates.filter(t => t.price > 0).map(t => t.id));
  const { gifts, replies, orders } = snapshot;

  unique(gifts, g => g.id, 'gift id');
  unique(gifts, g => g.slug, 'gift slug');
  const giftIds = new Set(gifts.map(g => g.id));
  for (const g of gifts) {
    check(uuidPattern.test(g.id), `gift.id không phải UUID: ${g.id}`);
    check(slugPattern.test(g.slug), `gift.slug không hợp lệ: ${g.id}`);
    check(userIds.has(g.userId), `gift.userId chưa tồn tại: ${g.id}`);
    check(templateIds.has(g.templateId), `gift.templateId chưa tồn tại: ${g.id}`);
    text(g.recipientName, 'gift.recipientName', 100);
    text(g.senderName, 'gift.senderName', 100);
    text(g.message, 'gift.message', 10000);
    date(g.createdAt, 'gift.createdAt');
    date(g.expiresAt, 'gift.expiresAt');
    check(Date.parse(g.expiresAt) > Date.parse(g.createdAt), `gift.expiresAt trước createdAt: ${g.id}`);
    check(Number.isSafeInteger(g.replyCount) && g.replyCount >= 0, `gift.replyCount không hợp lệ: ${g.id}`);
    if (g.imageFile) {
      check(filenamePattern.test(g.imageFile), `gift.imageFile không hợp lệ: ${g.id}`);
      check(fs.existsSync(path.join(root, 'services', 'gifts', 'data', 'images', g.imageFile)),
        `thiếu ảnh local: ${g.imageFile}`);
    }
  }

  unique(replies, r => r.id, 'reply id');
  const replyCounts = new Map(gifts.map(g => [g.id, 0]));
  for (const r of replies) {
    check(uuidPattern.test(r.id), `reply.id không phải UUID: ${r.id}`);
    check(giftIds.has(r.giftId), `reply tham chiếu quà không tồn tại: ${r.id}`);
    text(r.name, 'reply.name', 100);
    text(r.message, 'reply.message', 10000);
    date(r.createdAt, 'reply.createdAt');
    replyCounts.set(r.giftId, replyCounts.get(r.giftId) + 1);
  }
  for (const g of gifts) check(replyCounts.get(g.id) === g.replyCount,
    `replyCount không khớp số phản hồi: ${g.id} (${g.replyCount} vs ${replyCounts.get(g.id)})`);

  unique(orders, o => o.id, 'order id');
  unique(orders.filter(o => o.status === 'demo_paid'), o => `${o.userId}\0${o.templateId}`, 'demo purchase');
  const licenseKeys = new Set();
  for (const o of orders) {
    check(uuidPattern.test(o.id), `order.id không phải UUID: ${o.id}`);
    check(userIds.has(o.userId), `order.userId chưa tồn tại: ${o.id}`);
    check(templateIds.has(o.templateId), `order.templateId chưa tồn tại: ${o.id}`);
    check(o.status === 'demo_paid' && o.paymentProvider === 'local_demo_only',
      `chỉ hỗ trợ import đơn demo_paid/local_demo_only: ${o.id}`);
    check(Number.isSafeInteger(o.grossAmount) && o.grossAmount > 0 && o.grossAmount <= 500000,
      `order.grossAmount không hợp lệ: ${o.id}`);
    check(Number.isSafeInteger(o.platformFee) && Number.isSafeInteger(o.creatorAmount)
      && o.platformFee >= 0 && o.creatorAmount >= 0 && o.grossAmount === o.platformFee + o.creatorAmount,
    `order phí và tiền Creator mất cân đối: ${o.id}`);
    check(o.currency === 'VND', `order currency không hợp lệ: ${o.id}`);
    date(o.createdAt, 'order.createdAt');
    licenseKeys.add(`${o.userId}\0${o.templateId}`);
  }
  for (const g of gifts) {
    if (paidTemplateIds.has(g.templateId))
      check(licenseKeys.has(`${g.userId}\0${g.templateId}`), `gift trả phí chưa có license demo: ${g.id}`);
  }
  return { gifts, replies, orders };
}

export async function applyGiftsCheckout(plan, client = new MySqlClient()) {
  return client.withTransaction(async tx => {
    for (const table of ['orders', 'demo_purchases', 'template_entitlements', 'gifts', 'gift_replies']) {
      const [rows] = await tx.execute(`SELECT COUNT(*) AS total FROM ${table}`);
      check(Number(rows[0].total) === 0, `${table} đã có dữ liệu; không được ghi đè.`);
    }
    // Validate referenced users and templates against MySQL, not only JSON.
    const [users] = await tx.execute('SELECT id FROM users');
    const [templates] = await tx.execute('SELECT id FROM templates');
    const userIds = new Set(users.map(u => u.id));
    const templateIds = new Set(templates.map(t => t.id));
    for (const row of [...plan.orders, ...plan.gifts]) {
      check(userIds.has(row.userId), `user thiếu trên MySQL: ${row.userId}`);
      check(templateIds.has(row.templateId), `template thiếu trên MySQL: ${row.templateId}`);
    }
    // A single transaction also covers demo purchase uniqueness and entitlement grants.
    for (const o of plan.orders) {
      await tx.execute(`INSERT INTO orders
        (id, user_id, template_id, gross_vnd, platform_fee_vnd, creator_amount_vnd,
         currency, status, payment_provider, is_test, created_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, 'VND', 'demo_paid', 'local_demo_only', 1, ?, ?)`,
      [o.id, o.userId, o.templateId, o.grossAmount, o.platformFee, o.creatorAmount,
        date(o.createdAt, 'order.createdAt'), JSON.stringify(o)]);
      await tx.execute('INSERT INTO demo_purchases(user_id,template_id,order_id) VALUES (?,?,?)',
        [o.userId, o.templateId, o.id]);
      await tx.execute(`INSERT INTO template_entitlements(id,user_id,template_id,order_id,granted_at)
        VALUES (?,?,?,?,?)`, [randomUUID(), o.userId, o.templateId, o.id, date(o.createdAt, 'order.createdAt')]);
    }
    for (const g of plan.gifts) await tx.execute(`INSERT INTO gifts
      (id, slug, user_id, template_id, recipient_name, sender_name, message, image_file,
       reply_count, created_at, expires_at, payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [g.id, g.slug, g.userId, g.templateId, g.recipientName, g.senderName, g.message,
      g.imageFile || null, g.replyCount, date(g.createdAt, 'gift.createdAt'),
      date(g.expiresAt, 'gift.expiresAt'), JSON.stringify(g)]);
    for (const r of plan.replies) await tx.execute(`INSERT INTO gift_replies
      (id, gift_id, name, message, created_at) VALUES (?,?,?,?,?)`,
    [r.id, r.giftId, r.name, r.message, date(r.createdAt, 'reply.createdAt')]);
    return { orders: plan.orders.length, gifts: plan.gifts.length,
      replies: plan.replies.length, demoEntitlements: plan.orders.length };
  });
}

const runningAsCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runningAsCLI) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) {
    console.error('Cách dùng: npm run db:import:gifts-checkout [-- --apply]');
    process.exitCode = 1;
  } else {
    try {
      const identity = readIdentityCatalogSnapshot();
      const snapshot = readGiftsCheckoutSnapshot();
      const plan = prepareGiftsCheckout(snapshot, identity);
      console.log('JSON snapshot Gifts/Checkout:', { orders: plan.orders.length,
        gifts: plan.gifts.length, replies: plan.replies.length });
      if (args.includes('--apply')) {
        const client = new MySqlClient();
        try { console.log('MySQL import COMMITTED:', await applyGiftsCheckout(plan, client)); }
        catch (error) { console.error('MySQL import ROLLED BACK:', error.message); process.exitCode = 1; }
        finally { await client.close(); }
      } else console.log('DRY-RUN: Chưa ghi vào MySQL. Chỉ chạy -- --apply sau khi backup và kiểm tra số liệu.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
