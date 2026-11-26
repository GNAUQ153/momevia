import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { templateCreateUrl } from '../../web/js/features/catalog/template-create-url.js';
import { templatePreviewDialog } from '../../web/js/features/catalog/template-preview.js';

const source = location => readFileSync(new URL(`../../${location}`, import.meta.url), 'utf8');

const template = { id: 'birthday-radiance', title: 'Sinh nhật vui', category: 'birthday' };

test('URL tạo nhanh giữ đúng định dạng route hiện tại', () => {
  assert.equal(templateCreateUrl(template), '/create/birthday-radiance?mode=quick');
});

test('Mẫu Creator có phiên bản riêng không mất versionId', () => {
  assert.equal(templateCreateUrl({ ...template, versionId: 'v31-hello' }), '/create/birthday-radiance?mode=quick&version=v31-hello');
});

test('ID và versionId được URL-encode, không thể chèn query ngoài ý muốn', () => {
  const value = templateCreateUrl({ id: 'mẫu có & ký tự?#', versionId: 'v2&mode=layout#x' });
  assert.equal(value, '/create/m%E1%BA%ABu%20c%C3%B3%20%26%20k%C3%BD%20t%E1%BB%B1%3F%23?mode=quick&version=v2%26mode%3Dlayout%23x');
  const parsed = new URL(value, 'https://momevia.example');
  assert.equal(parsed.searchParams.get('mode'), 'quick');
  assert.equal(parsed.searchParams.get('version'), 'v2&mode=layout#x');
});

test('Không đưa tham số version nếu template chưa có versionId', () => {
  for (const versionId of [undefined, null, '']) {
    assert.equal(templateCreateUrl({ ...template, versionId }), '/create/birthday-radiance?mode=quick');
  }
});

test('Hộp thoại xem thử cung cấp CTA tạo thiệp và đóng/phát lại độc lập', () => {
  const html = templatePreviewDialog(template);
  assert.match(html, /<a class="btn btn--dark template-preview-use" href="\/create\/birthday-radiance\?mode=quick" data-template-use data-link>/);
  assert.match(html, /data-template-close/);
  assert.match(html, /data-template-reset hidden/);
  assert.match(html, /catalog\.detail\.use|Dùng mẫu|Use template/);
});

test('Hộp thoại mẫu có versionId giữ nguyên URL phiên bản', () => {
  const html = templatePreviewDialog({ ...template, versionId: 'review v2' });
  assert.match(html, /href="\/create\/birthday-radiance\?mode=quick&amp;version=review%20v2"|href="\/create\/birthday-radiance\?mode=quick&version=review%20v2"/);
});

test('Hero cập nhật CTA theo mẫu đang được chọn tại thời điểm mở, không lấy mẫu đầu tiên', () => {
  const sourceText = source('web/js/features/catalog/template-preview.js');
  assert.match(sourceText, /activeTemplate = getTemplate\(\);/);
  assert.match(sourceText, /useTemplate\.setAttribute\('href', templateCreateUrl\(activeTemplate\)\)/);
  assert.match(sourceText, /const useTemplate = dialog\.querySelector\('\[data-template-use\]'\)/);
});

test('Trang chi tiết và hộp thoại cùng dùng module tạo URL', () => {
  const catalogSource = source('web/js/pages/catalog.js');
  assert.match(catalogSource, /import \{ templateCreateUrl \}/);
  assert.match(catalogSource, /href="\$\{e\(templateCreateUrl\(template\)\)\}" data-link data-template-create-cta/);
  assert.doesNotMatch(catalogSource, /buttonLink\(`\/create\/\$\{encodeURIComponent\(template\.id\)\}\?mode=quick/);
});

test('CTA không gọi POST, giữ luồng đăng nhập của SPA khi người xem chưa có tài khoản', () => {
  const html = templatePreviewDialog(template);
  assert.match(html, /data-template-use data-link/);
  const app = source('web/js/app/payment-actions.js');
  assert.match(app, /requireLogin\(location\.pathname \+ location\.search\)/);
  assert.doesNotMatch(html, /data-action=\"submit\"|onclick=|<form/);
});

test('CTA xem thử hiển thị trên mobile với focus và chiều cao tối thiểu', () => {
  const css = source('web/css/template-library.css');
  assert.match(css, /\.template-preview-toolbar \.btn\s*\{[^}]*min-height: 44px;/);
  assert.match(css, /\.template-preview-toolbar \.template-preview-use\s*\{/);
  assert.match(css, /\.template-preview-dialog :focus-visible\s*\{/);
  assert.match(css, /@media \(max-width:480px\)/);
});

// Guard chống hồi quy: modal đang đóng sẽ không có role=dialog hiển thị trong Playwright.
test('Browser test chỉ kiểm tra CTA sau khi mở Preview modal bằng bàn phím', () => {
  const browser = source('tests/browser/home.mjs');
  const begin = browser.indexOf("const dialog = page.locator('.template-preview-dialog');");
  const open = browser.indexOf("await page.keyboard.press('Enter');", begin);
  const visible = browser.indexOf("await dialog.waitFor({ state: 'visible' });", open);
  const href = browser.indexOf("useTemplate.getAttribute('href')", visible);
  assert(begin >= 0, 'Home browser test phải tìm Preview dialog');
  assert(open > begin, 'Mở Preview bằng Enter trước khi tìm CTA');
  assert(visible > open, 'Chờ dialog hiển thị trước khi kiểm tra CTA');
  assert(href > visible, 'Chỉ lấy URL CTA sau khi dialog đã mở');
});
