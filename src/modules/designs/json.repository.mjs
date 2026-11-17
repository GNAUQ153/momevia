import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canvasError, owned } from './errors.mjs';

const empty = () => ({ formatVersion: 1, designs: {}, creates: {}, mutations: {}, assets: {}, contexts: {}, publications: {}, versions: {}, replies: {} });
const clone = value => structuredClone(value);
const processQueues = new Map();

// One process only. A single atomic rename commits document+ACK or publication+pins+result.
// Uncommitted .tmp files are never read. GC is deliberately disabled, so orphan bytes are recoverable.
export class JsonDesignRepository {
  constructor(filepath, { fault = () => {} } = {}) {
    this.filepath = path.resolve(filepath); this.fault = fault;
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    if (!fs.existsSync(filepath)) this.write(empty());
    this.read();
  }
  read() {
    const state = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    if (state.formatVersion !== 1 || !state.designs || !state.publications) throw new Error('Unsupported canvas aggregate; restore a compatible backup.');
    return state;
  }
  write(state) {
    const temporary = `${this.filepath}.${randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, 'wx');
      fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      this.fault('beforeCommit'); fs.renameSync(temporary, this.filepath); this.fault('afterCommit');
    } finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  async exclusive(work) {
    const previous = processQueues.get(this.filepath) || Promise.resolve();
    let release; const current = new Promise(resolve => { release = resolve; }); processQueues.set(this.filepath, current);
    await previous;
    try { return await work(); } finally { release(); if (processQueues.get(this.filepath) === current) processQueues.delete(this.filepath); }
  }
  async change(work) {
    return this.exclusive(async () => { const state = this.read(); const result = await work(state); this.write(state); return clone(result); });
  }
  owner(state, ownerId, id) { const record = state.designs[id]; return owned(record?.ownerId === ownerId ? record : null); }
  replay(record, hash) {
    if (record.requestHash !== hash) throw canvasError(409, 'IDEMPOTENCY_CONFLICT', 'Mã thao tác đã được dùng cho nội dung khác.');
    return { ...clone(record.result), replayed: true };
  }
  async list(ownerId, { offset = 0, limit = 50 } = {}) { return Object.values(this.read().designs).filter(d => d.ownerId === ownerId && !d.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)).slice(offset, offset + limit); }
  async get(ownerId, id) { const d = this.read().designs[id]; return d?.ownerId === ownerId && !d.archivedAt ? clone(d) : null; }
  async findCreate(ownerId, mutationId, requestHash) {
    const record = this.read().creates[`${ownerId}:${mutationId}`];
    return record ? this.replay(record, requestHash) : null;
  }
  async create(ownerId, mutationId, requestHash, record) {
    return this.change(state => {
      const key = `${ownerId}:${mutationId}`;
      if (state.creates[key]) return this.replay(state.creates[key], requestHash);
      const result = { design: record, replayed: false };
      state.designs[record.id] = clone(record); state.creates[key] = { requestHash, result: clone(result) };
      return result;
    });
  }
  async save(ownerId, id, input, validateCurrent) {
    return this.change(state => {
      const current = this.owner(state, ownerId, id); const key = `${id}:${input.mutationId}`;
      if (state.mutations[key]) return this.replay(state.mutations[key], input.requestHash);
      if (current.revision !== input.expectedRevision) throw canvasError(409, 'REVISION_CONFLICT', 'Thiết kế đã thay đổi ở phiên khác. Giữ bản local và tải lại để đối chiếu.', [{ path: 'revision', revision: current.revision }]);
      validateCurrent?.(clone(current));
      for (const assetId of input.assetIds) if (state.assets[assetId]?.ownerId !== ownerId || state.assets[assetId].status !== 'ready') throw canvasError(422, 'ASSET_NOT_READY', 'Ảnh không thuộc tài khoản hoặc chưa sẵn sàng.');
      state.designs[id] = { ...current, title: input.title, document: clone(input.document), documentHash: input.documentHash, revision: current.revision + 1, updatedAt: new Date().toISOString() };
      const result = { designId: id, mutationId: input.mutationId, savedRevision: current.revision + 1, documentHash: input.documentHash, replayed: false };
      state.mutations[key] = { requestHash: input.requestHash, result }; return result;
    });
  }
  async archive(ownerId, id) { return this.change(state => { this.owner(state, ownerId, id).archivedAt = new Date().toISOString(); return { archived: true }; }); }
  async insertAsset(ownerId, designId, asset) {
    return this.change(state => { this.owner(state, ownerId, designId); state.assets[asset.id] = clone(asset); return asset; });
  }
  async getAsset(ownerId, id) { const asset = this.read().assets[id]; return asset?.ownerId === ownerId ? clone(asset) : null; }
  async attachContext(ownerId, orderId, mutationId, requestHash, context) {
    return this.change(state => {
      const previous = Object.values(state.contexts).find(c => c.ownerId === ownerId && c.orderId === orderId && c.mutationId === mutationId);
      if (previous) { if (previous.requestHash !== requestHash) throw canvasError(409, 'IDEMPOTENCY_CONFLICT', 'Context đã dùng cho nội dung khác.'); return { ...previous, replayed: true }; }
      const record = { ...context, ownerId, orderId, mutationId, requestHash }; state.contexts[context.contextId] = record; return { ...record, replayed: false };
    });
  }
  async listContexts(ownerId, orderId) { return Object.values(this.read().contexts).filter(c => c.ownerId === ownerId && c.orderId === orderId); }
  async getContext(ownerId, orderId, id) { const c = this.read().contexts[id]; return c?.ownerId === ownerId && c.orderId === orderId ? c : null; }
  async publish(ownerId, request, requestHash, build) {
    return this.change(async state => {
      const key = `${ownerId}:${request.idempotencyKey}`;
      if (state.publications[key]) return this.replay(state.publications[key], requestHash);
      const design = this.owner(state, ownerId, request.designId);
      if (design.revision !== request.expectedRevision || design.documentHash !== request.expectedDocumentHash) throw canvasError(409, 'REVISION_CONFLICT', 'Thiết kế đã thay đổi. Xem lại trước khi xuất bản.');
      const { gift, version, assetIds } = await build({ design: clone(design), getAsset: async id => clone(state.assets[id] || null) });
      const result = { gift, publishedRevision: design.revision, replayed: false };
      state.versions[version.id] = clone(version);
      state.publications[key] = { ownerId, requestHash, assetIds, result: clone(result) };
      return result;
    });
  }
  async findBySlug(slug) { const p = Object.values(this.read().publications).find(p => p.result.gift.slug === slug); return p ? clone(p.result.gift) : null; }
  async listForUser(ownerId) { return Object.values(this.read().publications).filter(p => p.ownerId === ownerId).map(p => clone(p.result.gift)); }
  async repliesForGift(giftId) { return clone(this.read().replies[giftId] || []); }
  async addReply(giftId, reply) {
    return this.change(state => {
      const p = Object.values(state.publications).find(p => p.result.gift.id === giftId);
      if (!p) throw canvasError(404, 'GIFT_NOT_FOUND', 'Không tìm thấy quà.');
      if (new Date(p.result.gift.expiresAt) < new Date()) throw canvasError(410, 'GIFT_EXPIRED', 'Món quà đã hết thời gian hoạt động.');
      (state.replies[giftId] ||= []).push(clone(reply)); p.result.gift.replyCount = state.replies[giftId].length; return reply;
    });
  }
}
