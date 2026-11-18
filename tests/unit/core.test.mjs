import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { signSession, verifySession, sanitizeText, randomId } from '../../src/shared/security.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { templates } from '../../src/modules/catalog/seed.mjs';

const key = 'test-secret-this-secret-is-not-for-production';
test('JWT: ký và xác minh đúng thông tin', () => {
  const signed = signSession({ id:'123', role:'sender', name:'Khánh' }, key);
  const data = verifySession(signed, key);
  assert.equal(data.sub, '123');
  assert.equal(data.role, 'sender');
});
test('JWT: từ chối token bị sửa hoặc sai khóa', () => {
  const signed = signSession({ id:'123', role:'sender', name:'Khánh' }, key);
  assert.equal(verifySession(signed, 'wrong-key'), null);
  assert.equal(verifySession(signed + 'modified', key), null);
  assert.equal(verifySession('bad-token', key), null);
});
test('Validation: không nhận nội dung trống hoặc vượt giới hạn', () => {
  assert.throws(() => sanitizeText('   ', 20));
  assert.throws(() => sanitizeText('abc'.repeat(30), 20));
  assert.equal(sanitizeText('  Chúc mừng  ', 30), 'Chúc mừng');
});
test('ID: tạo slug đủ độ dài và URL-safe', () => {
  assert.match(randomId(24), /^[A-Za-z0-9_-]{32}$/);
});
test('Dữ liệu mẫu: 24 mẫu, giá nguyên không âm, không lặp ID', () => {
  assert.equal(templates.length, 24);
  assert.equal(new Set(templates.map(t => t.id)).size, templates.length);
  for (const template of templates) {
    assert(Number.isInteger(template.price) && template.price >= 0);
    assert.equal(template.status, 'published');
  }
});
test('Repository: lưu và sửa dữ liệu đúng, tách biệt nơi lưu trữ', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-repo-'));
  try {
    const repository = new JsonRepository(path.join(dir, 'test.json'));
    repository.insert({id:'a', name:'Đầu tiên'});
    assert.equal(repository.get('a').name, 'Đầu tiên');
    repository.update('a', {name:'Đã chỉnh sửa'});
    const reopened = new JsonRepository(path.join(dir, 'test.json'));
    assert.equal(reopened.get('a').name, 'Đã chỉnh sửa');
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
