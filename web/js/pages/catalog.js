import { attr, message, priceText, setText, text } from "../core/i18n.js";
import { escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { templateMetaKey } from "../shared/template-copy.js";
import { personalizationText, templateCover, templateField, templateSearchFields, templateValue } from "../features/catalog/template-copy.js";
import { featuredSeasons, isInSeason } from "../features/catalog/seasonal.js";
import { templatePreviewDialog } from "../features/catalog/template-preview.js";
import {
  filterTemplates,
  styleOptions,
  paginateTemplates,
} from "../features/catalog/filter.js";

export function createCatalogViews({
  state,
  buttonLink,
  artwork,
  favoriteButton,
  templateCard,
  paginationMarkup,
}) {
  function matchingTemplates() {
    return filterTemplates(state.templates, {
      style: state.filter,
      search: state.search,
      freeOnly: state.freeOnly,
      photoOnly: state.photoOnly,
      searchFields: templateSearchFields,
    });
  }
  // Điều hướng trang dùng chung cho danh sách mẫu và danh sách yêu thích.

  function catalogResultMarkup() {
    const result = paginateTemplates(matchingTemplates(), state.catalogPage);
    state.catalogPage = result.page;
    const cards = result.total
      ? result.items.map(templateCard).join("")
      : `<div class="empty-state">${icon("search", 32)}<h3>${text("catalog.results.emptyTitle")}</h3><p>${text("catalog.results.emptyHelp")}</p><button class="btn btn--outline" data-action="clear-filters" data-clear-search>${text("catalog.filters.clear")}</button></div>`;
    return { result, cards };
  }

  function hasFilters() {
    return Boolean(state.search.trim() || state.freeOnly || state.photoOnly || state.filter !== 'all');
  }

  function syncCatalogResults() {
    const grid = document.getElementById("catalog-grid");
    const count = document.getElementById("catalog-count");
    const navigation = document.getElementById("catalog-pagination");
    const range = document.getElementById("catalog-range");
    if (!grid) return;
    const shelf = document.querySelector('.seasonal-shelf');
    if (shelf) shelf.hidden = hasFilters();
    const { result, cards } = catalogResultMarkup();
    if (grid) grid.innerHTML = cards;
    if (count) setText(count, message("catalog.results.count", { count: result.total }));
    if (range) setText(range, result.total ? message("catalog.results.range", result) : message("catalog.results.empty"));
    if (navigation) navigation.innerHTML = paginationMarkup(result, "catalog");
  }

  function seasonalShelf() {
    const seasonal = featuredSeasons(state.templates);
    if (!seasonal.length) return '';
    return `<section class="seasonal-shelf" aria-labelledby="seasonal-shelf-title" ${hasFilters() ? 'hidden' : ''}>
      <div class="seasonal-shelf__heading">
        <h2 id="seasonal-shelf-title">${text("catalog.seasonal.title")}</h2>
        <button type="button" class="seasonal-shelf__hint" data-action="filter-seasonal">${text("catalog.seasonal.action")}</button>
      </div>
      <div class="seasonal-shelf__grid">${seasonal.map(template => `<a class="seasonal-shelf__card" href="/template/${encodeURIComponent(template.id)}" data-link>
        <img ${templateCover(template.id)} width="390" height="844" loading="lazy" ${attr('alt', 'catalog.seasonal.cover', { title: templateValue(template, 'title') })}/>
        <div><span>${isInSeason(template) ? text('catalog.seasonal.inSeason') : template.season ? templateField(template, 'season') : text('catalog.seasonal.collection')}</span><strong>${templateField(template, 'title')}</strong></div>
      </a>`).join('')}</div>
    </section>`;
  }

  function explore({ catalogFailed = false } = {}) {
    // Tùy chọn phong cách lấy từ dữ liệu, không tạo hàng chip có thể tràn ngang.
    const styles = styleOptions(state.templates);
    const { result, cards } = catalogResultMarkup();
    const options = styles.map(({ style, count }) => {
      const key = templateMetaKey('style', style);
      return `<option value="${e(style)}" ${state.filter === style ? 'selected' : ''}>${text('catalog.filters.option', {
        style: key ? { format: 'message', key } : style, count,
      })}</option>`;
    });
    return `<section class="section catalog-section catalog-compact"><div class="container">
      <div class="catalog-toolbar"><div class="catalog-title"><h1>${text("shell.pages.catalog")}</h1>${catalogFailed ? '' : `<span id="catalog-count" aria-live="polite" aria-atomic="true">${text('catalog.results.count', { count: result.total })}</span>`}</div>
        <label class="search-field">${icon("search", 19)}<span class="visually-hidden">${text("catalog.search.label")}</span><input type="search" id="template-search" ${attr("placeholder", "catalog.search.placeholder")} value="${e(state.search)}"/></label></div>
      <div class="catalog-filters" role="group" ${attr("aria-label", "catalog.filters.group")}>
        <label class="catalog-style-select"><span>${icon("filter", 17)} ${text("catalog.filters.style")}</span><select id="style-filter" ${attr("aria-label", "catalog.filters.byStyle")}>
          <option value="all" ${state.filter === "all" ? "selected" : ""}>${text('catalog.filters.all', { count: state.templates.length })}</option>
          ${options.join('')}
        </select>${icon("chevron-down", 18)}</label>
        <label class="catalog-free-filter"><input id="free-filter" type="checkbox" ${state.freeOnly ? "checked" : ""}/><span>${text("common.price.free")}</span></label>
        <label class="catalog-free-filter"><input id="photo-filter" type="checkbox" ${state.photoOnly ? "checked" : ""}/><span>${text("catalog.filters.photo")}</span></label>
        <button type="button" class="catalog-reset" data-action="clear-filters">${icon("close", 15)} ${text("catalog.filters.reset")}</button>
      </div>
      ${catalogFailed ? `<div role="alert"><p>${text('catalog.results.failed')}</p><button class="btn btn--outline" type="button" data-action="retry-catalog">${text('common.actions.retry')}</button></div>` : `
      ${seasonalShelf()}
      <div class="catalog-range" id="catalog-range" tabindex="-1">${result.total ? text('catalog.results.range', result) : text('catalog.results.empty')}</div>
      <div class="template-grid catalog-grid" id="catalog-grid">${cards}</div>
      <div id="catalog-pagination">${paginationMarkup(result, "catalog")}</div>`}
    </div></section>`;
  }

  function templateDetail(template, { catalogReturn } = {}) {
    const version = template.versionId ? `&version=${encodeURIComponent(template.versionId)}` : "";
    return `<section class="detail-section"><div class="container">
      <div class="breadcrumb"><a href="${e(catalogReturn?.startsWith('/explore?') ? catalogReturn : '/explore')}" data-link>${icon("arrow-left", 17)} ${text("shell.footer.library")}</a></div>
      <div class="detail-grid"><div class="detail-info">
        <h1>${templateField(template, 'title')}</h1>
        <div class="detail-price-row"><strong>${priceText(template.price)}</strong></div>
        <p>${personalizationText(template.personalization)}</p>
        <div class="detail-start-actions">
          ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=quick${version}`, text("catalog.detail.use"), "btn--dark", false)}
          <button class="btn btn--outline" type="button" data-template-preview aria-haspopup="dialog">${text("catalog.detail.preview")} ${icon('eye', 17)}</button>
        </div>
        <p class="detail-subtitle">${templateField(template, 'subtitle')}</p>
        <p class="detail-meta">${text('catalog.detail.meta', { creator: template.creator, count: template.scenes })}</p>
        <div class="detail-secondary-actions">
          <div class="detail-favorite-row">${favoriteButton(template.id, "favorite-button--inline")}<span>${text("catalog.detail.favoriteHint")}</span></div>
          ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=layout${version}`, template.personalization?.layout === false ? text("catalog.detail.viewLayout") : text("catalog.detail.editLayout"), "detail-text-action", false)}
          <button type="button" class="btn detail-text-action" data-action="report-content" data-kind="template" data-id="${e(template.id)}">${text("catalog.detail.report")}</button>
        </div>
        </div><div class="detail-art">${artwork(template, "artwork--detail")}</div>
      </div>
      ${templatePreviewDialog(template)}
    </div></section>`;
  }

  function favoritesPage() {
    const templates = state.templates.filter((item) =>
      state.favorites.has(item.id),
    );
    const pageData = paginateTemplates(templates, state.favoritePage);
    state.favoritePage = pageData.page;
    return `<section class="page-banner"><div class="container page-banner__inner">
      <span class="eyebrow">${text("catalog.saved.eyebrow")}</span><h1>${text("catalog.saved.title")} <em>${text("catalog.saved.emphasis")}</em></h1>
      <p>${text("catalog.saved.description")}</p>
    </div></section><section class="section"><div class="container">
      <div class="dashboard-heading"><h2>${text('catalog.saved.count', { count: templates.length })}</h2>${buttonLink("/explore", text("catalog.saved.explore"))}</div>
      ${templates.length
        ? `<p class="catalog-range">${text('catalog.results.range', pageData)}</p>
        <div class="template-grid">${pageData.items.map(templateCard).join("")}</div>${paginationMarkup(pageData, "favorites")}`
        : `<div class="empty-state empty-state--panel">${icon("heart", 36)}<h3>${text("catalog.saved.empty")}</h3>
        <p>${text("catalog.saved.emptyHelp")}</p>${buttonLink("/explore", text("catalog.saved.browse"))}</div>`
      }
    </div></section>`;
  }

  return {
    matchingTemplates,
    catalogResultMarkup,
    syncCatalogResults,
    explore,
    templateDetail,
    favoritesPage,
  };
}
