import { priceText, text } from '../../core/i18n.js';

// Cùng miền giá VND nguyên, không âm với API quyền sử dụng mẫu.
// Giá thiếu không phải miễn phí; đây chỉ là phân loại hiển thị, không cấp quyền.
export function templatePriceTier(price) {
  if (!Number.isSafeInteger(price) || price < 0) return 'unknown';
  return price === 0 ? 'free' : 'paid';
}

export function templatePriceText(price) {
  return templatePriceTier(price) === 'unknown'
    ? text('catalog.price.unknown') : priceText(price);
}
