import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { FavoritesService } from '../../src/modules/catalog/favorites.service.mjs';

test('Mẫu yêu thích gắn với người dùng và không bị trùng', () => {
  const dirname = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-favorites-'));
  try {
    const service = new FavoritesService(path.join(dirname, 'favorites.json'));
    const sample = randomUUID();
    const published = new Set([sample]);
    service.set('user-a', sample, true, published);
    service.set('user-a', sample, true, published);
    assert.deepEqual(service.list('user-a', published), [sample]);
    assert.deepEqual(service.list('user-b', published), []);
    service.set('user-a', sample, false, published);
    assert.deepEqual(service.list('user-a', published), []);
  } finally {
    fs.rmSync(dirname, {recursive:true, force:true});
  }
});

test('Không được yêu thích mẫu chưa phát hành', () => {
  const dirname = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-favorites-'));
  try {
    const service = new FavoritesService(path.join(dirname, 'favorites.json'));
    assert.throws(() => service.set('user-a','draft-id',true,new Set()), /chưa được phát hành/);
  } finally {
    fs.rmSync(dirname, {recursive:true, force:true});
  }
});
