import { escapeHtml as e } from "../core/api.js";
import { attr, priceText, text } from "../core/i18n.js";
import { icon } from "../ui/icons.js";
import { isSystemTemplate } from '../shared/template-copy.js';
import { personalizationText, templateCover, templateField, templateValue } from '../features/catalog/template-copy.js';

export function createComponents({ state }) {
  function artwork(template, variant = "", { eager = false } = {}) {
    const loading = eager ? 'eager' : 'lazy';
    if (isSystemTemplate(template)) return `<div class="artwork artwork--${e(template.theme)} artwork--canvas ${variant}"><img ${templateCover(template,{defer:!eager})} ${attr('alt', 'catalog.artwork.systemAlt', { title: templateValue(template, 'title') })} width="390" height="844" loading="${loading}" ${eager?'fetchpriority="high"':''}/></div>`;
    if (template.thumbnail) return `<div class="artwork artwork--${e(template.theme)} artwork--canvas ${variant}"><img src="${e(template.thumbnail)}" ${attr('alt', 'catalog.artwork.creatorAlt', { title: template.title })} width="390" height="844" loading="${loading}"/></div>`;
    const theme = e(template.theme || "violet");
    const title = template.title ? e(template.title) : text('catalog.artwork.fallbackTitle');
    const small = template.subtitle ? e(template.subtitle) : text('catalog.artwork.fallbackSubtitle');
    return `<div class="artwork artwork--${theme} ${variant}">
      <span class="artwork__blur artwork__blur--one"></span>
      <span class="artwork__blur artwork__blur--two"></span>
      <span class="artwork__shape artwork__shape--one"></span>
      <span class="artwork__shape artwork__shape--two"></span>
      <span class="artwork__shape artwork__shape--three"></span>
      <div class="artwork__content">
        <span class="artwork__eyebrow">${text('catalog.artwork.eyebrow')}</span>
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
      ${attr('aria-label', saved ? 'catalog.actions.unfavorite' : 'catalog.actions.favorite')} aria-pressed="${saved}" ${attr('title', saved ? 'catalog.actions.unfavorite' : 'catalog.actions.addFavorite')}>
      ${icon("heart", 20)}
    </button>`;
  }

  function templateCard(template, { compact = false } = {}) {
    const title = templateField(template, 'title');
    return `<article class="template-card${compact ? ' card template-card--home' : ''}" data-template-id="${e(template.id)}">
      <a href="/template/${encodeURIComponent(template.id)}" data-link class="template-card__visual" ${attr('aria-label', 'catalog.actions.viewNamed', { title: templateValue(template, 'title') })}>
        ${artwork(template)}
        ${compact ? '' : `<span class="template-card__view">${icon("eye", 16)} ${text('catalog.actions.view')}</span>`}
      </a>
      ${favoriteButton(template.id)}
      <div class="template-card__info"><div class="template-card__${compact ? 'occasion' : 'caption'}">${templateField(template, template.category ? 'category' : 'style')}${compact ? '' : ` <span class="dot-separator"></span> ${text('catalog.scenes', { count: template.scenes })}`}</div>
        <a href="/template/${encodeURIComponent(template.id)}" data-link class="template-card__title">${compact ? `<span>${title}</span>${icon('arrow-up-right', 16)}` : title}</a>
        ${compact ? '' : `<p${template.personalization ? ' class="template-card__capabilities"' : ''}>${personalizationText(template.personalization) || templateField(template, 'subtitle')}</p>`}
        <div class="template-card__bottom">${compact ? '' : `<span>${e(template.creator)}</span>`}<strong>${priceText(template.price)}</strong></div>
      </div>
    </article>`;
  }

  function paginationMarkup(result, listName) {
    if (result.totalPages <= 1) return "";
    const pageButton = (
      number,
    ) => `<button type="button" class="pagination__number ${number === result.page ? "is-current" : ""}"
      data-action="set-page" data-list="${listName}" data-page="${number}" ${attr('aria-label', 'catalog.pagination.page', { page: number })}
      ${number === result.page ? 'aria-current="page"' : ""}>${number}</button>`;
    // Chỉ hiển thị tối đa 5 số trang để không tràn ngang trên điện thoại.
    let first = Math.max(1, result.page - 2);
    const last = Math.min(result.totalPages, first + 4);
    first = Math.max(1, last - 4);
    const numbers = Array.from({ length: last - first + 1 }, (_, i) =>
      pageButton(first + i),
    ).join("");
    return `<nav class="pagination" ${attr('aria-label', listName === 'favorites' ? 'catalog.pagination.favorites' : 'catalog.pagination.catalog')}>
      <button type="button" class="pagination__arrow" data-action="set-page" data-list="${listName}" data-page="${result.page - 1}"
        ${result.page === 1 ? "disabled" : ""} ${attr('aria-label', 'catalog.pagination.prevTitle')}>${icon("arrow-left", 17)} <span>${text('catalog.pagination.prev')}</span></button>
      <div class="pagination__pages">${numbers}</div>
      <button type="button" class="pagination__arrow" data-action="set-page" data-list="${listName}" data-page="${result.page + 1}"
        ${result.page === result.totalPages ? "disabled" : ""} ${attr('aria-label', 'catalog.pagination.nextTitle')}><span>${text('catalog.pagination.next')}</span> ${icon("arrow", 17)}</button>
    </nav>`;
  }

  return { artwork, favoriteButton, templateCard, paginationMarkup };
}
