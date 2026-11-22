// Offline, empty-target-only cutover. Never use the legacy importers for canvas.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { mysqlDate } from '../../src/modules/identity/mysql.repositories.mjs';
import { hash } from '../../src/modules/designs/designs.service.mjs';
import { designFromRow, assetFromRow, jsonValue, iso } from '../../src/modules/designs/mysql.repository.mjs';
import { assetIds, canonicalStringify, validateDocument } from '../../web/js/shared/canvas/index.js';
import { readIdentityCatalogSnapshot, prepareIdentityCatalog } from './import-identity-catalog.mjs';
import { exportCanvas, verifyCanvas } from '../../scripts/dev/canvas-backup.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`Canvas JSON import: ${message}`); };
const same = (a, b) => canonicalStringify(a) === canonicalStringify(b);
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const date = value => value == null ? null : mysqlDate(value);
const json = JSON.stringify;
function readArray(root, service, filename) {
  const file = path.join(root, 'services', service, 'data', filename);
  const value = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  check(Array.isArray(value), `${service}/${filename} must be an array`);
  return value;
}

export function readCanvasSnapshot(root) {
  check(typeof root === 'string' && root.length, 'explicit source root required');
  const identity = readIdentityCatalogSnapshot(root);
  // Retain expired session records as well; the runtime already rejects them.
  prepareIdentityCatalog(identity);
  return { ...identity, orders: readArray(root, 'checkout', 'orders.json'),
    gifts: readArray(root, 'gifts', 'gifts.json'), replies: readArray(root, 'gifts', 'replies.json'),
    requests: readArray(root, 'support', 'requests.json'),
    canvas: JSON.parse(fs.readFileSync(path.join(root, 'services/designs/data/canvas.json'), 'utf8')) };
}

export function planCanvasImport(snapshot) {
  const s = structuredClone(snapshot), c = s.canvas;
  check(c?.formatVersion === 1, 'unsupported aggregate');
  const users = new Set(s.users.map(u => u.id)), templates = new Set(s.templates.map(t => t.id));
  const versions = [], aliases = {}, byRevision = new Map();
  for (const d of Object.values(c.designs)) {
    validateDocument(d.document); check(d.documentHash === hash(d.document), 'draft document hash mismatch');
    check(users.has(d.ownerId), 'unresolved draft owner');
    check(d.source.kind === 'blank' || templates.has(d.source.templateId), 'unresolved draft template');
  }
  for (const v of Object.values(c.versions)) {
    check(c.designs[v.designId], 'unresolved version design');
    validateDocument(v.document, { mode: 'publish', requiredBindings: [] });
    const key = `${v.designId}:${v.revision}`, previous = byRevision.get(key);
    if (previous) {
      check(v.documentHash === previous.documentHash && v.schemaVersion === previous.schemaVersion &&
        v.runtimeVersion === previous.runtimeVersion && same(v.document, previous.document),
      'conflicting snapshots at the same revision; refusing to collapse them');
      aliases[v.id] = previous.id;
    } else { byRevision.set(key, v); versions.push(v); }
  }
  const publications = Object.entries(c.publications).map(([key, p]) => {
    const [ownerId, idempotencyKey] = key.split(':');
    check(ownerId === p.ownerId, 'publication owner/key mismatch');
    const gift = structuredClone(p.result.gift), version = c.versions[gift.designVersionId];
    check(version && same(gift.documentSnapshot, version.document), 'publication snapshot mismatch');
    gift.designVersionId = aliases[gift.designVersionId] || gift.designVersionId;
    return { ...p, idempotencyKey, gift, version };
  });
  const gifts = [...s.gifts, ...publications.map(p => p.gift)];
  check(new Set(gifts.map(g => g.id)).size === gifts.length, 'duplicate gift identity');
  check(new Set(gifts.map(g => g.slug)).size === gifts.length, 'duplicate gift slug');
  const replies = [...s.replies, ...Object.values(c.replies).flat()];
  const giftIds = new Set(gifts.map(g => g.id));
  for (const r of replies) check(giftIds.has(r.giftId), 'unresolved reply gift');
  for (const g of gifts) {
    check(users.has(g.userId), 'unresolved gift owner');
    check(g.templateId == null || templates.has(g.templateId), 'unresolved gift template');
    check(g.replyCount === replies.filter(r => r.giftId === g.id).length, 'reply count mismatch');
  }
  for (const o of s.orders) {
    check(users.has(o.userId) && templates.has(o.templateId), 'unresolved order dependency');
    check(o.status === 'demo_paid' && o.paymentProvider === 'local_demo_only', 'unsupported order; needs payment-aware import');
    check(o.grossAmount === o.platformFee + o.creatorAmount, 'order amount mismatch');
  }
  const counts = { users: s.users.length, templates: s.templates.length, sessions: s.sessions.length,
    favorites: s.favorites.length, orders: s.orders.length, designs: Object.keys(c.designs).length,
    creates: Object.keys(c.creates).length, mutations: Object.keys(c.mutations).length,
    assets: Object.keys(c.assets).length, versions: versions.length, versionAliases: Object.keys(aliases).length,
    gifts: gifts.length, replies: replies.length, publications: publications.length,
    contexts: Object.keys(c.contexts).length, requests: s.requests.length };
  return { snapshot: s, versions, aliases, publications, gifts, replies, counts, sourceHash: hash(s) };
}

