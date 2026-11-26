import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const tokens = read('web/css/tokens.css');
const palette = Object.fromEntries([...tokens.matchAll(/^\s*(--color-[\w-]+): (#[\da-f]{6});$/gmi)].map(([, name, value]) => [name.slice(8), value]));

// Công thức độ tương phản WCAG cho hai màu sRGB đục, không thay thế nghiệm thu gradient thật.
function luminance(hex) {
  assert.match(hex || '', /^#[a-f\d]{6}$/i);
  const channels = hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const a = luminance(palette[foreground]);
  const b = luminance(palette[background]);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('Chữ thường và màu CTA đạt 4.5:1 trên các nền đục đã chọn', () => {
  const pairs = [
    ...['white', 'page', 'lavender', 'pink-soft', 'peach-soft', 'pink', 'peach'].map(bg => ['ink', bg]),
    ...['white', 'page', 'lavender', 'pink-soft', 'peach-soft'].map(bg => ['muted', bg]),
    ...['primary', 'primary-hover', 'primary-light'].map(bg => ['on-primary', bg]),
    ['primary-hover', 'lavender'], ['primary-hover', 'white'], ['primary', 'white'],
    ['primary', 'lavender'], ['primary', 'pink-soft'], ['primary', 'peach-soft'],
    ['success', 'success-soft'], ['warning', 'warning-soft'], ['error', 'error-soft'], ['info', 'info-soft'],
  ];
  for (const [fg, bg] of pairs) assert(contrast(fg, bg) >= 4.5, `${fg}/${bg}: ${contrast(fg, bg).toFixed(2)}`);
});

test('Viền điều khiển và focus đạt 3:1 trên nền sáng đã chọn', () => {
  for (const fg of ['control-border', 'focus']) {
    for (const bg of ['white', 'page', 'lavender', 'pink-soft', 'peach-soft']) {
      assert(contrast(fg, bg) >= 3, `${fg}/${bg}: ${contrast(fg, bg).toFixed(2)}`);
    }
  }
});

test('Không đổi màu hành động cũ hoặc màu nền ứng dụng', () => {
  assert.equal(palette.primary, '#5939d0');
  assert.equal(palette['primary-hover'], '#4327a8');
  assert.equal(palette.success, '#167957');
  assert.equal(palette.error, '#ba3053');
  assert.match(tokens, /--app-text: #222137;/);
  assert.match(tokens, /--app-page: #faf8f2;/);
  assert.match(tokens, /--app-accent: var\(--color-primary\);/);
});

test('Marketing dùng cùng token ở cả stylesheet thường và immersive', () => {
  const marketing = read('web/css/marketing.css');
  const immersive = read('web/css/marketing-immersive.css');
  const journey = read('web/css/marketing-journey.css');
  assert.match(marketing, /--mkt-ink: var\(--color-ink\)/);
  assert.match(marketing, /background: var\(--color-gradient-action\)/);
  for (const css of [marketing, immersive]) assert.match(css, /background: var\(--color-gradient-hero\)/);
  assert.match(journey, /background: var\(--color-gradient-journey\)/);
  assert.match(journey, /\[aria-pressed="true"\][\s\S]*?background: var\(--color-lavender\)/);
  for (const css of [marketing, immersive, journey]) {
    assert.doesNotMatch(css, /:lang\(|\[lang[=|]/);
  }
});

test('Cache bust cho toàn bộ stylesheet đổi màu', () => {
  const html = read('web/index.html');
  for (const name of ['tokens', 'marketing', 'marketing-immersive', 'marketing-journey', 'open-me-website', 'open-me-system']) {
    assert(html.includes(`/css/${name}.css?v=${name === "open-me-system" ? "20261127-colors" : "20261127-layout"}`), name);
  }
});

test('Lớp cascade cuối không ghi đè CTA về màu vàng cũ', () => {
  const website = read('web/css/open-me-website.css');
  const system = read('web/css/open-me-system.css');
  assert.match(website, /\.is-home \.open-me-hero \{[^}]*background: var\(--color-gradient-hero\)/);
  assert.doesNotMatch(website, /--mkt-ink: var\(--open-me-ink/);
  assert.match(system, /\.is-home \.open-me-hero \.btn\.mkt-primary \{[^}]*background: var\(--color-gradient-action\)/);
  assert.match(system, /\.is-home \.btn\.mkt-secondary \{[^}]*border-color: var\(--color-control-border\)/);
});
