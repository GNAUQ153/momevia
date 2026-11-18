import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { basicTemplateDefinition, BASIC_TEMPLATE_REVISION } from '../shared/canvas/basic-templates.js';

export function createComponents({ state }) {
  function artwork(template, variant = "") {
    if (basicTemplateDefinition(template.id)) return `<div class="artwork artwork--${e(template.theme)} artwork--canvas ${variant}"><img src="/assets/basic-templates/${encodeURIComponent(template.id)}.svg?v=${BASIC_TEMPLATE_REVISION}" alt="Bố cục mẫu ${e(template.title)}" width="390" height="844" loading="lazy"/></div>`;
    if (template.thumbnail) return `<div class="artwork artwork--${e(template.theme)} artwork--canvas ${variant}"><img src="${e(template.thumbnail)}" alt="Ảnh minh họa mẫu ${e(template.title)}" width="390" height="844" loading="lazy"/></div>`;
    const theme = e(template.theme || "violet");
    const title = e(template.title || "A little wish");
    const small = e(template.subtitle || "Made with love");
    return `<div class="artwork artwork--${theme} ${variant}">
      <span class="artwork__blur artwork__blur--one"></span>
      <span class="artwork__blur artwork__blur--two"></span>
      <span class="artwork__shape artwork__shape--one"></span>
      <span class="artwork__shape artwork__shape--two"></span>
      <span class="artwork__shape artwork__shape--three"></span>
      <div class="artwork__content">
        <span class="artwork__eyebrow">A NOTE FOR YOU</span>
        <span class="artwork__symbol">${icon("sparkles", 37)}</span>
        <strong>${title}</strong>
        <em>${small}</em>
        <span class="artwork__tinyline"></span>
      </div>
    </div>`;
  }

  function favoriteButton(templateId, variant = "") {
    const saved = state.favorites.has(templateId);
    return `<button type="button" class="favorite-button ${variant} ${saved ? "is-saved" : ""}" data-action="toggle-favorite" data-id="${e(templateId)}"
      aria-label="${saved ? "Bỏ yêu thích" : "Lưu mẫu vào yêu thích"}" aria-pressed="${saved}" title="${saved ? "Bỏ yêu thích" : "Thêm vào yêu thích"}">
      ${icon("heart", 20)}
    </button>`;
  }

  function templateCard(template, i = 0) {
    return `<article class="template-card">
      <a href="/template/${encodeURIComponent(template.id)}" data-link class="template-card__visual" aria-label="Xem mẫu ${e(template.title)}">
        ${artwork(template)}
        <span class="template-card__view">${icon("eye", 16)} Xem mẫu</span>
      </a>
      ${favoriteButton(template.id)}
      <div class="template-card__info"><div class="template-card__caption">${e(template.style)} <span class="dot-separator"></span> ${e(template.scenes)} cảnh</div>
        <a href="/template/${encodeURIComponent(template.id)}" data-link class="template-card__title">${e(template.title)}</a>
        <p>${e(template.subtitle)}</p>
        <div class="template-card__bottom"><span>${e(template.creator)}</span><strong>${formatPrice(template.price)}</strong></div>
      </div>
    </article>`;
  }

  function paginationMarkup(result, listName) {
    if (result.totalPages <= 1) return "";
    const pageButton = (
      number,
    ) => `<button type="button" class="pagination__number ${number === result.page ? "is-current" : ""}"
      data-action="set-page" data-list="${listName}" data-page="${number}" aria-label="Trang ${number}"
      ${number === result.page ? 'aria-current="page"' : ""}>${number}</button>`;
    // Chỉ hiển thị tối đa 5 số trang để không tràn ngang trên điện thoại.
    let first = Math.max(1, result.page - 2);
    const last = Math.min(result.totalPages, first + 4);
    first = Math.max(1, last - 4);
    const numbers = Array.from({ length: last - first + 1 }, (_, i) =>
      pageButton(first + i),
    ).join("");
    return `<nav class="pagination" aria-label="Phân trang ${listName === "favorites" ? "mẫu yêu thích" : "thư viện mẫu"}">
      <button type="button" class="pagination__arrow" data-action="set-page" data-list="${listName}" data-page="${result.page - 1}"
        ${result.page === 1 ? "disabled" : ""} aria-label="Trang trước">${icon("arrow-left", 17)} <span>Trước</span></button>
      <div class="pagination__pages">${numbers}</div>
      <button type="button" class="pagination__arrow" data-action="set-page" data-list="${listName}" data-page="${result.page + 1}"
        ${result.page === result.totalPages ? "disabled" : ""} aria-label="Trang tiếp theo"><span>Tiếp</span> ${icon("arrow", 17)}</button>
    </nav>`;
  }

  return { artwork, favoriteButton, templateCard, paginationMarkup };
}
