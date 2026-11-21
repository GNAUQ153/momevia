import { attr, text } from '../core/i18n.js';
import { escapeHtml } from '../shared/locale.js';
import { icon } from './icons.js';

// Thanh điều hướng của từng vai trò chỉ nhận anchor nội bộ hoặc đường dẫn nội bộ.
// Không nhúng URL không tin cậy vào HTML. Các key được dịch bởi i18n chung.
const localDestination = /^(?:#[a-z][a-z0-9-]*|\/[a-z0-9/_-]+)$/;

export function roleQuickLinks(items = []) {
  return `<nav class="role-workspace__links" ${attr('aria-label', 'role.workspace.nav')}>
    ${items.map(({ href, labelKey, iconName }) => {
      if (!localDestination.test(href)) throw new TypeError('Invalid role navigation destination');
      return `<a class="role-workspace__link" href="${escapeHtml(href)}"${href.startsWith('/') ? ' data-link' : ''}>
        ${icon(iconName, 18)}<span>${text(labelKey)}</span>${icon('arrow-up-right', 14)}
      </a>`;
    }).join('')}
  </nav>`;
}

export function roleMetric(labelKey, count) {
  // Danh sách API chỉ phản ánh bản ghi đã tải; không coi là tổng trên toàn hệ thống.
  const known = Number.isSafeInteger(count) && count >= 0;
  return `<div class="role-workspace__metric">
    <strong>${known ? String(count) : text('role.workspace.notLoaded')}</strong>
    <span>${text(labelKey)}</span>
  </div>`;
}

export function roleHeader({ eyebrowKey, titleKey, introKey, links = [] }) {
  return `<header class="role-workspace__header">
    <div class="role-workspace__lead"><span class="role-workspace__eyebrow">${text(eyebrowKey)}</span>
      <h1>${text(titleKey)}</h1><p>${text(introKey)}</p>
    </div>
    ${roleQuickLinks(links)}
  </header>`;
}
