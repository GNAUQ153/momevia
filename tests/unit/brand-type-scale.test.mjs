import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const css = name => read(`web/css/${name}.css`);
const tokens = css('tokens');
const styles = ['marketing', 'marketing-mobile', 'marketing-immersive', 'open-me-website'];
const token = name => tokens.match(new RegExp(`^\\s*--type-${name}: ([^;]+);`, 'm'))?.[1];

// Đánh giá công thức clamp tại các viewport, không thay thế computed style của trình duyệt.
function size(name, width, rem = 16) {
  const value = token(name);
  const match = /^clamp\(([\d.]+)rem, ([\d.]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)$/.exec(value);
  assert(match, name);
  const [, min, base, fluid, max] = match.map(Number);
  return Math.min(max * rem, Math.max(min * rem, base * rem + fluid * width / 100));
}

test('Thang chữ fluid có giới hạn, phân cấp và không giảm khi viewport rộng hơn', () => {
  const names = ['display', 'h1', 'h2', 'h3', 'card'];
  for (const name of names) {
    let previous = 0;
    for (const width of [320, 390, 680, 768, 1024, 1440, 1920]) {
      const value = size(name, width);
      assert(value >= previous, name);
      previous = value;
    }
  }
  for (const width of [320, 390, 768, 1440, 1920]) {
    const values = names.map(name => size(name, width));
    assert(values.every((v, i) => i === 0 || values[i - 1] >= v));
  }
  assert.equal(size('display', 320), 36);
  assert.equal(size('display', 1920), 72);
  assert.equal(token('body'), '1rem');
  assert.equal(token('small'), '.875rem');
  assert.equal(token('caption'), '.8125rem');
});

test('Cỡ chữ tương đối tăng khi người dùng đổi font mặc định', () => {
  for (const name of ['display', 'h1', 'h2', 'h3', 'card', 'lead']) {
    for (const width of [320, 768, 1440]) assert(size(name, width, 32) > size(name, width, 16));
  }
  assert.equal(token('line-display'), '1.2');
  assert.equal(token('line-heading'), '1.3');
  assert.equal(token('line-body'), '1.65');
});

test('Mọi khai báo cỡ chữ Hero tại các breakpoint dùng chung token', () => {
  let rules = 0;
  for (const name of styles) {
    for (const [block] of css(name).matchAll(/\.is-home \.(?:mkt-hero|open-me-hero) h1\s*\{[^{}]*\}/g)) {
      if (!block.includes('font-size:')) continue;
      rules++;
      assert.match(block, /font-size: var\(--type-display\);/);
    }
  }
  assert(rules >= 8);
  assert.match(css('open-me-website'), /\.is-home \.open-me-hero h1 \{[^}]*overflow-wrap: anywhere;[^}]*line-height: var\(--type-line-display\)/);
});

test('Catalog, Pricing và marketing dùng cùng thang chữ; không đổi token Canvas', () => {
  assert.match(css('template-library'), /\.catalog-compact \.catalog-title h1 \{[^}]*var\(--type-h1\)/);
  assert.match(css('template-library'), /\.catalog-grid \.template-card__title \{[^}]*var\(--type-card\)/);
  assert.match(css('ui-polish'), /\.pricing-intro h1 \{[^}]*var\(--type-h1\)/);
  assert.match(css('ui-polish'), /\.pricing-card__desc \{[^}]*var\(--type-body\)/);
  assert.match(css('brand-system'), /\.is-home \.mkt-journey__heading p \{[^}]*var\(--type-lead\)/);
  assert.match(tokens, /\.editor-artboard,\s*\.gift-runtime-stage \{\s*--font-display: var\(--canvas-font-display\)/);
  assert.doesNotMatch(tokens.split('.editor-artboard,')[1], /--type-/);
});

test('CSS mới được tải theo cùng thứ tự và không có thang chữ riêng theo locale', () => {
  const html = read('web/index.html');
  for (const name of ['tokens', ...styles, 'marketing-journey', 'brand-system', 'template-library', 'ui-polish']) {
    assert(html.includes(`/css/${name}.css?v=20261127-type-scale`), name);
    assert.doesNotMatch(css(name), /(?:\[lang[^\]]*\]|:lang\([^)]*\))[^{}]*\{[^}]*var\(--type-/);
  }
});
