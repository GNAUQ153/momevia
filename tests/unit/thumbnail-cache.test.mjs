import test from 'node:test';
import assert from 'node:assert/strict';
import { createThumbnailCache } from '../../src/modules/designs/thumbnail-cache.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const calls = [];
  const cache = createThumbnailCache({ ...options, render: (source, width) => new Promise((resolve, reject) => {
    calls.push({ source, width, resolve, reject });
  }) });
  return { calls, get: cache.get };
}

test('Giới hạn render đồng thời, giữ FIFO và dùng chung promise đang chờ', async () => {
  const { calls, get } = fixture({ concurrency: 2, maxJobs: 4 });
  const a = get('a', 'a', 192), b = get('b', 'b', 320), c = get('c', 'c', 480), d = get('d', 'd', 640);
  assert.equal(get('c', 'c', 480), c);
  await assert.rejects(get('e', 'e', 192), { status: 503, code: 'COVER_RENDER_BUSY' });
  await tick();
  assert.deepEqual(calls.map(x => x.source), ['a', 'b']);
  calls[1].resolve(Buffer.from('b')); await b; await tick();
  assert.deepEqual(calls.map(x => x.source), ['a', 'b', 'c']);
  calls[0].resolve(Buffer.from('a')); await a; await tick();
  assert.deepEqual(calls.map(x => x.width), [192, 320, 480, 640]);
  calls[2].resolve(Buffer.from('c')); calls[3].resolve(Buffer.from('d')); await Promise.all([c, d]);
});

test('Ngân sách input tính cả tác vụ đang chạy và hàng đợi, được hoàn trả sau lỗi', async () => {
  const { calls, get } = fixture({ concurrency: 1, maxJobs: 5, maxInputBytes: 8 });
  const a = get('a', Buffer.alloc(4), 192), b = get('b', 'ế', 192);
  await assert.rejects(get('too-big', Buffer.alloc(9), 192), { status: 413 });
  await assert.rejects(get('c', '12', 192), { status: 503 });
  const failed = assert.rejects(a, /render fail/);
  await tick(); calls[0].reject(new Error('render fail')); await failed;
  const c = get('c', '12', 192);
  await tick(); calls[1].resolve(Buffer.from('b')); await b; await tick();
  calls[2].resolve(Buffer.from('c')); await c;
});

test('LRU tính dung lượng Buffer, chạm cache không render lại', async () => {
  let renders = 0;
  const { get } = createThumbnailCache({ maxEntries: 5, maxCacheBytes: 6, render: async source => {
    renders++; return Buffer.from(source);
  } });
  const a = get('a', 'aaa', 192); await a;
  await get('b', 'bbb', 192);
  assert.equal(get('a', 'aaa', 192), a);
  await get('c', 'ccc', 192);
  assert.equal(get('a', 'aaa', 192), a);
  assert.equal(renders, 3);
  await get('b', 'bbb', 192);
  assert.equal(renders, 4);
});

test('Ảnh vượt ngân sách cache vẫn trả kết quả và không giữ lại', async () => {
  let renders = 0;
  const { get } = createThumbnailCache({ maxCacheBytes: 2, render: async () => {
    renders++; return Buffer.from('abc');
  } });
  assert.equal((await get('a', 'a', 192)).length, 3);
  await get('a', 'a', 192);
  assert.equal(renders, 2);
});

test('Cache đầy không loại promise render đang chạy', async () => {
  const { calls, get } = fixture({ concurrency: 2, maxEntries: 1 });
  const a = get('a', 'a', 192), b = get('b', 'b', 192);
  await tick(); calls[1].resolve(Buffer.from('b')); await b;
  const c = get('c', 'c', 192); await tick(); calls[2].resolve(Buffer.from('c')); await c;
  assert.equal(get('a', 'a', 192), a);
  assert.equal(calls.length, 3);
  calls[0].resolve(Buffer.from('a')); await a;
  assert.equal(get('a', 'a', 192), a);
  const rerender = get('c', 'c', 192);
  assert.notEqual(rerender, c);
  await tick(); calls[3].resolve(Buffer.from('c')); await rerender;
});

test('Lỗi đồng bộ không giữ slot hoặc promise lỗi; có thể thử lại', async () => {
  let attempts = 0;
  const { get } = createThumbnailCache({ concurrency: 1, maxJobs: 1, render: () => {
    if (++attempts === 1) throw new Error('sync failure');
    return Buffer.from('ok');
  } });
  await assert.rejects(get('a', 'a', 192), /sync failure/);
  assert.equal((await get('a', 'a', 192)).toString(), 'ok');
  assert.equal(attempts, 2);
});

test('Từ chối cấu hình không hợp lệ', () => {
  for (const options of [{ concurrency: 0 }, { concurrency: 2, maxJobs: 1 }, { maxCacheBytes: Infinity }]) {
    assert.throws(() => createThumbnailCache({ render: () => Buffer.alloc(0), ...options }), RangeError);
  }
});
