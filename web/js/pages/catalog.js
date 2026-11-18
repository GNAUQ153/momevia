import { escapeHtml as e, formatPrice } from "../core/api.js";
import { icon } from "../ui/icons.js";
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

  function explore() {
    // Tùy chọn phong cách lấy từ dữ liệu, không tạo hàng chip có thể tràn ngang.
    const styles = styleOptions(state.templates);
    return `<section class="page-banner"><div class="container page-banner__inner"><span class="eyebrow">BỘ SƯU TẬP MOMEVIA</span><h1>Chọn một món quà <em>thật bạn.</em></h1><p>Mỗi mẫu là một cách kể chuyện. Chọn phong cách bạn yêu thích và biến nó thành lời chúc của riêng mình.</p></div></section>
    <section class="section catalog-section"><div class="container">
      <div class="catalog-toolbar"><div class="catalog-title"><h2>Thư viện quà tặng</h2><span id="catalog-count" aria-live="polite" aria-atomic="true">${countLabel(matchingTemplates().length)}</span></div>
        <label class="search-field">${icon("search", 19)}<span class="visually-hidden">Tìm kiếm mẫu</span><input type="search" id="template-search" placeholder="Tìm tên mẫu, phong cách..." value="${e(state.search)}"/></label></div>
      <div class="catalog-filters" role="group" aria-label="Bộ lọc thư viện">
        <label class="catalog-style-select"><span>${icon("filter", 17)} Phong cách</span><select id="style-filter" aria-label="Lọc theo phong cách">
          <option value="Tất cả" ${state.filter === "Tất cả" ? "selected" : ""}>Tất cả phong cách (${state.templates.length})</option>
          ${styles.map((item) => `<option value="${e(item.style)}" ${state.filter === item.style ? "selected" : ""}>${e(item.style)} (${item.count})</option>`).join("")}
        </select>${icon("chevron-down", 18)}</label>
        <label class="catalog-free-filter"><input id="free-filter" type="checkbox" ${state.freeOnly ? "checked" : ""}/><span>Chỉ mẫu miễn phí</span></label>
        <button type="button" class="catalog-reset" data-action="clear-filters">${icon("close", 15)} Đặt lại</button>
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
    const version = template.versionId ? `&version=${encodeURIComponent(template.versionId)}` : "";
    return `<section class="detail-section"><div class="container">
      <div class="breadcrumb"><a href="/explore" data-link>${icon("arrow-left", 17)} Thư viện mẫu</a><span>/</span><span>${e(template.title)}</span></div>
      <div class="detail-grid"><div class="detail-art">${artwork(template, "artwork--detail")}<div class="detail-preview-label">${icon("eye", 17)} Xem trước thiết kế</div>
        <button class="btn btn--outline btn--wide template-preview-trigger" type="button" data-template-preview>Trải nghiệm mẫu trước khi dùng ${icon('eye', 17)}</button><dialog class="template-preview-dialog" aria-label="Trải nghiệm mẫu ${e(template.title)}"><div class="template-preview-toolbar"><h2>${e(template.title)}</h2><button class="btn btn--outline" type="button" data-template-reset>Xem lại từ đầu</button><button class="btn btn--dark" type="button" data-template-close>Đóng</button></div><p class="template-preview-note">Nội dung minh họa. Lời đáp trong bản xem thử không được gửi đi.</p><div class="template-preview-player"></div></dialog>
      </div>
        <div class="detail-info"><span class="eyebrow">${e(template.style)} · ${e(template.scenes)} CẢNH TƯƠNG TÁC</span><h1>${e(template.title)}</h1><p class="detail-subtitle">${e(template.subtitle)}</p>
        <div class="detail-divider"></div><div class="detail-meta"><span>${icon("user", 18)} Thiết kế bởi ${e(template.creator)}</span><span>${icon("gift", 18)} ${e(template.effect)}</span><span>${icon("shield", 18)} Mở link không cần đăng nhập</span></div>
        <div class="detail-price-row"><div><small>Giá sử dụng mẫu</small><strong>${formatPrice(template.price)}</strong></div><span class="demo-label">${template.price === 0 ? 'Mẫu miễn phí' : 'Kiểm tra quyền trước khi xuất bản'}</span></div>
        <div class="detail-favorite-row">${favoriteButton(template.id, "favorite-button--inline")}<span>Lưu mẫu để xem lại sau</span></div>
        ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=quick${version}`, "Cá nhân hóa nhanh", "btn--dark btn--wide")}
        ${buttonLink(`/create/${encodeURIComponent(template.id)}?mode=layout${version}`, "Chỉnh bố cục", "btn--outline btn--wide")}
        <button class="btn btn--outline" data-action="report-content" data-kind="template" data-id="${e(template.id)}">Báo cáo mẫu</button>
        <p class="helper-text">${icon("check-circle", 16)} Bạn có thể thay tên, ảnh và lời chúc. Không cần biết thiết kế.</p>
        <div class="detail-note"><strong>Điều bạn sẽ nhận được</strong><p>Một món quà tương tác có đường link riêng, kèm khu vực để người nhận gửi lời hồi đáp. Nội dung sử dụng đúng phạm vi cá nhân hóa được cho phép.</p></div>
        </div>
      </div>
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
      ${
        templates.length
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
