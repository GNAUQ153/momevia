import { canvasError } from './errors.mjs';

// Tách tác vụ đang xử lý khỏi cache kết quả để không render trùng khi LRU đầy.
export function createThumbnailCache({ render, concurrency = 2, maxJobs = 34,
  maxInputBytes = 32 * 1024 * 1024, maxEntries = 128, maxCacheBytes = 16 * 1024 * 1024 }) {
  for (const value of [concurrency, maxJobs, maxInputBytes, maxEntries, maxCacheBytes]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('Giới hạn thumbnail phải là số nguyên dương.');
  }
  if (concurrency > maxJobs) throw new RangeError('Số render đồng thời vượt giới hạn tác vụ.');
  const pending = new Map();
  const cache = new Map();
  const queue = [];
  let active = 0;
  let inputBytes = 0;
  let cacheBytes = 0;

  function remember(job, bytes) {
    // Ảnh lớn hơn ngân sách vẫn được trả về nhưng không giữ trong cache.
    if (bytes.length > maxCacheBytes) return;
    cache.set(job.key, { promise: job.promise, size: bytes.length });
    cacheBytes += bytes.length;
    while (cache.size > maxEntries || cacheBytes > maxCacheBytes) {
      const oldest = cache.keys().next().value;
      cacheBytes -= cache.get(oldest).size;
      cache.delete(oldest);
    }
  }

  async function run(job) {
    try {
      const bytes = await Promise.resolve().then(() => render(job.source, job.width));
      remember(job, bytes);
      job.resolve(bytes);
    } catch (error) {
      job.reject(error);
    } finally {
      pending.delete(job.key);
      inputBytes -= job.size;
      active--;
      pump();
    }
  }

  function pump() {
    while (active < concurrency && queue.length) {
      active++;
      void run(queue.shift());
    }
  }

  function get(key, source, width) {
    if (pending.has(key)) return pending.get(key);
    if (cache.has(key)) {
      const entry = cache.get(key);
      cache.delete(key);
      cache.set(key, entry);
      return entry.promise;
    }
    const size = Buffer.byteLength(source);
    if (size > maxInputBytes) return Promise.reject(canvasError(413, 'COVER_RENDER_TOO_LARGE', 'Cover image is too large to render.'));
    if (pending.size >= maxJobs || inputBytes + size > maxInputBytes) {
      return Promise.reject(canvasError(503, 'COVER_RENDER_BUSY', 'Cover rendering is busy. Please try again.'));
    }
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    pending.set(key, promise);
    inputBytes += size;
    queue.push({ key, source, width, size, promise, resolve, reject });
    pump();
    return promise;
  }

  return { get };
}
