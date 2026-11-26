import { performance } from 'node:perf_hooks';

const groups = ['identity', 'catalog', 'checkout', 'gifts', 'support', 'designs', 'static', 'other'];
const operations = ['query', 'transaction'];
const bounds = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const round = value => Math.round(value * 100) / 100;

export function performanceInterval(env = process.env) {
  const value = env.MOMEVIA_PERF_INTERVAL_MS;
  if (value == null || value === '' || value === '0') return 0;
  const ms = Number(value);
  if (!Number.isSafeInteger(ms) || ms < 30000 || ms > 3600000)
    throw new Error('MOMEVIA_PERF_INTERVAL_MS phải bằng 0 hoặc từ 30000 đến 3600000.');
  return ms;
}

// Histogram cố định: không lưu từng request, URL hoặc câu SQL.
function histogram() {
  const counts = Array(bounds.length + 1).fill(0);
  let count = 0, total = 0, max = 0;
  return {
    add(ms) {
      count++; total += ms; max = Math.max(max, ms);
      const index = bounds.findIndex(bound => ms <= bound);
      counts[index < 0 ? bounds.length : index]++;
    },
    report() {
      function percentile(q) {
        if (!count) return null;
        let cumulative = 0;
        for (let i = 0; i < counts.length; i++) {
          cumulative += counts[i];
          if (cumulative >= Math.ceil(count * q)) return bounds[i] ?? Math.ceil(max);
        }
        return null;
      }
      return { count, meanMs: count ? round(total / count) : null,
        maxMs: count ? round(max) : null, p50UpperMs: percentile(.5),
        p95UpperMs: percentile(.95), p99UpperMs: percentile(.99) };
    }
  };
}

const httpWindow = () => Object.fromEntries(groups.map(group => [group, {
  duration: histogram(), status: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 }, aborted: 0
}]));
const dbWindow = () => Object.fromEntries(operations.map(kind => [kind, { duration: histogram(), errors: 0 }]));

export function createPerformanceMonitor({ intervalMs = 0, emit = report => console.log(JSON.stringify(report)),
  now = () => performance.now(), cpu = () => process.cpuUsage(), memory = () => process.memoryUsage(),
  elu = () => performance.eventLoopUtilization(), schedule = setInterval, cancel = clearInterval } = {}) {
  if (!intervalMs) return null;
  performanceInterval({ MOMEVIA_PERF_INTERVAL_MS: String(intervalMs) });
  let http = httpWindow(), db = dbWindow(), inFlight = 0, peakHttp = 0, peakDb = 0;
  let timer = null, stopped = false, previous;
  function sample() { return { time: now(), cpu: cpu(), elu: elu() }; }
  function observeResponse(res) {
    if (stopped || timer === null) return () => {};
    const start = now();
    let group = 'other', finished = false;
    peakHttp = Math.max(peakHttp, ++inFlight);
    function settle(aborted) {
      if (finished) return;
      finished = true;
      res.removeListener('finish', finish);
      res.removeListener('close', close);
      inFlight--;
      if (stopped) return;
      const item = http[group];
      if (aborted) { item.aborted++; return; }
      const family = `${Math.floor(res.statusCode / 100)}xx`;
      item.status[Object.hasOwn(item.status, family) ? family : 'other']++;
      item.duration.add(Math.max(0, now() - start));
    }
    const finish = () => settle(false);
    const close = () => settle(!res.writableFinished);
    res.once('finish', finish);
    res.once('close', close);
    return name => { if (groups.includes(name)) group = name; };
  }
  function observeDb(kind, active) {
    if (stopped || timer === null || !operations.includes(kind)) return () => {};
    peakDb = Math.max(peakDb, active);
    const start = now();
    let done = false;
    return failed => {
      if (done || stopped) return;
      done = true;
      const item = db[kind];
      item.duration.add(Math.max(0, now() - start));
      if (failed) item.errors++;
    };
  }
  function publish(getDbActive) {
    if (stopped) return;
    const next = sample();
    const elapsed = next.time - previous.time;
    if (elapsed <= 0) return;
    const usage = memory();
    const active = next.elu.active - previous.elu.active;
    const idle = next.elu.idle - previous.elu.idle;
    const dbActive = getDbActive();
    const report = { event: 'momevia.performance', windowMs: round(elapsed),
      process: { cpuCorePercent: round((next.cpu.user - previous.cpu.user + next.cpu.system - previous.cpu.system) / (elapsed * 10)),
        rssBytes: usage.rss, heapUsedBytes: usage.heapUsed, externalBytes: usage.external,
        eventLoopUtilization: active + idle > 0 ? round(active / (active + idle)) : null },
      http: { inFlight, peakInFlight: peakHttp, groups: Object.fromEntries(groups.map(name => {
        const item = http[name];
        return [name, { ...item.duration.report(), status: item.status, aborted: item.aborted }];
      })) },
      mysql: { activeOperations: dbActive, peakActiveOperations: peakDb,
        operations: Object.fromEntries(operations.map(name => [name, { ...db[name].duration.report(), errors: db[name].errors }])) } };
    // Reset theo cửa sổ; thao tác hoàn thành muộn được tính vào cửa sổ hoàn thành.
    previous = next; http = httpWindow(); db = dbWindow(); peakHttp = inFlight; peakDb = dbActive;
    emit(report);
  }
  return {
    observeResponse, observeDb,
    start(getDbActive = () => 0) {
      if (timer !== null || stopped) return;
      previous = sample();
      timer = schedule(() => {
        // Giám sát không được làm dừng ứng dụng khi lỗi xuất log.
        try { publish(getDbActive); } catch { /* Không xuất dữ liệu lỗi hoặc cấu hình. */ }
      }, intervalMs);
      timer?.unref?.();
    },
    stop() {
      stopped = true;
      if (timer !== null) cancel(timer);
      timer = null;
    }
  };
}
