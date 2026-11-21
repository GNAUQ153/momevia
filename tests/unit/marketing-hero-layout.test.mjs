import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = relative => readFileSync(fileURLToPath(new URL(relative, root)), 'utf8');

test('Hàng artwork giữ chiều cao tối thiểu trước vùng chọn mẫu trên mobile', () => {
  const css = read('web/css/marketing-immersive.css');
  const block = css.match(/\.mkt-hero__artwork\s*\{([^}]+)\}/);
  assert.ok(block, 'Phải có vùng artwork riêng');
  assert.match(block[1], /grid-template-rows:\s*minmax\(min-content,\s*1fr\)\s+auto\s*;/);
});

test('Browser regression vẫn kiểm tra vị trí thực tế, không bỏ assertion', () => {
  const browserTest = read('tests/browser/hero-templates.mjs');
  assert.match(browserTest, /indicatorLayout\.controlsTop\s*>=\s*indicatorLayout\.frameBottom/);
  assert.match(browserTest, /getBoundingClientRect\(\)/);
  assert.match(browserTest, /gridRows/);
});