// A versioned canvas backup validates pinned files and publication relations.
// The second copy also retains users, sessions, Creator payloads and legacy media.
export function backupCanvasImport({ root, target, offline = false }) {
  check(offline, 'stop all source writers and pass --offline');
  root = path.resolve(root); target = path.resolve(target);
  check(!fs.existsSync(target), 'backup destination must not exist');
  check(target !== root && !root.startsWith(target + path.sep), 'invalid backup destination');
  const snapshot = readCanvasSnapshot(root), plan = planCanvasImport(snapshot);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  exportCanvas({ source: path.join(root, 'services/designs/data'), target: path.join(target, 'canvas'), offline: true });
  for (const service of ['identity', 'catalog', 'checkout', 'gifts', 'designs', 'support']) {
    const source = path.join(root, 'services', service, 'data');
    if (fs.existsSync(source)) fs.cpSync(source, path.join(target, 'services', service, 'data'), { recursive: true,
      filter: entry => { check(!fs.lstatSync(entry).isSymbolicLink(), 'linked source data refused'); return true; } });
  }
  if (fs.existsSync(path.join(root, '.env'))) fs.copyFileSync(path.join(root, '.env'), path.join(target, '.env'));
  const files = {};
  function inventory(dir) { for (const name of fs.readdirSync(dir)) { const f = path.join(dir, name);
    if (fs.statSync(f).isDirectory()) inventory(f); else files[path.relative(target, f).replaceAll(path.sep, '/')] = sha(fs.readFileSync(f)); } }
  inventory(target);
  check(same(readCanvasSnapshot(root), snapshot), 'source changed while backing up');
  check(same(readCanvasSnapshot(target), snapshot), 'backup differs from source');
  verifyCanvas({ source: path.join(target, 'canvas') });
  fs.writeFileSync(path.join(target, 'import-manifest.json'), json({ formatVersion: 1, sourceHash: plan.sourceHash, files, counts: plan.counts }, null, 2));
  return plan;
}

async function insert(tx, table, columns, values) {
  check(values.every(v => v !== undefined), `undefined value for ${table}`);
  await tx.execute(`INSERT INTO ${table} (${columns}) VALUES (${values.map(() => '?').join(',')})`, values);
}

