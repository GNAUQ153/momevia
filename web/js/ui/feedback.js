import { setText } from '../core/i18n.js';
import { icon } from './icons.js';

const icons = new Map([
  ['success', 'check-circle'], ['error', 'close'],
  ['warning', 'clock'], ['info', 'message-circle'],
]);

// Giữ một phần tử thông báo để live region cập nhật nội dung tại chỗ.
export function createToast(host) {
  let timer;
  return function toast(copy, type = 'success') {
    const tone = icons.has(type) ? type : 'info';
    let item = host.firstElementChild;
    if (!item) {
      item = host.ownerDocument.createElement('div');
      host.append(item);
    }
    const className = `toast toast--${tone}`;
    if (item.className !== className) {
      item.className = className;
      item.innerHTML = `${icon(icons.get(tone), 20)} <span></span>`;
    }
    // Nội dung lỗi/API chỉ được gán dưới dạng text, vẫn giữ binding i18n.
    setText(item.querySelector('span'), copy);
    clearTimeout(timer);
    timer = setTimeout(() => item.remove(), tone === 'error' || tone === 'warning' ? 8000 : 4800);
  };
}
