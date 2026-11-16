import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../services/shared/rate-limit.mjs';

test('Rate limit tách từng key và phục hồi đúng cửa sổ thời gian', t => {
  let now = 0;
  const limiter = new RateLimiter({limit:3,windowMs:60_000,now:()=>now});
  t.after(() => limiter.close());
  // Chọn một danh tính nằm ở shard khác để kiểm tra tính độc lập.
  let other = 'gift:ip-b';
  while (limiter.bucketFor(other) === limiter.bucketFor('gift:ip-a')) other += 'b';
  assert.equal(limiter.consume('gift:ip-a'), true);
  now = 10_000;
  assert.equal(limiter.consume('gift:ip-a'), true);
  assert.equal(limiter.consume('gift:ip-a'), true);
  assert.equal(limiter.consume('gift:ip-a'), false);
  assert.equal(limiter.consume(other), true);
  now = 60_000;
  assert.equal(limiter.consume('gift:ip-a'), true);
  assert.equal(limiter.consume('gift:ip-a'), false);
  now = 120_000;
  limiter.prune();
  assert.equal(limiter.buckets.size, 0);
});

test('Va chạm shard chia sẻ quota và không reset hạn mức bằng key mới', t => {
  let now = 0;
  const limiter = new RateLimiter({limit:1,windowMs:600_000,maxKeys:1,now:()=>now});
  t.after(() => limiter.close());
  assert.equal(limiter.consume('a'), true);
  assert.equal(limiter.consume('b'), false);
  assert.equal(limiter.consume('c'), false);
  assert.equal(limiter.consume('a'), false);
  assert.equal(limiter.buckets.size, 1);
  now = 600_000;
  assert.equal(limiter.consume('c'), true);
  assert.equal(limiter.buckets.size, 1);
});

test('Nhiều danh tính không làm tăng bộ nhớ vượt số shard', t => {
  const limiter = new RateLimiter({limit:5,windowMs:60_000,maxKeys:8});
  t.after(() => limiter.close());
  for (let i=0; i<10_000; i++) limiter.consume(`ip-${i}`);
  assert(limiter.buckets.size <= 8);
  assert([...limiter.buckets.values()].every(timestamps => timestamps.length <= 5));
});
