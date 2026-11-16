import { createHmac, randomBytes } from 'node:crypto';

// Sliding window theo tiến trình, phân key vào số shard cố định bằng hash có khóa.
// Va chạm chia sẻ quota theo hướng bảo thủ; không xóa quota còn hiệu lực hoặc
// từ chối mọi key mới chỉ vì số lượng danh tính đã chạm ngưỡng.
export class RateLimiter {
  constructor({ limit, windowMs, maxKeys = 10_000, now = Date.now }) {
    for (const value of [limit, windowMs, maxKeys]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Giới hạn phải là số nguyên dương.');
    }
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
    this.now = now;
    this.buckets = new Map();
    this.seed = randomBytes(32);
    this.timer = setInterval(() => this.prune(), Math.min(windowMs, 60_000));
    this.timer.unref();
  }

  consume(key) {
    key = this.bucketFor(key);
    const now = this.now();
    const recent = (this.buckets.get(key) || []).filter(time => now - time < this.windowMs);
    if (recent.length >= this.limit) return false;
    recent.push(now);
    this.buckets.set(key, recent);
    return true;
  }

  bucketFor(key) {
    return createHmac('sha256', this.seed).update(String(key)).digest().readUInt32BE(0) % this.maxKeys;
  }

  prune(now = this.now()) {
    for (const [key, timestamps] of this.buckets) {
      const recent = timestamps.filter(time => now - time < this.windowMs);
      if (recent.length) this.buckets.set(key, recent);
      else this.buckets.delete(key);
    }
  }

  close() { clearInterval(this.timer); }
}
