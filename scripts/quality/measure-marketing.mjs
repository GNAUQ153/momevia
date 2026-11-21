#!/usr/bin/env node
// Đo hiệu năng phòng lab của trang chủ trên local; không dùng analytics từ bên thứ ba.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { marketingLabWarnings, normalizeMarketingMetrics } from './marketing-metrics.mjs';

const url = new URL(process.env.MOMEVIA_PERF_URL || 'http://127.0.0.1:4100/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
  throw new Error('Chỉ đo URL local (127.0.0.1/localhost/::1) để tránh gửi yêu cầu tới môi trường production.');
}
url.pathname = '/';
url.search = '';
url.hash = '';

const cases = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];
const result = { kind: 'local-lab', generatedAt: new Date().toISOString(), url: url.origin, samples: [] };
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
try {
  for (const locale of ['vi', 'en']) {
    for (const viewport of cases) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'no-preference',
        serviceWorkers: 'block',
      });
      try {
        // Observer được đăng ký trước khi ứng dụng chạy để không bỏ sót FCP/LCP/CLS.
        await context.addInitScript(language => {
          try { globalThis.localStorage.setItem('momevia-locale', language); } catch { /* Có thể bị chặn. */ }
          const state = { lcpMs: null, cls: 0, longTaskBlockingMs: 0 };
          globalThis.__momeviaLocalLab = state;
          const observe = (type, onEntry) => {
            try {
              const observer = new globalThis.PerformanceObserver(list => list.getEntries().forEach(onEntry));
              observer.observe({ type, buffered: true });
            } catch { /* Một số trình duyệt không cung cấp loại entry này. */ }
          };
          observe('largest-contentful-paint', entry => { state.lcpMs = entry.startTime; });
          observe('layout-shift', entry => { if (!entry.hadRecentInput) state.cls += entry.value; });
          observe('longtask', entry => { state.longTaskBlockingMs += Math.max(0, entry.duration - 50); });
        }, locale);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!response?.ok()) throw new Error(`Trang chủ trả HTTP ${response?.status() || 'unknown'}`);
        await page.locator('.mkt-hero h1').waitFor({ state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1600);
        const measured = await page.evaluate(() => {
          const navigation = globalThis.performance.getEntriesByType('navigation')[0];
          const paint = globalThis.performance.getEntriesByName('first-contentful-paint')[0];
          const lab = globalThis.__momeviaLocalLab || {};
          const html = globalThis.document.documentElement;
          return {
            ttfbMs: navigation ? navigation.responseStart - navigation.requestStart : null,
            fcpMs: paint?.startTime ?? null,
            lcpMs: lab.lcpMs,
            cls: lab.cls,
            longTaskBlockingMs: lab.longTaskBlockingMs,
            overflowPx: Math.max(html.scrollWidth - globalThis.innerWidth, 0),
          };
        });
        const metrics = normalizeMarketingMetrics(measured);
        const sample = {
          locale, viewport: viewport.name, width: viewport.width, height: viewport.height,
          ...metrics, warnings: marketingLabWarnings(metrics), pageErrors: errors,
        };
        result.samples.push(sample);
        console.log(`${locale.padEnd(2)} ${viewport.name.padEnd(7)} FCP=${sample.fcpMs ?? 'N/A'}ms LCP=${sample.lcpMs ?? 'N/A'}ms CLS=${sample.cls ?? 'N/A'} overflow=${sample.overflowPx ?? 'N/A'}px`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
const output = path.resolve('dist/reports/marketing-lab.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(`Đã ghi báo cáo local: ${output}`);
console.log('Lưu ý: số đo lab không thay thế Core Web Vitals người dùng thật và chưa đo INP.');
if (result.samples.some(sample => sample.pageErrors.length || sample.warnings.includes('horizontal-overflow'))) process.exitCode = 1;