export async function applyCanvasImport(plan, client, { label, beforeCommit = async () => {} } = {}) {
  const s = plan.snapshot, c = s.canvas;
  check(label && label.length <= 160, 'source label required');
  return client.withTransaction(async tx => {
    const [allTables] = await tx.execute('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=DATABASE()');
    for (const { name } of allTables) {
      if (['schema_migrations', 'schema_migration_pending'].includes(name)) continue;
      check(/^[a-z_]+$/.test(name), 'unexpected table name');
      const [[row]] = await tx.execute(`SELECT COUNT(*) n FROM ${name}`);
      check(Number(row.n) === 0, `target ${name} is not empty; refusing overwrite`);
    }
    for (const u of s.users) await insert(tx, 'users', 'id,provider,provider_id,name,email,password_hash,avatar,role,created_at,legacy_payload',
      [u.id, u.provider, u.providerId, u.name, u.email || null, u.passwordHash || null, u.avatar || null, u.role, date(u.createdAt), json(u)]);
    for (const t of s.templates) await insert(tx, 'templates', 'id,creator_id,title,style,theme,price_vnd,status,created_at,payload',
      [t.id, t.creatorId && t.creatorId !== 'system' ? t.creatorId : null, t.title, t.style, t.theme, t.price, t.status, date(t.createdAt), json(t)]);
    for (const v of s.sessions) await insert(tx, 'sessions', 'id,user_id,expires_at', [v.id, v.userId, date(new Date(v.exp * 1000).toISOString())]);
    for (const f of s.favorites) await insert(tx, 'favorites', 'user_id,template_id,created_at', [f.userId, f.templateId, date(f.createdAt)]);
    for (const o of s.orders) {
      await insert(tx, 'orders', 'id,user_id,template_id,gross_vnd,platform_fee_vnd,creator_amount_vnd,currency,status,payment_provider,is_test,created_at,payload',
        [o.id, o.userId, o.templateId, o.grossAmount, o.platformFee, o.creatorAmount, o.currency, o.status, o.paymentProvider, 1, date(o.createdAt), json(o)]);
      await insert(tx, 'demo_purchases', 'user_id,template_id,order_id,created_at', [o.userId, o.templateId, o.id, date(o.createdAt)]);
      await insert(tx, 'template_entitlements', 'id,user_id,template_id,order_id,granted_at', [randomUUID(), o.userId, o.templateId, o.id, date(o.createdAt)]);
    }
    for (const d of Object.values(c.designs)) await insert(tx, 'designs',
      'id,owner_id,title,source_kind,template_id,template_version_id,provenance,policy,revision,schema_version,document,document_hash,created_at,updated_at,archived_at',
      [d.id, d.ownerId, d.title, d.source.kind, d.source.templateId || null, d.source.templateVersionId || null, json(d.provenance), json(d.policy),
        d.revision, d.schemaVersion, json(d.document), d.documentHash, date(d.createdAt), date(d.updatedAt), date(d.archivedAt)]);
    for (const a of Object.values(c.assets)) await insert(tx, 'design_assets',
      'id,owner_id,design_id,status,mime,bytes,width,height,content_hash,storage_key,created_at',
      [a.id, a.ownerId, a.designId, a.status, a.mime, a.bytes, a.width, a.height, a.contentHash, a.storageKey, date(a.createdAt)]);
    for (const d of Object.values(c.designs)) for (const id of assetIds(d.document))
      await insert(tx, 'design_asset_refs', 'design_id,asset_id', [d.id, id]);
    for (const [key, value] of Object.entries(c.creates)) {
      const [ownerId, mutationId] = key.split(':');
      await insert(tx, 'design_create_requests', 'owner_id,mutation_id,request_hash,design_id', [ownerId, mutationId, value.requestHash, value.result.design.id]);
    }
    for (const [key, value] of Object.entries(c.mutations)) {
      const [id, mutationId] = key.split(':');
      await insert(tx, 'design_mutations', 'design_id,owner_id,mutation_id,request_hash,response',
        [id, c.designs[id].ownerId, mutationId, value.requestHash, json(value.result)]);
    }
    for (const v of plan.versions) await insert(tx, 'design_versions',
      'id,design_id,revision,schema_version,runtime_version,document_hash,document,created_at',
      [v.id, v.designId, v.revision, v.schemaVersion, v.runtimeVersion, v.documentHash, json(v.document), date(v.createdAt)]);
    for (const g of plan.gifts) await insert(tx, 'gifts',
      'id,slug,user_id,template_id,recipient_name,sender_name,message,image_file,reply_count,created_at,expires_at,payload,source_kind,design_version_id',
      [g.id, g.slug, g.userId, g.templateId || null, g.recipientName, g.senderName, g.message, g.imageFile || null, g.replyCount,
        date(g.createdAt), date(g.expiresAt), json(g), g.sourceKind || 'legacy', g.designVersionId || null]);
    for (const r of plan.replies) await insert(tx, 'gift_replies', 'id,gift_id,name,message,created_at,read_status',
      [r.id, r.giftId, r.name, r.message, date(r.createdAt), r.readStatus ?? null]);
    for (const p of plan.publications) {
      for (const id of p.assetIds) await insert(tx, 'gift_asset_refs', 'gift_id,asset_id', [p.gift.id, id]);
      await insert(tx, 'gift_publication_requests', 'owner_id,idempotency_key,request_hash,design_id,design_revision,gift_id,created_at',
        [p.ownerId, p.idempotencyKey, p.requestHash, p.version.designId, p.result.publishedRevision, p.gift.id, date(p.gift.createdAt)]);
    }
    for (const v of Object.values(c.contexts)) await insert(tx, 'checkout_design_contexts',
      'context_id,owner_id,order_id,design_id,design_revision,document_hash,template_id,template_version_id,mutation_id,request_hash,created_at',
      [v.contextId, v.ownerId, v.orderId, v.designId, v.designRevision, v.documentHash, v.source.templateId, v.source.templateVersionId,
        v.mutationId, v.requestHash, date(v.createdAt)]);
    const users = new Set(s.users.map(u => u.id));
    for (const r of s.requests) await insert(tx, 'support_requests',
      'id,code,user_id,legacy_user_id,name,email,topic,message,status,created_at,report_kind,report_target,assigned_to,resolution',
      [r.id, r.code, users.has(r.userId) ? r.userId : null, users.has(r.userId) ? null : r.userId || null,
        r.name, r.email, r.topic, r.message, r.status, date(r.createdAt), r.reportKind || null, r.reportTarget || null, r.assignedTo || null, r.resolution || null]);
    await insert(tx, 'json_storage_imports', 'id,source_label,source_hash,source_snapshot,version_aliases,counts',
      [randomUUID(), label, plan.sourceHash, json(s), json(plan.aliases), json(plan.counts)]);
    await verifyCanvasImport(plan, tx);
    await beforeCommit();
    return plan.counts;
  });
}

