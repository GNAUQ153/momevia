import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { personalizationLabels } from "../shared/canvas/personalization.js";
import { featuredSeasons, isInSeason } from "../features/catalog/seasonal.js";
import {
  filterTemplates,
  styleOptions,
  countLabel,
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
    });
  }
  // Điều hướng trang dùng chung cho danh sách mẫu và danh sách yêu thích.

  function catalogResultMarkup() {
    const result = paginateTemplates(matchingTemplates(), state.catalogPage);
    state.catalogPage = result.page;
    const cards = result.total
      ? result.items.map(templateCard).join("")
      : `<div class="empty-state">${icon("search", 32)}<h3>Chưa tìm thấy mẫu phù hợp</h3><p>Thử một từ khóa hoặc phong cách khác nhé.</p><button class="btn btn--outline" data-action="clear-filters">Xóa bộ lọc</button></div>`;
    return { result, cards };
  }

  function syncCatalogResults() {
    const grid = document.getElementById("catalog-grid");
    const count = document.getElementById("catalog-count");
    const navigation = document.getElementById("catalog-pagination");
    const range = document.getElementById("catalog-range");
    const { result, cards } = catalogResultMarkup();
    if (grid) grid.innerHTML = cards;
    if (count) count.textContent = countLabel(result.total);
    if (range)
      range.textContent = result.total
        ? `Hiển thị ${result.from}–${result.to} / ${result.total} mẫu`
        : "Không có mẫu phù hợp";
    if (navigation) navigation.innerHTML = paginationMarkup(result, "catalog");
  }

  function seasonalShelf() {
    const seasonal = featuredSeasons(state.templates);
    if (!seasonal.length) return '';
    return `<section class="seasonal-shelf" aria-labelledby="seasonal-shelf-title">
      <div class="seasonal-shelf__heading">
        <div><span class="seasonal-shelf__eyebrow">MOMEVIA SEASONAL COLLECTION</span>
          <h2 id="seasonal-shelf-title">Lời chúc theo mùa</h2>
          <p>Mỗi dịp đặc biệt đều xứng đáng có một món quà riêng.</p></div>
        <button type="button" class="seasonal-shelf__hint" data-action="filter-seasonal">Xem mẫu lễ hội</button>
      </div>
      <div class="seasonal-shelf__grid">${seasonal.map(template => `<a class="seasonal-shelf__card" href="/template/${encodeURIComponent(template.id)}" data-link>
        <img src="/assets/basic-templates/${encodeURIComponent(template.id)}.svg?v=2" width="390" height="844" loading="lazy" alt="Bìa mẫu ${e(template.title)}"/>
        <div><span>${isInSeason(template) ? 'Đang vào mùa' : e(template.season || 'Bộ sưu tập')}</span><strong>${e(template.title)}</strong></div>
      </a>`).join('')}</div>
    </section>`;
  }

  function explore() {
    // Tùy chọn phong cách lấy từ dữ liệu, không tạo hàng chip có thể tràn ngang.
    const styles = styleOptions(state.templates);
    return `<section class="section catalog-section catalog-compact"><div class="container">
      ${seasonalShelf()}
      <div class="catalog-toolbar"><div class="catalog-title"><h1>Thư viện quà tặng</h1><span id="catalog-count" aria-live="polite" aria-atomic="true">${countLabel(matchingTemplates().length)}</span></div>
        <label class="search-field">${icon("search", 19)}<span class="visually-hidden">Tìm kiếm mẫu</span><input type="search" id="template-search" placeholder="Tìm tên mẫu, dịp, phong cách…" value="${e(state.search)}"/></label></div>
      <div class="catalog-filters" role="group" aria-label="Bộ lọc thư viện">
        <label class="catalog-style-select"><span>${icon("filter", 17)} Phong cách</span><select id="style-filter" aria-label="Lọc theo phong cách">
          <option value="Tất cả" ${state.filter === "Tất cả" ? "selected" : ""}>Tất cả phong cách (${state.templates.length})</option>
          ${styles.map((item) => `<option value="${e(item.style)}" ${state.filter === item.style ? "selected" : ""}>${e(item.style)} (${item.count})</option>`).join("")}
        </select>${icon("chevron-down", 18)}</label>
        <label class="catalog-free-filter"><input id="free-filter" type="checkbox" ${state.freeOnly ? "checked" : ""}/><span>Miễn phí</span></label>
        <label class="catalog-free-filter"><input id="photo-filter" type="checkbox" ${state.photoOnly ? "checked" : ""}/><span>Thay được ảnh</span></label>
        <button type="button" class="catalog-reset" data-action="clear-filters">${icon("close", 15)} Bỏ lọc</button>
      </div>
      <div class="catalog-range" id="catalog-range" aria-live="polite">${(() => {
        const p = paginateTemplates(matchingTemplates(), state.catalogPage);
        return p.total
          ? `Hiển thị ${p.from}–${p.to} / ${p.total} mẫu`
          : "Không có mẫu phù hợp";
      })()}</div>
      <div class="template-grid catalog-grid" id="catalog-grid">${catalogResultMarkup().cards}</div>
      <div id="catalog-pagination">${paginationMarkup(paginateTemplates(matchingTemplates(), state.catalogPage), "catalog")}</div>
    </div></section>`;
  }

  function templateDetail(template) {
    // Nút xem thử chỉ hoạt động sau khi module trình phát gắn sự kiện.
    const version = template.versionId ? `&version=${encodeURIComponent(template.versionId)}` : "";
    return `<section class="detail-section"><div class="container">
      <div class="breadcrumb"><a href="/explore" data-link>${icon("arrow-left", 17)} Thư viện mẫu</a></div>
      <div class="detail-grid"><div class="detail-info">
        <h1>${e(template.title)}</h1>
        <div class="detail-price-row"><strong>${formatPrice(template.price)}</strong></div>
        <p>${e(personalizationLabels(template.personalization).join(' · '))}</p>
        <div class="detail-start-actions">
          ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=quick${version}`, "Dùng mẫu", "btn--dark", false)}
          <button class="btn btn--outline" type="button" data-template-preview disabled>Xem thử ${icon('eye', 17)}</button>
        </div>
        <p class="detail-subtitle">${e(template.subtitle)}</p>
        <p class="detail-meta">Thiết kế bởi ${e(template.creator)} · ${e(template.scenes)} cảnh</p>
        <div class="detail-favorite-row">${favoriteButton(template.id, "favorite-button--inline")}<span>Lưu mẫu để xem lại sau</span></div>
        ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=layout${version}`, template.personalization?.layout === false ? "Xem bố cục" : "Chỉnh bố cục", "btn--outline")}
        <button class="btn btn--outline" data-action="report-content" data-kind="template" data-id="${e(template.id)}">Báo cáo mẫu</button>
        </div><div class="detail-art">${artwork(template, "artwork--detail")}</div>
      </div>
      <dialog class="template-preview-dialog" aria-label="Xem thử mẫu ${e(template.title)}"><div class="template-preview-toolbar"><h2>${e(template.title)}</h2><button class="btn btn--outline" type="button" data-template-reset>Xem lại từ đầu</button><button class="btn btn--dark" type="button" data-template-close>Đóng</button></div><p class="template-preview-note">Nội dung minh họa. Lời đáp trong bản xem thử được mô phỏng.</p><div class="template-preview-player"></div></dialog>
    </div></section>`;
  }

  function favoritesPage() {
    const templates = state.templates.filter((item) =>
      state.favorites.has(item.id),
    );
    const pageData = paginateTemplates(templates, state.favoritePage);
    state.favoritePage = pageData.page;
    return `<section class="page-banner"><div class="container page-banner__inner">
      <span class="eyebrow">DANH SÁCH CỦA BẠN</span><h1>Mẫu quà <em>yêu thích.</em></h1>
      <p>Lưu những thiết kế bạn thích và quay lại bất cứ lúc nào.</p>
    </div></section><section class="section"><div class="container">
      <div class="dashboard-heading"><h2>Đã lưu ${templates.length} mẫu</h2>${buttonLink("/explore", "Khám phá thêm")}</div>
      ${templates.length
        ? `<p class="catalog-range">Hiển thị ${pageData.from}–${pageData.to} / ${pageData.total} mẫu</p>
        <div class="template-grid">${pageData.items.map(templateCard).join("")}</div>${paginationMarkup(pageData, "favorites")}`
        : `<div class="empty-state empty-state--panel">${icon("heart", 36)}<h3>Chưa có mẫu yêu thích</h3>
        <p>Nhấn biểu tượng trái tim trên mẫu bạn thích để lưu vào đây.</p>${buttonLink("/explore", "Xem kho mẫu")}</div>`
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
