import { attr, message, priceText, setText, text } from "../core/i18n.js";
import { escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { templateMetaKey } from "../shared/template-copy.js";
import { personalizationText, templateCover, templateField, templateSearchFields, templateValue } from "../features/catalog/template-copy.js";
import { featuredSeasons, seasonStatus, vietnamDay } from "../features/catalog/seasonal.js";
import { templatePreviewDialog } from "../features/catalog/template-preview.js";
import { templateCreateUrl } from "../features/catalog/template-create-url.js";
import { CARD_TYPES, templateCardType } from '../shared/card-type.js';
import { prioritizeTemplates } from '../shared/template-order.js';
import { preserveLoadedCovers } from '../core/cover-loading.js';
import { SEASONAL_COVER_SIZES } from '../shared/cover-images.js';
import {
  activeCatalogFilters,
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
    return prioritizeTemplates(filterTemplates(state.templates, {
      style: state.filter,
      cardType: state.cardType,
      search: state.search,
      freeOnly: state.freeOnly,
      photoOnly: state.photoOnly,
      category: state.occasion || "all",palette:state.palette || "all",
      searchFields: templateSearchFields,
    }));
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
    return activeCatalogFilters(state).length > 0;
  }

  function filterChipLabel(key) {
    const value = state[key];
    if (key === 'search') return `${text('catalog.search.label')}: ${e(value.trim())}`;
    if (key === 'cardType') return `${text('catalog.cardType.label')}: ${text(`catalog.cardType.${value}`)}`;
    if (key === 'freeOnly') return text('common.price.free');
    if (key === 'photoOnly') return text('catalog.filters.photo');
    if (key === 'palette') {
      const template = state.templates.find(item => item.palette === value);
      return `${text('catalog.filters.palette')}: ${template ? templateField(template, 'paletteLabel') : e(value)}`;
    }
    const style = key === 'filter';
    const translation = templateMetaKey(style ? 'style' : 'category', value);
    return `${text(style ? 'catalog.filters.style' : 'catalog.filters.occasion')}: ${translation ? text(translation) : e(value)}`;
  }

  function activeFilterMarkup() {
    return activeCatalogFilters(state).map(key =>
      `<button type="button" class="catalog-filter-chip" data-action="remove-catalog-filter" data-filter="${key}"><span class="visually-hidden">${text('catalog.filters.remove')} </span><span class="catalog-filter-chip__label">${filterChipLabel(key)}</span>${icon('close', 16)}</button>`
    ).join('');
  }

  function syncCatalogResults() {
    const grid = document.getElementById("catalog-grid");
    const count = document.getElementById("catalog-count");
    const navigation = document.getElementById("catalog-pagination");
    const range = document.getElementById("catalog-range");
    const clear = document.getElementById("template-search-clear");
    if (clear) clear.disabled = !state.search.length;
    if (!grid) return;
    const active = document.getElementById('catalog-active-filters');
    if (active) {
      const markup = activeFilterMarkup();
      if (active.innerHTML !== markup) active.innerHTML = markup;
      active.hidden = !markup;
    }
    const shelf = document.querySelector('.seasonal-shelf');
    if (shelf) shelf.hidden = hasFilters();
    const { result, cards } = catalogResultMarkup();
    const fragment = document.createElement("template");
    fragment.innerHTML = cards;
    const retained = new Map([...grid.children].map(node => [node.dataset.templateId, node]));
    grid.classList.add("catalog-grid--updated");
    const next = [...fragment.content.children].map(candidate => {
      const current = retained.get(candidate.dataset.templateId);
      if(current)preserveLoadedCovers(current,candidate);
      return current?.isEqualNode(candidate) ? current : candidate;
    });
    const keep = new Set(next);
    for (const child of [...grid.children]) if (!keep.has(child)) child.remove();
    for (const [index, child] of next.entries()) {
      const atIndex = grid.children[index] || null;
      if (child === atIndex) continue;
      if (child.parentNode === grid && grid.moveBefore) grid.moveBefore(child, atIndex);
      else grid.insertBefore(child, atIndex);
    }
    if (count) setText(count, message("catalog.results.count", { count: result.total }));
    if (range) setText(range, result.total ? message("catalog.results.range", result) : message("catalog.results.empty"));
    if (navigation) navigation.innerHTML = paginationMarkup(result, "catalog");
  }

  function seasonalShelf() {
    // Dùng cùng một ngày cho cả thứ tự và nhãn, kể cả khi render qua nửa đêm.
    const day = vietnamDay();
    const seasonal = featuredSeasons(state.templates, day);
    if (!seasonal.length) return '';
    return `<details class="seasonal-shelf" aria-labelledby="seasonal-shelf-title" ${hasFilters() ? 'hidden' : ''} ${globalThis.matchMedia?.('(max-width: 680px)').matches ? '' : 'open'}>
      <summary class="seasonal-shelf__heading">
        <h2 id="seasonal-shelf-title" class="seasonal-shelf__summary">
          ${text("catalog.seasonal.title")}
          <span class="seasonal-shelf__summary-copy">${text('catalog.seasonal.count', { count: seasonal.length })}</span>
        </h2>
        ${icon("chevron-down", 18)}
      </summary>
      <p class="seasonal-shelf__intro">${text('catalog.seasonal.intro')}</p>
      <button type="button" class="seasonal-shelf__hint" data-action="filter-seasonal">${text("catalog.seasonal.action")}</button>
      <div class="seasonal-shelf__grid">${seasonal.map(template => {
        const status = seasonStatus(template, day);
        return `<a class="seasonal-shelf__card" data-season-status="${status}" href="/template/${encodeURIComponent(template.id)}" data-link>
        <img ${templateCover(template,{variant:'seasonal',responsive:true,sizes:SEASONAL_COVER_SIZES})} width="390" height="466" loading="lazy" ${attr('alt', 'catalog.seasonal.cover', { title: templateValue(template, 'title') })}/>
        <div class="seasonal-shelf__meta">
          <span class="seasonal-shelf__status">${text(`catalog.seasonal.${status}`)}</span>
          ${template.season ? `<span class="seasonal-shelf__occasion">${templateField(template, 'season')}</span>` : ''}
          <strong>${templateField(template, 'title')}</strong>
          <span class="seasonal-shelf__price">${priceText(template.price)}</span>
        </div>
      </a>`;
      }).join('')}</div>
    </details>`;
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
      <div class="catalog-toolbar"><div class="catalog-title"><h1>${text("shell.pages.catalog")}</h1>${catalogFailed ? '' : `<span id="catalog-count" aria-live="polite" aria-atomic="true">${text('catalog.results.count', { count: result.total })}</span>`}<p class="catalog-intro">${text('catalog.intro')}</p></div>
        <div class="catalog-toolbar__actions"><div class="search-field"><label class="search-field__label">${icon("search", 19)}<span class="visually-hidden">${text("catalog.search.label")}</span><input type="search" id="template-search" ${attr("placeholder", "catalog.search.placeholder")} value="${e(state.search)}"/></label><button type="button" id="template-search-clear" class="search-field__clear" data-action="clear-catalog-search" ${attr("aria-label", "catalog.search.clear")} ${state.search.length ? "" : "disabled"}>${icon("close", 18)}</button></div>
          <a class="btn btn--dark catalog-create-cta" href="/design/new" data-link data-catalog-create-cta referrerpolicy="no-referrer">${icon('pencil', 18)} ${text('floatingCta.create')}</a></div></div>
      <div class="catalog-filters" role="group" ${attr("aria-label", "catalog.filters.group")}>
        <label class="catalog-style-select"><span>${text('catalog.cardType.label')}</span><select id="card-type-filter" ${attr('aria-label','catalog.cardType.label')}>
          <option value="all" ${!state.cardType || state.cardType === 'all' ? 'selected' : ''}>${text('catalog.cardType.all')}</option>
          ${CARD_TYPES.map(type => `<option value="${type}" ${state.cardType === type ? 'selected' : ''}>${text(`catalog.cardType.${type}`)}</option>`).join('')}
        </select>${icon('chevron-down', 18)}</label>
        <details class="catalog-advanced-filters" ${state.filter !== 'all' || state.photoOnly || (state.occasion && state.occasion !== 'all') || (state.palette && state.palette !== 'all') ? 'open' : ''}>
        <summary>${icon('filter', 17)} ${text('catalog.filters.more')} ${icon('chevron-down', 17)}</summary>
        <div class="catalog-advanced-filters__body">
        <label class="catalog-style-select"><span>${text("catalog.filters.style")}</span><select id="style-filter" ${attr("aria-label", "catalog.filters.byStyle")}>
          <option value="all" ${state.filter === "all" ? "selected" : ""}>${text('catalog.filters.all', { count: state.templates.length })}</option>
          ${options.join('')}
        </select>${icon("chevron-down", 18)}</label>
        <label class="catalog-style-select"><span>${text('catalog.filters.occasion')}</span><select id="occasion-filter" ${attr('aria-label','catalog.filters.occasion')}><option value="all">${text('catalog.filters.allOccasions')}</option>${[...new Set(state.templates.map(t=>t.category))].map(value=>`<option value="${e(value)}" ${state.occasion===value?'selected':''}>${templateMetaKey('category',value)?text(templateMetaKey('category',value)):e(value)}</option>`).join('')}</select></label>
        <label class="catalog-style-select"><span>${text('catalog.filters.palette')}</span><select id="palette-filter" ${attr('aria-label','catalog.filters.palette')}><option value="all">${text('catalog.filters.allPalettes')}</option>${[...new Map(state.templates.filter(t=>t.palette).map(t=>[t.palette,t.paletteLabel])).entries()].map(([value,label])=>`<option value="${e(value)}" ${state.palette===value?'selected':''}>${text(`templates.meta.palette.${value}`)||e(label)}</option>`).join('')}</select></label>
        <label class="catalog-free-filter"><input id="photo-filter" type="checkbox" ${state.photoOnly ? "checked" : ""}/><span>${text("catalog.filters.photo")}</span></label>
        </div></details>
        <label class="catalog-free-filter"><input id="free-filter" type="checkbox" ${state.freeOnly ? "checked" : ""}/><span>${text("common.price.free")}</span></label>
        <button type="button" class="catalog-reset" data-action="clear-filters">${icon("close", 15)} ${text("catalog.filters.reset")}</button>
      </div>
      ${catalogFailed ? `<div role="alert"><p>${text('catalog.results.failed')}</p><button class="btn btn--outline" type="button" data-action="retry-catalog">${text('common.actions.retry')}</button></div>` : `
      <div class="catalog-active-filters" id="catalog-active-filters" role="group" ${attr('aria-label', 'catalog.filters.active')} ${hasFilters() ? '' : 'hidden'}>${activeFilterMarkup()}</div>
      <div class="catalog-range" id="catalog-range" tabindex="-1">${result.total ? text('catalog.results.range', result) : text('catalog.results.empty')}</div>
      <div class="template-grid catalog-grid" id="catalog-grid">${cards}</div>
      <div id="catalog-pagination">${paginationMarkup(result, "catalog")}</div>
      ${seasonalShelf()}`}
    </div></section>`;
  }

  function templateDetail(template, { catalogReturn } = {}) {
    const version = template.versionId ? `&version=${encodeURIComponent(template.versionId)}` : "";
    return `<section class="detail-section"><div class="container">
      <div class="breadcrumb"><a href="${e(catalogReturn?.startsWith('/explore?') ? catalogReturn : '/explore')}" data-link>${icon("arrow-left", 17)} ${text("shell.footer.library")}</a></div>
      <div class="detail-grid"><div class="detail-info">
        <h1>${templateField(template, 'title')}</h1>
        <div class="detail-price-row"><strong>${priceText(template.price)}</strong></div>
        <div class="detail-art">${artwork(template, "artwork--detail",{eager:true})}</div>
        <div class="detail-body">
        <div class="detail-start-actions">
          <a class="btn btn--dark" href="${e(templateCreateUrl(template))}" data-link data-template-create-cta>${text("catalog.detail.use")}</a>
          <button class="btn btn--outline" type="button" data-template-preview aria-haspopup="dialog">${text("catalog.detail.preview")} ${icon('eye', 17)}</button>
        </div>
        <p>${text('catalog.cardType.detail', { type: { format: 'message', key: `catalog.cardType.${templateCardType(template)}` } })}</p>
        <p>${personalizationText(template.personalization)}</p>
        <p class="detail-palette">${template.palette ? text(`templates.meta.palette.${template.palette}`) : ""}</p><p class="detail-subtitle">${templateField(template, 'subtitle')}</p>
        <p class="detail-meta">${text('catalog.detail.meta', { creator: template.creator, count: template.scenes })}</p>
        <div class="detail-secondary-actions">
          <div class="detail-favorite-row">${favoriteButton(template.id, "favorite-button--inline")}<span>${text("catalog.detail.favoriteHint")}</span></div>
          ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=layout${version}`, template.personalization?.layout === false ? text("catalog.detail.viewLayout") : text("catalog.detail.editLayout"), "detail-text-action", false)}
          <button type="button" class="btn detail-text-action" data-action="report-content" data-kind="template" data-id="${e(template.id)}">${text("catalog.detail.report")}</button>
        </div>
        </div></div>
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
        ? `<p class="catalog-range" id="catalog-range" tabindex="-1">${text('catalog.results.range', pageData)}</p>
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
