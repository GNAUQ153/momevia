import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';

// Kiểm thử nội dung marketing bằng dữ liệu mẫu, không phụ thuộc MySQL.
const sample = {
  id: 'midnight-bloom',
  title: 'Midnight Bloom',
  theme: 'violet',
  subtitle: 'Một khu vườn dành riêng cho bạn',
  featured: true,
};

function render(templates = [sample]) {
  const { home } = createHomeViews({
    state: { templates },
    buttonLink: (path, label) => `<a href="${path}" data-link>${label}</a>`,
    artwork: () => '<div class="artwork" aria-label="Minh họa mẫu"></div>',
    templateCard: item => `<article class="template-card">${item.title}</article>`,
  });
  return home();
}

const css = readFileSync(new URL('../../web/css/marketing.css', import.meta.url), 'utf8');
const mobileCss = readFileSync(new URL('../../web/css/marketing-mobile.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');

test('Trang chủ giới thiệu lợi ích thật, có CTA và FAQ dùng HTML native', () => {
  const html = render();
  assert.match(html, /href="\/explore"/);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /id="how-it-works"/);
  assert.match(html, /aria-labelledby="mkt-experience-title"/);
  assert.match(html, /Không bắt người nhận đăng ký/);
  assert.match(html, /<details class="mkt-faq__item">/);
  assert.match(html, /gói Creator Pro.*chưa mở bán/i);
  assert.match(html, /đừng thanh toán lại/);
});

test('Không dựng số liệu hay đánh giá giả và không dùng emoji trong content', () => {
  const html = render();
  assert.doesNotMatch(html, /\b\d+(?:[.,]\d+)?\+?\s*(?:khách hàng|người dùng|lượt dùng|đánh giá)\b/i);
  assert.doesNotMatch(html, /[\p{Extended_Pictographic}]/u);
});

test('Nếu dữ liệu không có featured vẫn có thể giới thiệu mẫu sẵn có', () => {
  const html = render([{ ...sample, featured: false, title: 'Mẫu mặc định' }]);
  assert.match(html, /Mẫu mặc định/);
});

test('CSS marketing chia file và hỗ trợ responsive, keyboard, giảm chuyển động', () => {
  assert.match(page, /\/css\/marketing\.css/);
  assert.match(page, /\/css\/marketing-mobile\.css/);
  assert(page.indexOf('marketing.css') > page.indexOf('ui-polish.css'));
  assert(page.indexOf('marketing-mobile.css') > page.indexOf('marketing.css'));
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(mobileCss, /max-width: 520px/);
  assert.match(css, /Lucide \(ISC\)/);
  // Các thuộc tính CSS mới đặt riêng từng dòng; không nén nhiều khai báo trong một dòng.
  for (const [filename, source] of [['marketing.css', css], ['marketing-mobile.css', mobileCss]]) {
    const bad = source.split('\n').filter(line => (line.match(/;\s*\S+\s*:/g) || []).length > 0);
    assert.deepEqual(bad, [], `${filename} chứa nhiều khai báo CSS trên một dòng`);
  }
});
