import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot } from '../../src/shared/paths.mjs';
import { templates as seed } from '../../src/modules/catalog/seed.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { mysqlDate } from '../../src/modules/identity/mysql.repositories.mjs';

const collections = [
  ['users', 'identity', 'users.json', []],
  ['sessions', 'identity', 'sessions.json', []],
  ['templates', 'catalog', 'templates.json', seed],
  ['favorites', 'catalog', 'favorites.json', []],
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function check(condition, message) { if (!condition) throw new Error(`Import không hợp lệ: ${message}`); }
function unique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    const value = key(row);
    check(!seen.has(value), `${label} trùng (${value})`);
    seen.add(value);
  }
}
function date(value, label) {
  check(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label}: ngày không hợp lệ`);
  return mysqlDate(value);
}
function txt(value, label, max) {
  check(typeof value === 'string' && value.length > 0 && value.length <= max, `${label}: chuỗi không hợp lệ`);
  return value;
}

export function readIdentityCatalogSnapshot(root = projectRoot) {
  return Object.fromEntries(collections.map(([key, service, filename, fallback]) => {
    const filenameOnDisk = path.join(root, 'services', service, 'data', filename);
    const value = fs.existsSync(filenameOnDisk) ? JSON.parse(fs.readFileSync(filenameOnDisk, 'utf8')) : structuredClone(fallback);
    check(Array.isArray(value), `${key} phải là một mảng JSON`);
    return [key, value];
  }));
}

export function prepareIdentityCatalog(snapshot, now = Date.now()) {
  const { users, sessions, templates, favorites } = snapshot;
  for (const key of ['users','sessions','templates','favorites']) check(Array.isArray(snapshot[key]), `thiếu ${key}`);
  for (const u of users) {
    check(uuidPattern.test(u.id), `users.id (${u.id}) không phải UUID`);
    txt(u.provider, 'users.provider', 30);
    txt(u.providerId, 'users.providerId', 255);
    txt(u.name, 'users.name', 100);
    check(['sender','creator','admin'].includes(u.role), `users.role không hợp lệ (${u.id})`);
    date(u.createdAt, 'users.createdAt');
    if (u.provider === 'email') {
      txt(u.email, 'users.email', 254);
      txt(u.passwordHash, 'users.passwordHash', 1024);
    }
  }
  unique(users, row=>row.id, 'users.id');
  unique(users, row=>`${row.provider}\0${row.providerId}`, 'users.provider identity');
  unique(users.filter(row=>row.provider==='email'), row=>row.email.toLowerCase(), 'email đăng nhập');
  const userIds = new Set(users.map(row=>row.id));

  for (const t of templates) {
    txt(t.id, 'templates.id', 128);
    check(/^[a-zA-Z0-9_-]+$/.test(t.id), `templates.id chỉ chấp nhận ASCII URL-safe (${t.id})`);
    txt(t.title, 'templates.title', 100);
    txt(t.style, 'templates.style', 100);
    txt(t.theme, 'templates.theme', 100);
    check(Number.isSafeInteger(t.price) && t.price >= 0 && t.price <= 500000, `templates.price không hợp lệ (${t.id})`);
    check(['published','pending','rejected'].includes(t.status), `templates.status không hợp lệ (${t.id})`);
    date(t.createdAt, 'templates.createdAt');
    check(!t.creatorId || t.creatorId==='system' || userIds.has(t.creatorId), `template creator chưa tồn tại (${t.id})`);
  }
  unique(templates, row=>row.id, 'templates.id');
  const templateIds = new Set(templates.map(row=>row.id));

  for (const f of favorites) {
    check(userIds.has(f.userId), `favorite user chưa tồn tại (${f.userId})`);
    check(templateIds.has(f.templateId), `favorite template chưa tồn tại (${f.templateId})`);
    date(f.createdAt, 'favorites.createdAt');
  }
  unique(favorites, row=>`${row.userId}\0${row.templateId}`, 'favorite');

  for (const s of sessions) {
    txt(s.id, 'sessions.id', 191);
    check(userIds.has(s.userId), `session user chưa tồn tại (${s.userId})`);
    check(Number.isSafeInteger(s.exp) && s.exp > 0, 'sessions.exp không hợp lệ');
  }
  unique(sessions, row=>row.id, 'sessions.id');
  const activeSessions = sessions.filter(s=>s.exp * 1000 > now);
  return { users, templates, favorites, sessions: activeSessions,
    expiredSessionCount: sessions.length - activeSessions.length };
}

export async function applyIdentityCatalog(plan, client = new MySqlClient()) {
  // No REPLACE, IGNORE or ON DUPLICATE KEY UPDATE: never overwrite production records.
  return client.withTransaction(async tx => {
    const tables = ['users','sessions','templates','favorites'];
    for (const table of tables) {
      const [rows] = await tx.execute(`SELECT COUNT(*) AS total FROM ${table}`);
      if (Number(rows[0].total) !== 0) throw new Error(`${table} đã có dữ liệu; hủy import để tránh ghi đè.`);
    }
    for (const u of plan.users) await tx.execute(`INSERT INTO users
      (id, provider, provider_id, name, email, password_hash, avatar, role, created_at, legacy_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [u.id,u.provider,u.providerId,u.name,u.email || null,
      u.passwordHash || null,u.avatar || null,u.role,date(u.createdAt,'users.createdAt'),JSON.stringify(u)]);
    for (const t of plan.templates) await tx.execute(`INSERT INTO templates
      (id, creator_id, title, style, theme, price_vnd, status, created_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [t.id, (!t.creatorId || t.creatorId==='system') ? null : t.creatorId,
      t.title,t.style,t.theme,t.price,t.status,date(t.createdAt,'templates.createdAt'),JSON.stringify(t)]);
    for (const f of plan.favorites) await tx.execute(`INSERT INTO favorites(user_id,template_id,created_at)
      VALUES (?,?,?)`, [f.userId,f.templateId,date(f.createdAt,'favorites.createdAt')]);
    for (const s of plan.sessions) await tx.execute(`INSERT INTO sessions(id,user_id,expires_at)
      VALUES (?,?,?)`, [s.id,s.userId,mysqlDate(new Date(s.exp*1000).toISOString())]);
    // Link pre-0.9 Support tickets to imported users, keeping unresolved legacy IDs.
    await tx.execute(`UPDATE support_requests s INNER JOIN users u ON u.id=s.legacy_user_id
      SET s.user_id=u.id WHERE s.user_id IS NULL`);
    // Return planned counts after the transaction has successfully committed.
    return { users: plan.users.length, templates: plan.templates.length,
      favorites: plan.favorites.length, sessions: plan.sessions.length };
  });
}

const runningAsCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runningAsCLI) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) {
    console.error('Dùng: npm run db:import:identity-catalog [-- --apply]');
    process.exitCode = 1;
  } else {
    const snapshot = readIdentityCatalogSnapshot();
    const plan = prepareIdentityCatalog(snapshot);
    const counts = Object.fromEntries(['users','templates','favorites','sessions'].map(k=>[k,plan[k].length]));
    console.log('JSON snapshot được kiểm tra:', counts, `(bỏ ${plan.expiredSessionCount} sessions hết hạn)`);
    if (args.includes('--apply')) {
      const client = new MySqlClient();
      try { console.log('MySQL import committed:', await applyIdentityCatalog(plan, client)); }
      catch (error) { console.error('MySQL import rolled back:', error.message); process.exitCode = 1; }
      finally { await client.close(); }
    } else console.log('DRY RUN: chưa ghi dữ liệu. Chạy thêm -- --apply để nhập MySQL.');
  }
}
