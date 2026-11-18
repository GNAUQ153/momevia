import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canvasProfile } from '../../src/modules/designs/app.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { revision } from '../../src/modules/designs/errors.mjs';

test('canvas profile rejects mixed publication stores; free MySQL does not require SQL checkout', () => {
  assert.equal(canvasProfile({}).supported, true);
  assert.equal(canvasProfile({ GIFTS_STORAGE: 'mysql' }).supported, false);
  const profile = canvasProfile({ DESIGNS_STORAGE: 'mysql', IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', GIFTS_STORAGE: 'mysql' });
  assert.equal(profile.supported, true); assert.equal(profile.checkoutMode, 'json');
});
test('revision API range matches the MySQL unsigned INT column', () => {
  assert.equal(revision(0xFFFFFFFF), 0xFFFFFFFF);
  for (const value of [0, -1, 0x100000000, Infinity, NaN, 1.5]) assert.throws(() => revision(value), { status: 422, code: 'INVALID_REVISION' });
});
test('public catalog projects metadata and never spreads private future payload fields', async () => {
  const record = { id: 'seed', title: 'Mẫu', status: 'published', price: 0, creatorId: 'private-owner', policy: { secret: 1 }, storageKey: 'private.png', document: { binding: 'PII' } };
  const service = new CatalogService({ async all() { return [record]; }, async get() { return record; } });
  assert.deepEqual(await service.publicList(), [{ id: 'seed', title: 'Mẫu', price: 0, status: 'published',
    personalization: { bindings: ['recipientName', 'message', 'senderName'], photoFrames: 0, layout: true } }]);
  assert.deepEqual(await service.publicOne('seed'), (await service.publicList())[0]);
});
test('JSON process critical section serializes separate adapters sharing an aggregate', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-queue-'));
  try {
    const a = new JsonDesignRepository(path.join(root, 'canvas.json')), b = new JsonDesignRepository(path.join(root, '.', 'canvas.json'));
    const owner = randomUUID();
    await Promise.all([a.change(async state => { await new Promise(resolve => setTimeout(resolve, 15)); state.designs.a = { ownerId: owner }; return true; }), b.change(state => { state.designs.b = { ownerId: owner }; return true; })]);
    assert.deepEqual(Object.keys(a.read().designs).sort(), ['a', 'b']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
