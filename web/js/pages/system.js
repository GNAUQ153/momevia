import { escapeHtml as e } from '../core/api.js';
import { icon } from '../ui/icons.js';


export function createSystemViews({ buttonLink }) {
  function errorPage(message) {
    return `<section class="section"><div class="container"><div class="empty-state empty-state--panel">${icon('shield', 36)}<h2>Không thể hiển thị nội dung</h2><p>${e(message)}</p>${buttonLink('/', 'Về trang chủ')}</div></div></section>`;
  }

  function loadingPage() {
    return `<section class="section"><div class="container"><div class="centered-loading"><span class="loading-spinner"></span> Đang chuẩn bị những điều đặc biệt...</div></div></section>`;
  }

  return { errorPage, loadingPage };
}
