import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const css = name => read(`web/css/${name}.css`);
const tokens = css('tokens');
const values = new Map([...tokens.matchAll(/^\s*(--[\w-]+):\s*([^;]+);$/gm)].map(([, name, value]) => [name, value]));
const px = name => {
  const value = values.get(name);
  assert(value, `Thiếu token ${name}`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias) return px(alias[1]);
  assert.match(value, /^\d+px$/);
  return Number.parseInt(value, 10);
};

test('Thang spacing theo bội số 4px, giữ token radius và control cũ', () => {
  for (const [name] of values) {
    const scale = /^--space-(\d+)$/.exec(name);
    if (scale) assert.equal(px(name), Number(scale[1]) * 4);
  }
  assert.equal(px('--ui-control-min-height'), 44);
  assert.equal(px('--radius-sm'), 10);
  assert.equal(px('--radius-md'), 18);
  assert.equal(px('--radius-lg'), 26);
  assert.equal(px('--radius-xl'), 34);
});

test('Container giữ max-width và gutter cũ tại mọi breakpoint', () => {
  assert.equal(px('--container'), 1190);
  assert.equal(px('--layout-gutter'), 36);
  assert.equal(px('--layout-gutter-tablet'), 22);
  assert.equal(px('--layout-gutter-mobile'), 17);
  assert.equal(px('--layout-gutter-small'), 13);
  assert.match(css('base'), /\.container\s*\{[^}]*width: min\(var\(--container\), calc\(100% - 2 \* var\(--layout-gutter\)\)\)/);
  const responsive = css('responsive');
  for (const [width, name] of [[900, 'tablet'], [680, 'mobile'], [370, 'small']]) {
    assert.match(responsive, new RegExp(`@media \\(max-width: ${width}px\\) \\{\\s*(?:html\\s*\\{[^}]*\\}\\s*)?:root\\s*\\{\\s*--layout-gutter: var\\(--layout-gutter-${name}\\);`));
  }
});

test('Hero, carousel và hộp thoại dùng token tại lớp cascade cuối', () => {
  const website = css('open-me-website');
  assert.match(website, /\.is-home \.open-me-hero \{[^}]*padding-block: var\(--layout-hero-space\)/);
  assert.match(website, /\.is-home \.open-me-hero \.mkt-hero__layout \{[^}]*gap: var\(--layout-hero-gap\)/);
  assert.match(website, /\.is-home \.open-me-hero \.mkt-actions \.btn \{[^}]*min-height: 48px;[^}]*border-radius: var\(--layout-radius-control\)/);
  assert.match(website, /\.home-create-dialog \{[^}]*border-radius: var\(--layout-radius-card\)/);
  assert.match(css('featured-carousel'), /--featured-gap: var\(--layout-card-gap\)/);
  assert.match(css('featured-carousel'), /--featured-gap: var\(--layout-card-gap-mobile\)/);
  assert.match(css('marketing'), /--mkt-section-space: var\(--layout-section-space\)/);
});

test('Độ bo ảnh khớp card, bóng đổ hover dùng cùng token', () => {
  assert.equal(values.get('--layout-radius-card-inner'), 'calc(var(--layout-radius-card) - 1px)');
  assert.equal(px('--layout-radius-card'), 20);
  for (const file of ['marketing', 'marketing-mobile', 'featured-carousel']) {
    assert.match(css(file), /border-radius: var\(--layout-radius-card-inner\)/);
  }
  assert.match(css('marketing-immersive'), /border-radius: var\(--layout-radius-card\);\s*box-shadow: var\(--layout-shadow-card\)/);
  assert.match(css('brand-system'), /\.is-home \.mkt-gift-grid \.template-card--home:hover \{[^}]*box-shadow: var\(--layout-shadow-card-hover\)/);
  assert.match(css('marketing-journey'), /border-radius: var\(--layout-radius-showcase\);[^}]*box-shadow: var\(--layout-shadow-stage\)/);
});

test('CSS thay đổi được cache bust, không thêm phân nhánh layout VI/EN', () => {
  const html = read('web/index.html');
  for (const name of ['tokens', 'base', 'responsive', 'marketing', 'marketing-mobile', 'featured-carousel', 'marketing-immersive', 'marketing-journey', 'open-me-website', 'brand-system']) {
    assert(html.includes(`/css/${name}.css?v=${name === "marketing-journey" ? "20261127-journey-bento" : name === "marketing" ? "20261127-hero-spacing" : name === "marketing-immersive" ? "20261127-scroll-reveal" : name === "open-me-website" ? "20261127-hero-mesh" : name === "base" ? "20261127-accessibility" : ["responsive", "featured-carousel"].includes(name) ? "20261127-layout" : "20261127-type-scale"}`), name);
    // Không cấm selector locale cũ ngoài phạm vi; token layout mới không phụ thuộc ngôn ngữ.
    assert.doesNotMatch(css(name), /(?:\[lang[^\]]*\]|:lang\([^)]*\))[^{}]*\{[^}]*--(?:layout|space)-/);
  }
});

test('Featured giữ khoảng đệm tối thiểu 24px từ tablet rộng, chung VI/EN', () => {
  assert.equal(px('--space-6'), 24);
  assert.match(css('marketing'), /@media \(min-width: 681px\) \{\s*\.is-home \.mkt-featured \{\s*padding-top: var\(--space-6\);/);
});