export async function verifyCanvasImport(plan, client) {
  const c = plan.snapshot.canvas;
  const [draftRows] = await client.execute('SELECT * FROM designs');
  check(draftRows.length === plan.counts.designs, 'draft count mismatch');
  for (const row of draftRows) check(same(designFromRow(row), c.designs[row.id]), 'draft round-trip mismatch');
  const [assetRows] = await client.execute('SELECT * FROM design_assets');
  check(assetRows.length === plan.counts.assets, 'asset count mismatch');
  for (const row of assetRows) check(same(assetFromRow(row), c.assets[row.id]), 'asset round-trip mismatch');
  const [versions] = await client.execute('SELECT * FROM design_versions');
  check(versions.length === plan.counts.versions, 'version count mismatch');
  for (const row of versions) {
    const expected = c.versions[row.id];
    check(expected && same(jsonValue(row.document), expected.document) && row.document_hash === expected.documentHash, 'snapshot round-trip mismatch');
  }
  const [gifts] = await client.execute('SELECT id,payload FROM gifts');
  check(gifts.length === plan.gifts.length, 'gift count mismatch');
  for (const row of gifts) check(same(jsonValue(row.payload), plan.gifts.find(g => g.id === row.id)), 'gift payload mismatch');
  for (const [table, field, expected] of [['users', 'legacy_payload', plan.snapshot.users], ['templates', 'payload', plan.snapshot.templates], ['orders', 'payload', plan.snapshot.orders]]) {
    const [rows] = await client.execute(`SELECT id,${field} AS payload FROM ${table}`);
    check(rows.length === expected.length, `${table} count mismatch`);
    for (const row of rows) check(same(jsonValue(row.payload), expected.find(v => v.id === row.id)), `${table} payload mismatch`);
  }
  const countMap = { design_create_requests: 'creates', design_mutations: 'mutations', sessions: 'sessions', favorites: 'favorites',
    gift_replies: 'replies', gift_publication_requests: 'publications', checkout_design_contexts: 'contexts', support_requests: 'requests' };
  for (const [table, key] of Object.entries(countMap)) {
    const [[row]] = await client.execute(`SELECT COUNT(*) n FROM ${table}`); check(Number(row.n) === plan.counts[key], `${table} count mismatch`);
  }
  const [sessionRows] = await client.execute('SELECT id,user_id,expires_at FROM sessions');
  for (const row of sessionRows) {
    const v = plan.snapshot.sessions.find(v => v.id === row.id);
    check(v?.userId === row.user_id && iso(row.expires_at) === new Date(v.exp * 1000).toISOString(), 'session round-trip mismatch');
  }
  const [replyRows] = await client.execute('SELECT * FROM gift_replies');
  for (const row of replyRows) {
    const v = plan.replies.find(v => v.id === row.id);
    check(v && same({ id: row.id, giftId: row.gift_id, name: row.name, message: row.message, createdAt: iso(row.created_at), readStatus: row.read_status },
      { ...v, readStatus: v.readStatus ?? null }), 'reply round-trip mismatch');
  }
  const [createRows] = await client.execute('SELECT owner_id,mutation_id,request_hash,design_id FROM design_create_requests');
  for (const row of createRows) {
    const v = c.creates[`${row.owner_id}:${row.mutation_id}`];
    check(v?.requestHash === row.request_hash && v.result.design.id === row.design_id, 'create replay mismatch');
  }
  const [mutationRows] = await client.execute('SELECT design_id,owner_id,mutation_id,request_hash,response FROM design_mutations');
  for (const row of mutationRows) {
    const v = c.mutations[`${row.design_id}:${row.mutation_id}`];
    check(v?.requestHash === row.request_hash && c.designs[row.design_id].ownerId === row.owner_id && same(v.result, jsonValue(row.response)), 'mutation replay mismatch');
  }
  const [supportRows] = await client.execute('SELECT * FROM support_requests');
  for (const row of supportRows) {
    const v = plan.snapshot.requests.find(v => v.id === row.id);
    check(v && row.code === v.code && (row.user_id || row.legacy_user_id) === (v.userId || null) &&
      row.name === v.name && row.email === v.email && row.topic === v.topic && row.message === v.message && row.status === v.status &&
      iso(row.created_at) === v.createdAt && row.report_kind === (v.reportKind || null) && row.report_target === (v.reportTarget || null) &&
      row.assigned_to === (v.assignedTo || null) && row.resolution === (v.resolution || null), 'support round-trip mismatch');
  }
  for (const [table, owner, expected] of [['design_asset_refs', 'design_id', Object.values(c.designs).flatMap(d => assetIds(d.document).map(id => [d.id, id]))],
    ['gift_asset_refs', 'gift_id', plan.publications.flatMap(p => p.assetIds.map(id => [p.gift.id, id]))]]) {
    const [rows] = await client.execute(`SELECT ${owner} AS owner,asset_id FROM ${table}`);
    check(same(rows.map(r => `${r.owner}:${r.asset_id}`).sort(), expected.map(([a, b]) => `${a}:${b}`).sort()), `${table} pins mismatch`);
  }
  const [[receipt]] = await client.execute('SELECT source_hash,source_snapshot,version_aliases FROM json_storage_imports WHERE source_hash=?', [plan.sourceHash]);
  check(receipt && same(jsonValue(receipt.source_snapshot), plan.snapshot) && same(jsonValue(receipt.version_aliases), plan.aliases), 'lossless source archive mismatch');
  return plan.counts;
}

const running = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (running) {
  const { values } = parseArgs({ options: { root: { type: 'string' }, backup: { type: 'string' },
    offline: { type: 'boolean' }, apply: { type: 'boolean' } } });
  check(values.root && values.backup && values.offline, 'use --root PATH --backup NEW_PATH --offline [--apply]');
  const plan = backupCanvasImport({ root: values.root, target: values.backup, offline: values.offline });
  console.log('Verified offline backup:', plan.counts);
  if (values.apply) {
    const client = new MySqlClient();
    try { await applyCanvasImport(plan, client, { label: path.basename(path.resolve(values.root)),
      beforeCommit: async () => check(hash(readCanvasSnapshot(values.root)) === plan.sourceHash, 'source changed before commit') });
      await verifyCanvasImport(plan, client); console.log('MySQL import and read-back verified.'); }
    finally { await client.close(); }
  }
}
