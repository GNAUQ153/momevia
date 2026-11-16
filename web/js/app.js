import { api, ApiError, escapeHtml as e, formatPrice } from './api.js';
import { icon } from './icons.js';
import { filterTemplates, styleOptions, countLabel, paginateTemplates } from './catalog-filter.js';
import { legalPages, legalPage } from './legal.js';
import { giftQrDataUrl } from './qr.js';

const state = {
  user: null,
  providers: { demo: true, google: false, zalo: false },
  templates: [],
  filter: 'Tất cả',
  freeOnly: false,
  search: '',
  catalogPage: 1,
  favoritePage: 1,
  photoDataUrl: null,
  giftOpened: false,
  afterLogin: null,
  purchased: new Set(),
  favorites: new Set(),
  pendingFavoriteId: null,
};
const main = document.getElementById('main');
const modal = document.getElementById('modal-root');
const header = document.getElementById('site-header');
const footer = document.getElementById('site-footer');

function buttonLink(path, label, style = 'btn--dark', trailing = true) {
  return `<a class="btn ${style}" href="${path}" data-link>${label} ${trailing ? icon('arrow-up-right', 17) : ''}</a>`;
}
function navigate(path) {
  history.pushState({}, '', path);
  window.scrollTo({ top: 0, behavior: 'instant' });
  state.photoDataUrl = null;
  state.giftOpened = false;
  render();
}
function toast(message, type = 'success') {
  const host = document.getElementById('toast-host');
  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  item.innerHTML = `${icon(type === 'success' ? 'check-circle' : 'shield', 18)} <span>${e(message)}</span>`;
  host.replaceChildren(item);
  setTimeout(() => { if (item.parentNode) item.remove(); }, 4800);
}
function requireLogin(path) {
  if (state.user) return true;
  state.afterLogin = path;
  navigate('/login');
  return false;
}
function activeLink(path, label, section = '') {
  const current = location.pathname;
  const hash = location.hash;
  const active = path === '/'
    ? current === '/' && hash !== '#how-it-works'
    : section
      ? current === '/' && hash === '#how-it-works'
      : current === path || (path === '/explore' && ['/template/', '/create/'].some(prefix => current.startsWith(prefix)));
  return `<a href="${path}" data-link class="${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
}
function refreshNav() {
  const signedIn = Boolean(state.user);
  const links = [
    activeLink('/', 'Trang chủ'),
    activeLink('/explore', 'Khám phá mẫu'),
    activeLink('/#how-it-works', 'Cách hoạt động', 'how-it-works'),
    activeLink('/creator', 'Cho nhà sáng tạo'),
    activeLink('/about', 'Về chúng tôi'),
  ];
  const studioActive = location.pathname === '/studio' || location.pathname === '/favorites';
  header.innerHTML = `
    <div class="container nav-inner">
      <a class="brand" href="/" data-link aria-label="Momevia - Trang chủ">
        <img class="brand-mark" src="/assets/momevia-logo-3d.png" alt="" width="50" height="50" />
        <span class="brand-name">momevia<span class="brand-period">.</span></span>
      </a>
      <nav class="nav-links" aria-label="Điều hướng chính">${links.join('')}</nav>
      <div class="nav-actions">
        ${signedIn ? `
          <a class="nav-studio ${studioActive ? 'is-current' : ''}" href="/studio" data-link ${studioActive ? 'aria-current="page"' : ''}>${icon('layers', 17)} Không gian của tôi</a>
          <button type="button" class="avatar-button" data-action="account-menu" aria-label="Tài khoản ${e(state.user.name)}" title="Tài khoản">${e(state.user.name.charAt(0).toUpperCase())}</button>
        ` : `<a class="btn btn--dark login-trigger" href="/login" data-link>Đăng nhập</a>`}
        <button type="button" class="icon-button nav-toggle" data-action="toggle-menu" aria-label="Mở menu" aria-expanded="false">${icon('menu', 22)}</button>
      </div>
    </div>
    ${signedIn ? `<div class="account-menu" id="account-menu" hidden>
      <div class="account-menu__meta"><strong>${e(state.user.name)}</strong><span>${state.user.role === 'creator' ? 'Nhà sáng tạo' : state.user.role === 'admin' ? 'Quản trị viên' : 'Người gửi'}</span></div>
      <a href="/studio" data-link>${icon('layers', 16)} Món quà của tôi</a>
      <a href="/favorites" data-link>${icon('heart', 16)} Mẫu yêu thích</a>
      <a href="/creator" data-link>${icon('pencil', 16)} Creator Studio</a>
      ${state.user.role === 'admin' ? `<a href="/admin" data-link>${icon('shield', 16)} Kiểm duyệt</a>` : ''}
      <button type="button" data-action="logout">${icon('log-out', 16)} Đăng xuất</button>
    </div>` : ''}
    <div class="mobile-nav" id="mobile-nav" hidden>
      ${links.join('')}
      ${signedIn ? '<a href="/studio" data-link>Không gian của tôi</a><a href="/favorites" data-link>Mẫu yêu thích</a>' : '<a href="/login" data-link>Đăng nhập</a>'}
    </div>
  `;
  footer.innerHTML = `
    <div class="container footer-grid">
      <div class="footer-about"><div class="footer-logo">momevia<span>.</span></div>
      <p>Mỗi lời chúc đều xứng đáng trở thành một trải nghiệm đáng nhớ.</p>
      <span class="footnote">Gửi điều thương, giữ kỷ niệm.</span></div>
      <div class="footer-column"><h4>Khám phá</h4><a href="/explore" data-link>Thư viện mẫu</a><a href="/creator" data-link>Trở thành Creator</a></div>
      <div class="footer-column"><h4>Thông tin</h4><a href="/about" data-link>Về chúng tôi</a><a href="/favorites" data-link>Mẫu yêu thích</a><button class="footer-contact" data-action="support">Liên hệ hỗ trợ</button></div>
      <div class="footer-column"><h4>Chính sách</h4><a href="/policies/general" data-link>Chính sách & Quy định chung</a><a href="/policies/payment" data-link>Chính sách thanh toán</a><a href="/policies/privacy" data-link>Chính sách bảo mật</a><a href="/policies/content" data-link>Nội dung & Bản quyền</a></div>
      <div class="footer-news"><span class="footer-bloom">${icon('sparkles', 22)}</span><h3>Một bất ngờ nhỏ, một niềm vui lớn.</h3><a href="/explore" data-link>Khám phá ngay ${icon('arrow', 17)}</a></div>
    </div><div class="container footer-bottom"><span>© 2026 Momevia. Bảo lưu mọi quyền.</span><span>Thiết kế với sự quan tâm đến từng chi tiết.</span></div>
  `;
}
function artwork(template, variant = '') {
  const theme = e(template.theme || 'violet');
  const title = e(template.title || 'A little wish');
  const small = e(template.subtitle || 'Made with love');
  return `<div class="artwork artwork--${theme} ${variant}">
    <span class="artwork__blur artwork__blur--one"></span>
    <span class="artwork__blur artwork__blur--two"></span>
    <span class="artwork__shape artwork__shape--one"></span>
    <span class="artwork__shape artwork__shape--two"></span>
    <span class="artwork__shape artwork__shape--three"></span>
    <div class="artwork__content">
      <span class="artwork__eyebrow">A NOTE FOR YOU</span>
      <span class="artwork__symbol">${icon('sparkles', 37)}</span>
      <strong>${title}</strong>
      <em>${small}</em>
      <span class="artwork__tinyline"></span>
    </div>
  </div>`;
}
function favoriteButton(templateId, variant = '') {
  const saved = state.favorites.has(templateId);
  return `<button type="button" class="favorite-button ${variant} ${saved ? 'is-saved' : ''}" data-action="toggle-favorite" data-id="${e(templateId)}"
    aria-label="${saved ? 'Bỏ yêu thích' : 'Lưu mẫu vào yêu thích'}" aria-pressed="${saved}" title="${saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}">
    ${icon('heart', 20)}
  </button>`;
}
function templateCard(template, i = 0) {
  return `<article class="template-card">
    <a href="/template/${encodeURIComponent(template.id)}" data-link class="template-card__visual" aria-label="Xem mẫu ${e(template.title)}">
      ${artwork(template)}
      <span class="template-card__view">${icon('eye', 16)} Xem mẫu</span>
    </a>
    ${favoriteButton(template.id)}
    <div class="template-card__info"><div class="template-card__caption">${e(template.style)} <span class="dot-separator"></span> ${e(template.scenes)} cảnh</div>
      <a href="/template/${encodeURIComponent(template.id)}" data-link class="template-card__title">${e(template.title)}</a>
      <p>${e(template.subtitle)}</p>
      <div class="template-card__bottom"><span>${e(template.creator)}</span><strong>${formatPrice(template.price)}</strong></div>
    </div>
  </article>`;
}
function hero() {
  const featured = state.templates.find(t => t.id === 'midnight-bloom') || state.templates[0] || {theme:'violet',title:'Midnight Bloom',subtitle:'A LITTLE WISH'};
  return `<section class="hero"><div class="container hero-grid">
    <div class="hero-copy">
      <span class="eyebrow eyebrow--outlined">${icon('sparkles', 15)} Một cách gửi yêu thương mới</span>
      <h1>Không chỉ là<br>một lời chúc.<br><em>Là một khoảnh khắc.</em></h1>
      <p>Biến những điều bạn muốn nói thành món quà tương tác đầy bất ngờ. Cá nhân hóa trong vài phút, gửi đi chỉ với một đường link.</p>
      <div class="hero-buttons">${buttonLink('/explore', 'Tạo món quà đầu tiên')}<a href="/#how-it-works" data-link class="btn btn--outline">Xem cách hoạt động ${icon('arrow', 17)}</a></div>
      <div class="hero-proof"><div class="proof-icons"><span>${icon('heart', 17)}</span><span>${icon('gift', 17)}</span><span>${icon('sparkles', 17)}</span></div><span>Không cần biết thiết kế <strong>·</strong> Người nhận không cần tài khoản</span></div>
    </div>
    <div class="hero-display">
      <div class="hero-orbit hero-orbit--one"></div><div class="hero-orbit hero-orbit--two"></div>
      <span class="hero-tiny-spark hero-tiny-spark--a">${icon('sparkles', 30)}</span>
      <span class="hero-tiny-spark hero-tiny-spark--b">${icon('star', 25)}</span>
      <div class="hero-card-frame">${artwork(featured, 'hero-artwork')}<div class="hero-card-caption">GỬI RIÊNG MỘT NGƯỜI THƯƠNG</div></div>
      <div class="floating-note floating-note--left">${icon('heart', 20)} <div><strong>Một điều thật riêng</strong><span>Chỉ dành cho người ấy</span></div></div>
      <div class="floating-note floating-note--right">${icon('message-circle', 19)} <div><strong>Lời hồi đáp</strong><span>Kỷ niệm của hai người</span></div></div>
    </div>
  </div></section>`;
}
function steps() {
  const items = [
    {number:'01', title:'Chọn điều bạn thích', text:'Khám phá những mẫu quà mang phong cách riêng, từ ngọt ngào đến tinh nghịch.', icon:'layers'},
    {number:'02', title:'Thêm dấu ấn của bạn', text:'Điền tên, một lời chúc và bức ảnh để món quà trở nên thật đặc biệt.', icon:'pencil'},
    {number:'03', title:'Gửi niềm vui đi xa', text:'Chia sẻ đường link. Người ấy mở quà, tương tác và để lại lời hồi đáp.', icon:'send'},
  ];
  return `<section id="how-it-works" class="section section--cream"><div class="container">
    <div class="section-heading section-heading--center"><span class="eyebrow">THẬT DỄ ĐỂ BẮT ĐẦU</span><h2>Chỉ ba bước, <em>ngàn cảm xúc.</em></h2><p>Không cần kỹ năng thiết kế. Chỉ cần bạn có điều muốn nói.</p></div>
    <div class="steps-grid">${items.map(item => `<article class="step-card"><div class="step-number">${item.number}</div><div class="step-icon">${icon(item.icon, 28)}</div><h3>${item.title}</h3><p>${item.text}</p></article>`).join('')}</div>
  </div></section>`;
}
function home() {
  const featured = state.templates.filter(item => item.featured).slice(0,3);
  return `${hero()}
    <section class="section section--white"><div class="container"><div class="section-heading section-heading--split">
      <div><span class="eyebrow">DÀNH RIÊNG CHO NHỮNG DỊP ĐẶC BIỆT</span><h2>Những món quà <em>được yêu thích.</em></h2></div>
      <a href="/explore" data-link class="inline-link">Xem tất cả mẫu ${icon('arrow', 19)}</a></div>
      <div class="template-grid">${featured.map(templateCard).join('')}</div></div></section>
    ${steps()}
    <section class="section section--white"><div class="container story-grid"><div class="story-visual"><div class="story-letter"><div class="story-letter__icon">${icon('heart',34)}</div><p>Có những điều, nói một lần vẫn chưa đủ.</p><span>— MỘT LỜI NHẮN GỬI</span></div><div class="story-seal">${icon('sparkles', 22)}</div></div>
      <div class="story-content"><span class="eyebrow">HƠN CẢ MỘT TẤM THIỆP</span><h2>Món quà kết thúc,<br><em>kỷ niệm ở lại.</em></h2><p>Ở Momevia, người nhận không chỉ xem lời chúc. Họ có thể mở từng bất ngờ, gửi lại lời nhắn và cùng bạn lưu giữ khoảnh khắc ấy.</p><ul class="feature-list"><li>${icon('check-circle',18)} Trải nghiệm tương tác trên điện thoại</li><li>${icon('check-circle',18)} Lời hồi đáp chỉ dành cho người có link</li><li>${icon('check-circle',18)} Dễ chia sẻ, không cần cài ứng dụng</li></ul>${buttonLink('/explore','Bắt đầu tạo quà')}</div></div></section>
    <section class="section creator-band"><div class="container creator-band__inner"><div><span class="eyebrow">DÀNH CHO NHÀ SÁNG TẠO</span><h2>Thiết kế của bạn.<br><em>Cảm xúc của ai đó.</em></h2><p>Biến ý tưởng đẹp thành những món quà có thể cá nhân hóa. Đăng mẫu miễn phí và bắt đầu xây dựng gian hàng riêng.</p>${buttonLink('/creator','Khám phá Creator Studio','btn--light')}</div><div class="creator-band__art">${icon('sparkles', 105)}</div></div></section>`;
}
function matchingTemplates() {
  return filterTemplates(state.templates, { style: state.filter, search: state.search, freeOnly: state.freeOnly });
}
// Điều hướng trang dùng chung cho danh sách mẫu và danh sách yêu thích.
function paginationMarkup(result, listName) {
  if (result.totalPages <= 1) return '';
  const pageButton = (number) => `<button type="button" class="pagination__number ${number === result.page ? 'is-current' : ''}"
    data-action="set-page" data-list="${listName}" data-page="${number}" aria-label="Trang ${number}"
    ${number === result.page ? 'aria-current="page"' : ''}>${number}</button>`;
  // Chỉ hiển thị tối đa 5 số trang để không tràn ngang trên điện thoại.
  let first = Math.max(1, result.page - 2);
  const last = Math.min(result.totalPages, first + 4);
  first = Math.max(1, last - 4);
  const numbers = Array.from({length: last - first + 1}, (_, i) => pageButton(first + i)).join('');
  return `<nav class="pagination" aria-label="Phân trang ${listName === 'favorites' ? 'mẫu yêu thích' : 'thư viện mẫu'}">
    <button type="button" class="pagination__arrow" data-action="set-page" data-list="${listName}" data-page="${result.page - 1}"
      ${result.page === 1 ? 'disabled' : ''} aria-label="Trang trước">${icon('arrow-left', 17)} <span>Trước</span></button>
    <div class="pagination__pages">${numbers}</div>
    <button type="button" class="pagination__arrow" data-action="set-page" data-list="${listName}" data-page="${result.page + 1}"
      ${result.page === result.totalPages ? 'disabled' : ''} aria-label="Trang tiếp theo"><span>Tiếp</span> ${icon('arrow', 17)}</button>
  </nav>`;
}
function catalogResultMarkup() {
  const result = paginateTemplates(matchingTemplates(), state.catalogPage);
  state.catalogPage = result.page;
  const cards = result.total
    ? result.items.map(templateCard).join('')
    : `<div class="empty-state">${icon('search',32)}<h3>Chưa tìm thấy mẫu phù hợp</h3><p>Thử một từ khóa hoặc phong cách khác nhé.</p><button class="btn btn--outline" data-action="clear-filters">Xóa bộ lọc</button></div>`;
  return { result, cards };
}
function syncCatalogResults() {
  const grid = document.getElementById('catalog-grid');
  const count = document.getElementById('catalog-count');
  const navigation = document.getElementById('catalog-pagination');
  const range = document.getElementById('catalog-range');
  const { result, cards } = catalogResultMarkup();
  if (grid) grid.innerHTML = cards;
  if (count) count.textContent = countLabel(result.total);
  if (range) range.textContent = result.total ? `Hiển thị ${result.from}–${result.to} / ${result.total} mẫu` : 'Không có mẫu phù hợp';
  if (navigation) navigation.innerHTML = paginationMarkup(result, 'catalog');
}
function explore() {
  // Tùy chọn phong cách lấy từ dữ liệu, không tạo hàng chip có thể tràn ngang.
  const styles = styleOptions(state.templates);
  return `<section class="page-banner"><div class="container page-banner__inner"><span class="eyebrow">BỘ SƯU TẬP MOMEVIA</span><h1>Chọn một món quà <em>thật bạn.</em></h1><p>Mỗi mẫu là một cách kể chuyện. Chọn phong cách bạn yêu thích và biến nó thành lời chúc của riêng mình.</p></div></section>
  <section class="section catalog-section"><div class="container">
    <div class="catalog-toolbar"><div class="catalog-title"><h2>Thư viện quà tặng</h2><span id="catalog-count" aria-live="polite" aria-atomic="true">${countLabel(matchingTemplates().length)}</span></div>
      <label class="search-field">${icon('search',19)}<span class="visually-hidden">Tìm kiếm mẫu</span><input type="search" id="template-search" placeholder="Tìm tên mẫu, phong cách..." value="${e(state.search)}"/></label></div>
    <div class="catalog-filters" role="group" aria-label="Bộ lọc thư viện">
      <label class="catalog-style-select"><span>${icon('filter',17)} Phong cách</span><select id="style-filter" aria-label="Lọc theo phong cách">
        <option value="Tất cả" ${state.filter === 'Tất cả' ? 'selected' : ''}>Tất cả phong cách (${state.templates.length})</option>
        ${styles.map(item => `<option value="${e(item.style)}" ${state.filter === item.style ? 'selected' : ''}>${e(item.style)} (${item.count})</option>`).join('')}
      </select>${icon('chevron-down',18)}</label>
      <label class="catalog-free-filter"><input id="free-filter" type="checkbox" ${state.freeOnly ? 'checked' : ''}/><span>Chỉ mẫu miễn phí</span></label>
      <button type="button" class="catalog-reset" data-action="clear-filters">${icon('close',15)} Đặt lại</button>
    </div>
    <div class="catalog-range" id="catalog-range" aria-live="polite">${(() => { const p = paginateTemplates(matchingTemplates(), state.catalogPage); return p.total ? `Hiển thị ${p.from}–${p.to} / ${p.total} mẫu` : 'Không có mẫu phù hợp'; })()}</div>
    <div class="template-grid catalog-grid" id="catalog-grid">${catalogResultMarkup().cards}</div>
    <div id="catalog-pagination">${paginationMarkup(paginateTemplates(matchingTemplates(), state.catalogPage), 'catalog')}</div>
  </div></section>`;
}
function templateDetail(template) {
  return `<section class="detail-section"><div class="container">
    <div class="breadcrumb"><a href="/explore" data-link>${icon('arrow-left',17)} Thư viện mẫu</a><span>/</span><span>${e(template.title)}</span></div>
    <div class="detail-grid"><div class="detail-art">${artwork(template,'artwork--detail')}<div class="detail-preview-label">${icon('eye',17)} Xem trước thiết kế</div></div>
      <div class="detail-info"><span class="eyebrow">${e(template.style)} · ${e(template.scenes)} CẢNH TƯƠNG TÁC</span><h1>${e(template.title)}</h1><p class="detail-subtitle">${e(template.subtitle)}</p>
      <div class="detail-divider"></div><div class="detail-meta"><span>${icon('user',18)} Thiết kế bởi ${e(template.creator)}</span><span>${icon('gift',18)} ${e(template.effect)}</span><span>${icon('shield',18)} Mở link không cần đăng nhập</span></div>
      <div class="detail-price-row"><div><small>Giá sử dụng mẫu</small><strong>${formatPrice(template.price)}</strong></div><span class="demo-label">Tính năng mua mẫu sẽ sớm ra mắt</span></div>
      <div class="detail-favorite-row">${favoriteButton(template.id, 'favorite-button--inline')}<span>Lưu mẫu để xem lại sau</span></div>
      ${buttonLink(`/create/${encodeURIComponent(template.id)}`,'Cá nhân hóa mẫu này', 'btn--dark btn--wide')}
      <p class="helper-text">${icon('check-circle',16)} Bạn có thể thay tên, ảnh và lời chúc. Không cần biết thiết kế.</p>
      <div class="detail-note"><strong>Điều bạn sẽ nhận được</strong><p>Một món quà tương tác có đường link riêng, kèm khu vực để người nhận gửi lời hồi đáp. Nội dung sử dụng đúng phạm vi cá nhân hóa được cho phép.</p></div>
      </div>
    </div>
  </div></section>`;
}
function livePreview(template) {
  return `<div class="preview-panel"><div class="preview-heading"><span>${icon('eye',18)} Xem trước</span><span class="preview-live">TRỰC TIẾP</span></div>
    <div class="live-preview artwork artwork--${e(template.theme)}">
      <span class="artwork__blur artwork__blur--one"></span><span class="artwork__shape artwork__shape--three"></span>
      <div class="live-preview__inner"><span class="live-preview__eyebrow">A LITTLE NOTE FOR</span><h3 id="preview-name">Người đặc biệt</h3><span class="preview-spark">${icon('sparkles',42)}</span><p id="preview-message">Điều đẹp nhất là có bạn trong cuộc đời này.</p><span id="preview-photo" class="preview-photo" hidden></span><small id="preview-sender">Từ một người thương</small></div>
    </div><p class="preview-help">${icon('shield',16)} Chỉ người có link riêng mới xem được nội dung quà.</p>
  </div>`;
}
async function createPage(template) {
  const isSigned = Boolean(state.user);
  if (!isSigned) {
    setTimeout(() => requireLogin(`/create/${template.id}`), 50);
    return `<section class="section"><div class="container"><div class="centered-loading">${icon('lock',25)} Vui lòng đăng nhập để tiếp tục cá nhân hóa.</div></div></section>`;
  }
  const orders = await api.get('/checkout/orders').catch(() => ({orders:[]}));
  const licensed = template.price === 0 || orders.orders.some(o => o.templateId === template.id && o.status === 'demo_paid');
  state.purchased = new Set(orders.orders.filter(o => o.status === 'demo_paid').map(o => o.templateId));
  return `<section class="builder-section"><div class="container"><div class="breadcrumb"><a href="/template/${encodeURIComponent(template.id)}" data-link>${icon('arrow-left',17)} Quay lại mẫu</a><span>/</span><span>Cá nhân hóa</span></div>
    <div class="builder-header"><div><span class="eyebrow">MỘT CHÚT RIÊNG, MỘT CHÚT THƯƠNG</span><h1>Biến mẫu thành <em>món quà của bạn.</em></h1><p>Thêm những điều bạn muốn nói. Chúng mình đã chuẩn bị phần còn lại.</p></div><span class="builder-template-pill">${icon('layers',17)} ${e(template.title)}</span></div>
    <div class="builder-grid"><div class="builder-form-wrap"><form id="create-gift-form" data-template-id="${e(template.id)}">
      <div class="form-step-head"><span>01</span><div><h2>Dành tặng ai?</h2><p>Chỉ cần một vài thông tin nhỏ thôi.</p></div></div>
      <div class="form-row"><label class="field"><span>Tên người nhận <sup>*</sup></span><input id="recipientName" name="recipientName" maxlength="60" required placeholder="Ví dụ: Linh, bạn thân, mẹ yêu..." autocomplete="off"/></label>
      <label class="field"><span>Tên của bạn <sup>*</sup></span><input id="senderName" name="senderName" maxlength="60" required placeholder="Người gửi món quà" value="${e(state.user.name)}"/></label></div>
      <label class="field"><span>Lời chúc từ trái tim <sup>*</sup></span><textarea id="gift-message" name="message" required maxlength="1000" rows="5" placeholder="Hãy viết điều mà bạn muốn người ấy nhớ mãi..."></textarea><small>Tối đa 1.000 ký tự</small></label>
      <div class="form-step-head form-step-head--separated"><span>02</span><div><h2>Thêm một bức ảnh</h2><p>Không bắt buộc, nhưng sẽ làm món quà thật riêng.</p></div></div>
      <label class="photo-drop" for="gift-photo"><span>${icon('upload-cloud',25)}</span><strong>Chọn ảnh từ thiết bị</strong><small>JPG, PNG hoặc WebP · Tối đa 2 MB</small><input type="file" id="gift-photo" class="visually-hidden" accept="image/png,image/jpeg,image/webp"/></label>
      <div class="form-bottom"><div class="demo-notice">${icon('shield',20)}<p>Bạn có thể trải nghiệm mẫu miễn phí; thanh toán trực tuyến đang được hoàn thiện.</p></div>
      ${licensed ? `<button type="submit" class="btn btn--dark btn--wide">Xuất bản món quà ${icon('arrow',19)}</button>` : `<button type="button" class="btn btn--dark btn--wide" data-action="demo-buy" data-id="${e(template.id)}">Dùng thử mẫu này ${icon('arrow',18)}</button><p class="helper-text">Bạn có thể dùng thử mẫu này mà không phải thanh toán. Tính năng mua mẫu sẽ được bổ sung sau.</p>`}</div>
    </form></div>${livePreview(template)}</div>
  </div></section>`;
}
function successPage(gift) {
  const url = `${location.origin}/g/${gift.slug}`;
  return `<section class="success-section"><div class="container"><div class="success-card"><span class="success-emblem">${icon('check', 35)}</span>
    <span class="eyebrow">MỘT BẤT NGỜ ĐÃ SẴN SÀNG</span><h1>Món quà của bạn<br><em>đã thành hình.</em></h1><p>Gửi ngay đường link này để người ấy khám phá điều bất ngờ bạn đã chuẩn bị.</p>
    <div class="share-link"><input id="share-link" readonly value="${e(url)}" aria-label="Đường link quà tặng"/><button data-action="copy-link" data-value="${e(url)}">${icon('copy',18)} Sao chép</button></div>
    <div class="success-buttons">${buttonLink(`/g/${encodeURIComponent(gift.slug)}`,'Xem món quà','btn--dark')}
    <button class="btn btn--outline" data-action="qr" data-value="${e(url)}">${icon('qr-code',18)} Tạo mã QR</button></div>
    <div class="success-foot">${icon('lock',15)} Link riêng chỉ nên gửi cho người bạn tin tưởng.</div>
  </div></div></section>`;
}
function giftPage(gift, replies = []) {
  return `<section class="recipient-page recipient-page--${e(gift.theme)}"><div class="recipient-backdrop recipient-backdrop--one"></div><div class="recipient-backdrop recipient-backdrop--two"></div>
    <div class="recipient-wrapper"><div class="gift-topline"><span>${icon('sparkles',17)} MỘT MÓN QUÀ TỪ MOMEVIA</span><span>${icon('lock',14)} ĐƯỜNG LINK RIÊNG</span></div>
      <div class="recipient-card ${state.giftOpened ? 'is-open' : ''}" id="recipient-card">
        <div class="recipient-sealed"><span class="recipient-sealed__subtitle">DÀNH RIÊNG CHO</span><h1>${e(gift.recipientName)}</h1><div class="envelope-scene"><span class="envelope-scene__letter"></span><span class="envelope-scene__body"></span><span class="envelope-scene__flap"></span><span class="envelope-scene__seal">${icon('heart',24)}</span></div>
          <p>Một điều bất ngờ đang chờ bạn ở đây.</p><button class="btn btn--gift" data-action="open-gift">Chạm để mở quà ${icon('arrow',18)}</button></div>
        <div class="recipient-surprise"><span class="eyebrow">MỘT BẤT NGỜ THẬT RIÊNG</span><div class="surprise-halo">${icon('sparkles',67)}</div><h2>Ngày hôm nay<br><em>có điều đặc biệt.</em></h2><p>Có người đã dành thời gian để gửi đến bạn một lời chúc từ trái tim.</p><button class="btn btn--gift" data-action="reveal-gift">Khám phá lời nhắn ${icon('arrow',18)}</button></div>
        <div class="recipient-opened"><span class="eyebrow">A LETTER FROM SOMEONE SPECIAL</span><div class="opened-spark">${icon('sparkles',42)}</div>
          <h1>Gửi ${e(gift.recipientName)},</h1>
          ${gift.photoUrl ? `<img class="recipient-photo" src="${e(gift.photoUrl)}" alt="Bức ảnh người gửi chọn cho món quà"/>` : ''}
          <p class="recipient-message">${e(gift.message)}</p><div class="recipient-signature">Thương mến,<br><strong>${e(gift.senderName)}</strong></div>
          <div class="reply-container"><div class="reply-heading">${icon('message-circle',24)}<div><h2>Gửi lời hồi đáp</h2><p>Viết vài dòng để cùng lưu lại khoảnh khắc này.</p></div></div>
            <form id="reply-form" data-slug="${e(gift.slug)}"><label class="field"><span>Tên bạn</span><input name="name" maxlength="50" placeholder="Tên người nhận" value="${e(gift.recipientName)}"/></label>
              <label class="field"><span>Lời nhắn</span><textarea name="message" rows="3" maxlength="1000" required placeholder="Mình nhận được quà rồi, cảm ơn bạn rất nhiều..."></textarea></label>
              <button class="btn btn--dark" type="submit">Gửi hồi đáp ${icon('send',17)}</button></form>
          </div>
          <div class="memory-container"><h3>${icon('heart',19)} Góc kỷ niệm <span>(${replies.length})</span></h3><div class="reply-list" id="reply-list">${renderReplies(replies)}</div></div>
        </div>
      </div>
      <p class="recipient-disclaimer">Đường link có thể được chuyển tiếp. Mọi người có link đều xem được lời hồi đáp.</p>
      <a class="recipient-footer-logo" href="/" data-link>Created with <strong>momevia.</strong></a>
    </div>
  </section>`;
}
function renderReplies(replies) {
  return replies.length ? replies.map(r => `<article class="reply-item"><div class="reply-avatar">${e(r.name.charAt(0).toUpperCase())}</div><div><strong>${e(r.name)}</strong><span>${new Date(r.createdAt).toLocaleDateString('vi-VN')}</span><p>${e(r.message)}</p></div></article>`).join('') : '<p class="no-replies">Chưa có lời hồi đáp. Hãy là người đầu tiên viết một điều dễ thương.</p>';
}
function dashboard(gifts, orders) {
  return `<section class="page-banner page-banner--dashboard"><div class="container"><span class="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Xin chào, <em>${e(state.user.name)}.</em></h1><p>Nơi những món quà bạn gửi đi luôn được nâng niu.</p></div></section>
  <section class="section dashboard-section"><div class="container"><div class="dashboard-stats">
    <article class="stat-card">${icon('gift',23)}<strong>${gifts.length}</strong><span>Món quà đã tạo</span></article>
    <article class="stat-card">${icon('message-circle',23)}<strong>${gifts.reduce((n,g)=>n+g.replyCount,0)}</strong><span>Lời hồi đáp</span></article>
    <article class="stat-card">${icon('layers',23)}<strong>${orders.length}</strong><span>Mẫu đã dùng thử</span></article>
  </div><div class="dashboard-heading"><div><span class="eyebrow">BỘ SƯU TẬP CỦA TÔI</span><h2>Những điều bạn đã gửi.</h2></div><div class="dashboard-heading__actions"><a class="btn btn--outline" href="/favorites" data-link>${icon('heart',17)} Mẫu yêu thích (${state.favorites.size})</a>${buttonLink('/explore','Tạo quà mới')}</div></div>
    ${gifts.length ? `<div class="my-gifts">${gifts.map(g => `<article class="my-gift"><div class="my-gift-art artwork artwork--${e(g.theme)}">${icon('gift',40)}</div><div class="my-gift-detail"><span>GỬI TỚI ${e(g.recipientName).toLocaleUpperCase('vi')}</span><h3>${e(g.templateTitle)}</h3><p>${new Date(g.createdAt).toLocaleDateString('vi-VN')} · ${g.replyCount} lời hồi đáp</p></div><div class="my-gift-actions"><a href="/g/${e(g.slug)}" data-link class="btn btn--outline">Mở quà ${icon('arrow-up-right',16)}</a><button class="icon-button" aria-label="Sao chép link" data-action="copy-link" data-value="${e(`${location.origin}/g/${g.slug}`)}">${icon('copy',18)}</button></div></article>`).join('')}</div>`
    : `<div class="empty-state empty-state--panel">${icon('gift',38)}<h3>Chưa có món quà nào</h3><p>Mọi kỷ niệm đẹp đều bắt đầu từ một hành động nhỏ.</p>${buttonLink('/explore','Khám phá mẫu đầu tiên')}</div>`}
  </div></section>`;
}
function creatorPage(templates = []) {
  const creator = state.user && ['creator','admin'].includes(state.user.role);
  return `<section class="creator-hero"><div class="container creator-hero__inner"><div><span class="eyebrow">MOMEVIA FOR CREATORS</span><h1>Biến sự sáng tạo<br><em>thành những món quà.</em></h1><p>Mỗi thiết kế độc đáo xứng đáng đến được với đúng người. Đăng mẫu, quản lý gian hàng và để ý tưởng của bạn được yêu mến.</p>
      ${creator ? `<a href="#creator-form" class="btn btn--light">Đăng mẫu mới ${icon('arrow',18)}</a>` : `<p class="helper-text">${state.user ? 'Liên hệ quản trị viên để được cấp quyền Creator.' : 'Đăng nhập bằng tài khoản được quản trị viên cấp quyền Creator để đăng mẫu.'}</p>`}
      <div class="creator-perks"><span>${icon('check-circle',17)} Đăng mẫu miễn phí</span><span>${icon('check-circle',17)} Kiểm duyệt minh bạch</span><span>${icon('check-circle',17)} Quản lý riêng</span></div>
    </div><div class="creator-art">${icon('pencil',120)}<span>${icon('sparkles',62)}</span></div></div></section>
    ${creator ? `<section class="section" id="creator-form"><div class="container creator-grid"><div><span class="eyebrow">ĐĂNG MẪU SÁNG TẠO</span><h2>Thiết kế tiếp theo<br><em>của bạn.</em></h2><p class="section-intro">Hiện tại, bạn có thể gửi mẫu dựa trên các bố cục tương tác có sẵn. Công cụ thiết kế tự do đang được phát triển.</p>
      <form class="creator-form" id="creator-template-form"><label class="field"><span>Tên mẫu</span><input name="title" required maxlength="60" placeholder="Ví dụ: Lời chúc bên hiên"/></label>
      <label class="field"><span>Mô tả ngắn</span><textarea name="subtitle" required maxlength="140" rows="3" placeholder="Một điều đặc biệt về thiết kế của bạn"></textarea></label>
      <div class="form-row"><label class="field"><span>Bảng màu chủ đạo</span><select name="theme"><option value="violet">Tím mộng mơ</option><option value="rose">Hồng tình cảm</option><option value="sunshine">Vàng rực rỡ</option><option value="sage">Xanh thiên nhiên</option><option value="sky">Xanh dịu nhẹ</option><option value="peach">Cam đào</option></select></label><label class="field"><span>Giá bán (VND)</span><input type="number" name="price" min="0" max="500000" step="1000" value="39000" required/></label></div>
      <p class="helper-text">Mẫu mới chuyển trạng thái “Chờ duyệt”. Chỉ xuất hiện trong thư viện sau khi được quản trị viên phê duyệt.</p>
      <button class="btn btn--dark" type="submit">Gửi mẫu để kiểm duyệt ${icon('arrow',18)}</button></form></div>
      <div class="creator-list"><h3>Mẫu của bạn <span>(${templates.length})</span></h3>${templates.length ? templates.map(t => `<div class="creator-list__row"><div class="mini-theme mini-theme--${e(t.theme)}">${icon('sparkles',19)}</div><div><strong>${e(t.title)}</strong><small>${formatPrice(t.price)}</small></div><span class="status-pill status-pill--${e(t.status)}">${t.status==='published'?'Đã đăng':t.status==='rejected'?'Bị từ chối':'Chờ duyệt'}</span></div>`).join('') : '<p class="creator-empty">Bạn chưa gửi mẫu nào. Hãy bắt đầu từ ý tưởng đầu tiên.</p>'}</div>
    </div></section>` : `<section class="section"><div class="container creator-benefits"><div class="section-heading section-heading--center"><span class="eyebrow">CÙNG MOMEVIA BẮT ĐẦU</span><h2>Một không gian cho <em>người sáng tạo.</em></h2></div><div class="steps-grid"><article class="step-card">${icon('pencil',30)}<h3>Thiết kế của riêng bạn</h3><p>Tạo phong cách khác biệt và xây dựng bộ sưu tập mẫu.</p></article><article class="step-card">${icon('layers',30)}<h3>Gian hàng rõ ràng</h3><p>Theo dõi trạng thái đăng mẫu và quản lý nội dung.</p></article><article class="step-card">${icon('heart',30)}<h3>Chạm tới cảm xúc</h3><p>Mỗi mẫu có cơ hội trở thành một kỷ niệm thật đẹp.</p></article></div></div></section>`}`;
}
function adminPage(templates, requests = []) {
  return `<section class="page-banner"><div class="container"><span class="eyebrow">MOMEVIA ADMIN</span><h1>Kiểm duyệt <em>mẫu thiết kế.</em></h1><p>Chỉ duyệt mẫu có nội dung phù hợp và quyền sử dụng tài nguyên hợp lệ.</p></div></section><section class="section"><div class="container"><h2 class="admin-title">Mẫu đang chờ duyệt (${templates.length})</h2>
    ${templates.length ? `<div class="admin-list">${templates.map(t => `<article class="admin-row"><div class="mini-theme mini-theme--${e(t.theme)}">${icon('sparkles',22)}</div><div><h3>${e(t.title)}</h3><p>${e(t.subtitle)}</p><small>${e(t.creator)} · ${formatPrice(t.price)}</small></div><div class="admin-actions"><button class="btn btn--dark" data-action="approve-template" data-id="${e(t.id)}">${icon('check',17)} Duyệt</button><button class="btn btn--outline" data-action="reject-template" data-id="${e(t.id)}">Từ chối</button></div></article>`).join('')}</div>` : `<div class="empty-state empty-state--panel">${icon('check-circle',42)}<h3>Đã xử lý tất cả mẫu</h3><p>Không có thiết kế nào đang chờ phê duyệt.</p></div>`}

    <div class="support-admin"><h2 class="admin-title">Yêu cầu hỗ trợ (${requests.length})</h2>
      ${requests.length ? `<div class="support-admin__list">${requests.map(t => `<article class="support-admin__item">
        <strong>${e(t.code)} · ${e(t.topic)}</strong><span>${e(t.name)} · ${e(t.email)}</span>
        <p>${e(t.message)}</p><small>${new Date(t.createdAt).toLocaleString('vi-VN')}</small>
      </article>`).join('')}</div>` : '<p class="helper-text">Chưa có yêu cầu hỗ trợ mới.</p>'}
    </div>
  </div></section>`;
}
function aboutPage() {
  const values = [
    { icon:'heart', title:'Cá nhân hóa', description:'Tên, hình ảnh và lời nhắn giúp mỗi món quà mang một câu chuyện riêng.' },
    { icon:'gift', title:'Trải nghiệm sống động', description:'Khám phá nhiều cảnh và tương tác, không chỉ dừng lại ở một tấm thiệp tĩnh.' },
    { icon:'shield', title:'Đơn giản và riêng tư', description:'Người nhận không cần tạo tài khoản; đường link được thiết kế để khó đoán.' },
  ];
  return `<section class="about-hero"><div class="container about-hero__inner">
    <span class="eyebrow eyebrow--outlined">VỀ CHÚNG TÔI · MOMEVIA</span>
    <h1>Chúng mình tin rằng<br><em>yêu thương cần được cảm nhận.</em></h1>
    <p>Momevia là nền tảng quà tặng số tương tác dành cho những người muốn tạo bất ngờ, gửi lời chúc và lưu giữ kỷ niệm ngay cả khi ở xa nhau.</p>
    ${buttonLink('/explore', 'Khám phá quà tặng')}
  </div></section>
  <section class="section section--white"><div class="container">
    <div class="section-heading section-heading--center"><span class="eyebrow">ĐIỀU CHÚNG MÌNH THEO ĐUỔI</span><h2>Mỗi món quà, <em>một kết nối.</em></h2><p>Trải nghiệm được thiết kế xoay quanh cả người gửi lẫn người nhận.</p></div>
    <div class="about-values">${values.map(value => `<article class="about-value"><span class="about-value__icon">${icon(value.icon, 25)}</span><h2>${value.title}</h2><p>${value.description}</p></article>`).join('')}</div>
  </div></section>
  <section class="section section--cream"><div class="container about-story">
    <div><span class="eyebrow">CÂU CHUYỆN SẢN PHẨM</span><h2>Không chỉ gửi đi.<br><em>Hãy để cảm xúc tiếp nối.</em></h2><p>Chọn một thiết kế, thêm dấu ấn riêng rồi gửi qua đường link. Người nhận có thể tương tác, khám phá bất ngờ và để lại lời hồi đáp trong cùng một trải nghiệm.</p><p>Momevia đang tiếp tục phát triển các tính năng mua mẫu và lưu giữ kỷ niệm. Bạn sẽ luôn được thông báo rõ trước khi phát sinh bất kỳ khoản phí nào.</p></div>
    <div class="about-story__card"><strong>“More than a greeting. A connection that continues.”</strong><span>MOMEVIA · GỬI ĐIỀU THƯƠNG, GIỮ KỶ NIỆM</span></div>
  </div></section>
  <section class="section section--white"><div class="container about-cta"><h2>Bắt đầu với một <em>lời chúc thật riêng.</em></h2><p>Không cần kỹ năng thiết kế. Chỉ cần một điều bạn muốn nói.</p>${buttonLink('/explore', 'Chọn mẫu quà đầu tiên')}</div></section>`;
}
function favoritesPage() {
  const templates = state.templates.filter(item => state.favorites.has(item.id));
  const pageData = paginateTemplates(templates, state.favoritePage);
  state.favoritePage = pageData.page;
  return `<section class="page-banner"><div class="container page-banner__inner">
    <span class="eyebrow">DANH SÁCH CỦA BẠN</span><h1>Mẫu quà <em>yêu thích.</em></h1>
    <p>Lưu những thiết kế bạn thích và quay lại bất cứ lúc nào.</p>
  </div></section><section class="section"><div class="container">
    <div class="dashboard-heading"><h2>Đã lưu ${templates.length} mẫu</h2>${buttonLink('/explore', 'Khám phá thêm')}</div>
    ${templates.length ? `<p class="catalog-range">Hiển thị ${pageData.from}–${pageData.to} / ${pageData.total} mẫu</p>
      <div class="template-grid">${pageData.items.map(templateCard).join('')}</div>${paginationMarkup(pageData, 'favorites')}`
    : `<div class="empty-state empty-state--panel">${icon('heart',36)}<h3>Chưa có mẫu yêu thích</h3>
      <p>Nhấn biểu tượng trái tim trên mẫu bạn thích để lưu vào đây.</p>${buttonLink('/explore','Xem kho mẫu')}</div>`}
  </div></section>`;
}
function errorPage(message) {
  return `<section class="section"><div class="container"><div class="empty-state empty-state--panel">${icon('shield',36)}<h2>Không thể hiển thị nội dung</h2><p>${e(message)}</p>${buttonLink('/','Về trang chủ')}</div></div></section>`;
}
function loadingPage() {
  return `<section class="section"><div class="container"><div class="centered-loading"><span class="loading-spinner"></span> Đang chuẩn bị những điều đặc biệt...</div></div></section>`;
}
async function render() {
  refreshNav();
  main.innerHTML = loadingPage();
  try {
    const segments = location.pathname.split('/').filter(Boolean);
    const [route, id] = segments;
    if (!route) main.innerHTML = home();
    else if (route === 'explore') main.innerHTML = explore();
    else if (route === 'template') {
      const template = state.templates.find(t => t.id === id);
      main.innerHTML = template ? templateDetail(template) : errorPage('Mẫu quà không tồn tại hoặc chưa được duyệt.');
    }
    else if (route === 'create') {
      const template = state.templates.find(t => t.id === id);
      main.innerHTML = template ? await createPage(template) : errorPage('Mẫu quà không tồn tại.');
      updatePreview();
    }
    else if (route === 'g' && id) {
      const [giftResponse, replyResponse] = await Promise.all([api.get(`/gifts/gifts/${id}`), api.get(`/gifts/gifts/${id}/replies`)]);
      main.innerHTML = giftPage(giftResponse.gift, replyResponse.replies);
    }
    else if (route === 'success' && id) {
      const result = await api.get(`/gifts/gifts/${id}`);
      main.innerHTML = successPage(result.gift);
    }
    else if (route === 'studio') {
      if (!state.user) {
        main.innerHTML = errorPage('Đăng nhập để xem các món quà của bạn.');
        setTimeout(() => requireLogin('/studio'), 50);
      } else {
        const [gifts, orders] = await Promise.all([api.get('/gifts/gifts/mine'), api.get('/checkout/orders')]);
        main.innerHTML = dashboard(gifts.gifts, orders.orders);
      }
    }
    else if (route === 'favorites') {
      if (!state.user) {
        main.innerHTML = errorPage('Đăng nhập để xem những mẫu bạn đã lưu.');
        setTimeout(() => requireLogin('/favorites'), 50);
      } else main.innerHTML = favoritesPage();
    }
    else if (route === 'creator') {
      let templates = [];
      if (state.user && ['creator','admin'].includes(state.user.role)) templates = (await api.get('/catalog/creator/templates')).templates;
      main.innerHTML = creatorPage(templates);
    }
    else if (route === 'admin') {
      if (state.user?.role !== 'admin') main.innerHTML = errorPage('Bạn cần quyền quản trị viên để truy cập.');
      else {
        const [pending, tickets] = await Promise.all([api.get('/catalog/admin/pending'), api.get('/support/admin/requests')]);
        main.innerHTML = adminPage(pending.templates, tickets.requests);
      }
    }
    else if (route === 'about') main.innerHTML = aboutPage();
    else if (route === 'login' || route === 'register') main.innerHTML = authPage(route);
    else if (route === 'policies' && legalPages[id]) main.innerHTML = legalPage(id);
    else main.innerHTML = errorPage('Trang bạn yêu cầu không tồn tại.');
    const anchor = location.hash.slice(1);
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({behavior:'smooth'}), 30);
    document.title = route === 'explore' ? 'Thư viện quà tặng — Momevia' : route === 'favorites' ? 'Mẫu yêu thích — Momevia' : route === 'creator' ? 'Creator Studio — Momevia' : route === 'login' ? 'Đăng nhập — Momevia' : route === 'register' ? 'Đăng ký — Momevia' : route === 'policies' && legalPages[id] ? `${legalPages[id].title} — Momevia` : 'Momevia — Gửi một điều đáng nhớ';
  } catch(error) {
    main.innerHTML = errorPage(error.message || 'Lỗi không xác định.');
  }
}
function updatePreview() {
  const name = document.getElementById('recipientName');
  const sender = document.getElementById('senderName');
  const message = document.getElementById('gift-message');
  if (name && document.getElementById('preview-name')) document.getElementById('preview-name').textContent = name.value || 'Người đặc biệt';
  if (sender && document.getElementById('preview-sender')) document.getElementById('preview-sender').textContent = `Từ ${sender.value || 'một người thương'}`;
  if (message && document.getElementById('preview-message')) document.getElementById('preview-message').textContent = message.value || 'Điều đẹp nhất là có bạn trong cuộc đời này.';
}
async function loadFavorites() {
  if (!state.user) {
    state.favorites = new Set();
    return;
  }
  const result = await api.get('/catalog/favorites');
  state.favorites = new Set(result.templateIds || []);
}
function syncFavoriteButtons() {
  document.querySelectorAll('[data-action="toggle-favorite"]').forEach(button => {
    const saved = state.favorites.has(button.dataset.id);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Bỏ yêu thích' : 'Lưu mẫu vào yêu thích');
    button.title = saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích';
  });
}
async function saveFavorite(templateId, saved) {
  await api.post('/catalog/favorites', {templateId, saved});
  if (saved) state.favorites.add(templateId);
  else state.favorites.delete(templateId);
  syncFavoriteButtons();
}
function closeModal() { modal.replaceChildren(); document.body.classList.remove('no-scroll'); }
function openModal(content) {
  modal.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="dialog" role="dialog" aria-modal="true" aria-label="Hộp thoại"><button class="icon-button dialog-close" data-action="close-modal" aria-label="Đóng">${icon('close',21)}</button>${content}</div></div>`;
  document.body.classList.add('no-scroll');
  modal.querySelector('input:not([disabled])')?.focus();
}
function authPage(mode = 'login') {
  const registering = mode === 'register';
  if (state.user) return `<section class="auth-page"><div class="container auth-signed-in"><div class="auth-signed-in__icon">${icon('check-circle', 30)}</div><h1>Bạn đã đăng nhập</h1><p>Tiếp tục khám phá và tạo món quà theo cách riêng của bạn.</p>${buttonLink('/studio', 'Về không gian của tôi')}</div></section>`;
  const googleLogo = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';
  const zaloLogo = 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg';
  const social = (provider, enabled, label, logo) => enabled
    ? `<a class="auth-social" href="/api/auth/${provider}" aria-label="${registering ? 'Đăng ký' : 'Đăng nhập'} bằng ${label}"><img class="provider-logo" src="${logo}" alt=""/><span>${label}</span></a>`
    : `<button type="button" class="auth-social" disabled title="${label} chưa được kết nối" aria-label="${label} chưa được kích hoạt"><img class="provider-logo" src="${logo}" alt=""/><span>${label}</span></button>`;
  const passwordField = (name, label, autocomplete) => `<label class="auth-field"><span class="auth-field__label">${label} <span class="auth-required" aria-hidden="true">*</span></span>
    <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon('lock', 19)}</span>
      <input name="${name}" type="password" autocomplete="${autocomplete}" minlength="${registering ? 10 : 1}" maxlength="128" required placeholder="${registering ? 'Tối thiểu 10 ký tự' : 'Nhập mật khẩu'}"/>
      <button type="button" class="auth-toggle-password" data-action="toggle-password" aria-label="Hiện mật khẩu" aria-pressed="false">${icon('eye',20)}</button>
    </span></label>`;
  return `<section class="auth-page auth-page--${mode}"><div class="container auth-layout">
    <aside class="auth-showcase" aria-label="Giới thiệu Momevia">
      <div class="auth-showcase__top"><img src="/assets/momevia-icon-128.png" width="43" height="43" alt=""/><span>momevia<span class="auth-showcase__dot">.</span></span></div>
      <div class="auth-showcase__art" aria-hidden="true">
        <div class="auth-showcase__halo auth-showcase__halo--outer"></div>
        <div class="auth-showcase__halo auth-showcase__halo--inner"></div>
        <span class="auth-showcase__spark auth-showcase__spark--one">${icon('sparkles', 31)}</span>
        <span class="auth-showcase__spark auth-showcase__spark--two">${icon('heart', 28)}</span>
        <img src="/assets/momevia-logo-3d.png" alt="" loading="eager" width="330" height="330"/>
      </div>
      <div class="auth-showcase__story">
        <span class="auth-showcase__eyebrow">MỘT ĐIỀU NHỎ THẬT ĐÁNG NHỚ</span>
        <h2>Gửi điều thương.<br/><em>Giữ kỷ niệm.</em></h2>
        <p>Chọn một thiết kế bạn yêu, thêm lời nhắn riêng và trao đi khoảnh khắc khiến ai đó mỉm cười.</p>
        <div class="auth-showcase__benefits"><span>${icon('check-circle',17)} Quà tặng mang dấu ấn riêng</span><span>${icon('check-circle',17)} Lưu lại những mẫu yêu thích</span></div>
      </div>
    </aside>
    <div class="auth-panel">
      <div class="auth-panel__top"><a href="/" data-link class="auth-back">${icon('arrow-left',17)} Trang chủ</a>
        <span class="auth-panel__welcome">${registering ? 'THAM GIA MOMEVIA' : 'TÀI KHOẢN MOMEVIA'}</span></div>
      <div class="auth-panel__intro"><h1>${registering ? 'Tạo tài khoản của bạn' : 'Rất vui khi bạn quay lại!'}</h1>
        <p class="auth-lead">${registering ? 'Chỉ vài bước để bắt đầu lưu mẫu, tạo quà và lưu giữ những kỷ niệm đẹp.' : 'Đăng nhập để tiếp tục tạo quà và xem lại những mẫu bạn đã lưu.'}</p></div>
      <form id="${registering ? 'register-form' : 'email-login-form'}" class="auth-form" aria-label="${registering ? 'Đăng ký tài khoản' : 'Đăng nhập tài khoản'}">
        ${registering ? `<label class="auth-field"><span class="auth-field__label">Họ và tên <span class="auth-required" aria-hidden="true">*</span></span>
          <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon('user',19)}</span><input name="name" autocomplete="name" minlength="2" maxlength="50" required placeholder="Tên hiển thị của bạn"/></span></label>` : ''}
        <label class="auth-field"><span class="auth-field__label">Email <span class="auth-required" aria-hidden="true">*</span></span>
          <span class="auth-input"><span class="auth-field-icon" aria-hidden="true">${icon('mail',19)}</span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required placeholder="tenban@example.com"/></span></label>
        ${passwordField('password', 'Mật khẩu', registering ? 'new-password' : 'current-password')}
        ${registering ? passwordField('confirmPassword', 'Xác nhận mật khẩu', 'new-password') : ''}
        ${registering ? `<p class="auth-password-hint">${icon('shield',16)} Mật khẩu ít nhất 10 ký tự, có chữ cái và số.</p>` : ''}
        <p class="auth-inline-error" role="alert" hidden></p>
        <button class="btn btn--dark btn--wide auth-submit" type="submit"><span>${registering ? 'Tạo tài khoản' : 'Đăng nhập'}</span>${icon('arrow',18)}</button>
      </form>
      <div class="auth-divider" role="separator"><span>Hoặc ${registering ? 'đăng ký' : 'đăng nhập'} bằng</span></div>
      <div class="auth-buttons">${social('google', state.providers.google, 'Google', googleLogo)}${social('zalo', state.providers.zalo, 'Zalo', zaloLogo)}</div>
      ${!state.providers.google || !state.providers.zalo ? '<p class="auth-provider-note">Phương thức chưa kết nối sẽ được kích hoạt khi hệ thống hỗ trợ.</p>' : ''}
      <p class="auth-switch">${registering ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'} <a href="${registering ? '/login' : '/register'}" data-link>${registering ? 'Đăng nhập ngay' : 'Đăng ký ngay'}</a></p>
      <p class="auth-policy-note">Bằng việc tiếp tục, bạn đồng ý với <a href="/policies/general" data-link>Quy định chung</a> và <a href="/policies/privacy" data-link>Chính sách bảo mật</a>.</p>
    </div>
  </div></section>`;
}
function openSupport() {
  const displayName = state.user?.name || '';
  const displayEmail = state.user?.email || '';
  openModal(`<div class="support-modal">
    <span class="eyebrow">TRUNG TÂM HỖ TRỢ</span>
    <h2>Chúng mình có thể giúp gì?</h2>
    <p>Gửi câu hỏi hoặc mô tả vấn đề bạn gặp phải. Yêu cầu sẽ được ghi nhận trong hệ thống.</p>
    <form id="support-form" class="support-form">
      <label class="field"><span>Họ tên</span><input name="name" required maxlength="60" value="${e(displayName)}" placeholder="Tên của bạn"/></label>
      <label class="field"><span>Email liên hệ</span><input type="email" name="email" required maxlength="254" value="${e(displayEmail)}" placeholder="ban@example.com"/></label>
      <label class="field"><span>Vấn đề cần hỗ trợ</span><select name="topic" required>
        <option value="Tài khoản">Tài khoản</option>
        <option value="Tạo và chia sẻ quà">Tạo và chia sẻ quà</option>
        <option value="Kho mẫu">Kho mẫu</option>
        <option value="Báo lỗi">Báo lỗi</option>
        <option value="Khác">Khác</option>
      </select></label>
      <label class="field"><span>Nội dung</span><textarea name="message" required minlength="15" maxlength="2000" rows="4" placeholder="Mô tả cụ thể để chúng mình hỗ trợ..."></textarea></label>
      <button type="submit" class="btn btn--dark btn--wide">Gửi yêu cầu ${icon('send',17)}</button>
    </form>
    <p class="support-note">Vui lòng không gửi mật khẩu hoặc thông tin thanh toán nhạy cảm.</p>
  </div>`);
}
function openAccountMenu() {
  const menu = document.getElementById('account-menu');
  if (menu) menu.hidden = !menu.hidden;
}
async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Đã sao chép đường link vào bộ nhớ tạm.');
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    toast('Đã sao chép đường link.');
  }
}
async function handleAction(action, element) {
  if (action === 'login') return navigate('/login');
  if (action === 'register') return navigate('/register');
  if (action === 'support') return openSupport();
  if (action === 'back-to-top') { window.scrollTo({top:0,behavior:'smooth'}); return; }
  if (action === 'toggle-favorite') {
    const templateId = element.dataset.id;
    if (!state.user) {
      state.pendingFavoriteId = templateId;
      state.afterLogin = location.pathname + location.hash;
      navigate('/login');
      return;
    }
    element.disabled = true;
    try {
      const saved = !state.favorites.has(templateId);
      await saveFavorite(templateId, saved);
      toast(saved ? 'Đã lưu mẫu vào yêu thích.' : 'Đã bỏ mẫu khỏi yêu thích.');
      if (location.pathname === '/favorites') render();
    } finally { element.disabled = false; }
    return;
  }
  if (action === 'demo-mode') {
    const demo = document.getElementById('auth-demo');
    if (demo) { demo.hidden = !demo.hidden; demo.querySelector('input')?.focus(); }
    return;
  }
  if (action === 'toggle-password') {
    const input = element.parentElement?.querySelector('input');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const showing = input.type === 'text';
    element.innerHTML = icon(showing ? 'eye-off' : 'eye', 19);
    element.setAttribute('aria-label', showing ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    element.setAttribute('aria-pressed', String(showing));
    return;
  }
  if (action === 'close-modal') return closeModal();
  if (action === 'account-menu') return openAccountMenu();
  if (action === 'toggle-menu') {
    const menu = document.getElementById('mobile-nav');
    menu.hidden = !menu.hidden;
    element.setAttribute('aria-expanded', String(!menu.hidden));
    return;
  }
  if (action === 'logout') {
    await api.post('/auth/logout');
    state.user = null;
    state.favorites = new Set();
    toast('Bạn đã đăng xuất.');
    navigate('/');
    return;
  }
  if (action === 'clear-filters') {
    state.catalogPage = 1;
    state.filter = 'Tất cả';
    state.search = '';
    state.freeOnly = false;
    const search = document.getElementById('template-search');
    const style = document.getElementById('style-filter');
    const free = document.getElementById('free-filter');
    if (search) search.value = '';
    if (style) style.value = 'Tất cả';
    if (free) free.checked = false;
    syncCatalogResults();
    return;
  }
  if (action === 'set-page') {
    const page = Number(element.dataset.page);
    const list = element.dataset.list;
    if (list === 'catalog' && Number.isInteger(page)) {
      const result = paginateTemplates(matchingTemplates(), page);
      if (state.catalogPage === result.page) return;
      state.catalogPage = result.page;
      syncCatalogResults();
      document.getElementById('catalog-range')?.scrollIntoView({behavior:'smooth', block:'start'});
    } else if (list === 'favorites' && Number.isInteger(page)) {
      const templates = state.templates.filter(item => state.favorites.has(item.id));
      const result = paginateTemplates(templates, page);
      if (state.favoritePage === result.page) return;
      state.favoritePage = result.page;
      render().then(() => document.querySelector('.dashboard-heading')?.scrollIntoView({behavior:'smooth', block:'start'}));
    }
    return;
  }
  if (action === 'demo-buy') {
    if (!requireLogin(location.pathname)) return;
    const id = element.dataset.id;
    element.disabled = true;
    element.textContent = 'Đang chuẩn bị bản dùng thử...';
    try {
      await api.post('/checkout/orders/demo-purchase', {templateId:id});
      toast('Đã kích hoạt mẫu dùng thử, không phát sinh thanh toán.');
      render();
    } catch(error) { element.disabled=false; toast(error.message, 'error'); render(); }
    return;
  }
  if (action === 'open-gift') {
    document.getElementById('recipient-card')?.classList.add('is-surprise');
    return;
  }
  if (action === 'reveal-gift') {
    state.giftOpened = true;
    document.getElementById('recipient-card')?.classList.remove('is-surprise');
    document.getElementById('recipient-card')?.classList.add('is-open');
    return;
  }
  if (action === 'copy-link') return copyText(element.dataset.value);
  if (action === 'approve-template' || action === 'reject-template') {
    const id = encodeURIComponent(element.dataset.id);
    if (action === 'approve-template') {
      await api.post(`/catalog/admin/templates/${id}/approve`);
      toast('Đã duyệt mẫu thiết kế.');
      await loadTemplates();
      render();
    } else {
      openModal(`<div class="reject-modal"><span class="eyebrow">KIỂM DUYỆT NỘI DUNG</span><h2>Từ chối mẫu thiết kế</h2><p>Vui lòng cung cấp lý do để Creator biết cần chỉnh sửa điểm nào.</p><form id="reject-form" data-template-id="${e(id)}"><label class="field"><span>Lý do từ chối</span><textarea name="reason" rows="4" maxlength="250" required placeholder="Ví dụ: Cần bổ sung giấy phép sử dụng hình ảnh..."></textarea></label><button type="submit" class="btn btn--dark btn--wide">Xác nhận từ chối ${icon('arrow',17)}</button></form></div>`);
    }
    return;
  }
  if (action === 'qr') {
    const link = element.dataset.value;
    const url = giftQrDataUrl(link);
    openModal(`<div class="qr-modal"><h2>Mã QR của món quà</h2><p>Người nhận chỉ cần quét mã để mở thiệp.</p><img class="qr-image" src="${e(url)}" alt="Mã QR mở món quà"/><button class="btn btn--outline btn--wide" data-action="copy-link" data-value="${e(link)}">${icon('copy',17)} Sao chép link</button></div>`);
    return;
  }
}

document.addEventListener('click', async event => {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl && !actionEl.disabled) {
    // Chỉ đóng khi bấm trực tiếp vào nền modal, không chặn biểu mẫu và liên kết bên trong.
    if (actionEl.classList.contains('modal-backdrop') && event.target !== actionEl) return;
    event.preventDefault();
    try { await handleAction(actionEl.dataset.action, actionEl); }
    catch(error) { toast(error.message || 'Có lỗi xảy ra.', 'error'); }
    return;
  }
  const link = event.target.closest('a[data-link]');
  if (link) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    event.preventDefault();
    const path = new URL(link.href).pathname + new URL(link.href).hash;
    navigate(path);
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'template-search') {
    state.search = event.target.value;
    state.catalogPage = 1;
    syncCatalogResults();
  }
  if (['recipientName','senderName','gift-message'].includes(event.target.id)) updatePreview();
});
document.addEventListener('change', async event => {
  if (event.target.id === 'style-filter') {
    state.filter = event.target.value;
    state.catalogPage = 1;
    syncCatalogResults();
    return;
  }
  if (event.target.id === 'free-filter') {
    state.freeOnly = event.target.checked;
    state.catalogPage = 1;
    syncCatalogResults();
    return;
  }
  if (event.target.id !== 'gift-photo') return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) {
    toast('Ảnh phải là PNG/JPG/WebP và nhỏ hơn 2 MB.', 'error');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.photoDataUrl = String(reader.result);
    const preview = document.getElementById('preview-photo');
    if (preview) {
      preview.hidden = false;
      preview.replaceChildren();
      const img = document.createElement('img');
      img.src = state.photoDataUrl;
      img.alt = 'Ảnh xem trước';
      preview.appendChild(img);
    }
    document.querySelector('.photo-drop strong').textContent = file.name;
  };
  reader.readAsDataURL(file);
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['demo-login-form','email-login-form','register-form','create-gift-form','reply-form','creator-template-form','admin-login-form','reject-form','support-form'].includes(form.id)) return;
  event.preventDefault();
  const submit = form.querySelector('[type=submit]');
  const inlineError = form.querySelector('.auth-inline-error');
  if (inlineError) { inlineError.hidden = true; inlineError.textContent = ''; }
  if (submit) submit.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === 'register-form' || form.id === 'email-login-form') {
      if (form.id === 'register-form' && data.password !== data.confirmPassword) {
        throw new Error('Xác nhận mật khẩu không khớp.');
      }
      const endpoint = form.id === 'register-form' ? '/auth/register' : '/auth/login';
      const result = await api.post(endpoint, data);
      state.user = result.user;
      await loadFavorites();
      if (state.pendingFavoriteId) {
        await saveFavorite(state.pendingFavoriteId, true);
        state.pendingFavoriteId = null;
      }
      toast(form.id === 'register-form' ? 'Tạo tài khoản thành công.' : 'Đăng nhập thành công.');
      const target = state.afterLogin || '/studio';
      state.afterLogin = null;
      navigate(target);
    } else if (form.id === 'demo-login-form') {
      let deviceId = localStorage.getItem('momevia-demo-device');
      if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('momevia-demo-device', deviceId); }
      const result = await api.post('/auth/demo', {name:data.name, deviceId});
      state.user = result.user;
      closeModal();
      toast(`Xin chào ${result.user.name}.`);
      const target = state.afterLogin || '/studio';
      state.afterLogin = null;
      navigate(target);
    } else if (form.id === 'admin-login-form') {
      const result = await api.post('/auth/demo-admin', {code:data.code});
      state.user = result.user;
      toast('Đã đăng nhập quyền quản trị demo.');
      navigate('/admin');
    } else if (form.id === 'create-gift-form') {
      const result = await api.post('/gifts/gifts', {...data, templateId:form.dataset.templateId, photoDataUrl:state.photoDataUrl});
      toast('Món quà đã được tạo thành công.');
      navigate(`/success/${result.gift.slug}`);
    } else if (form.id === 'support-form') {
      const result = await api.post('/support/requests', data);
      openModal(`<div class="support-modal support-success">
        <span class="support-success__icon">${icon('check-circle', 38)}</span>
        <h2>Đã ghi nhận yêu cầu</h2>
        <p>Hãy lưu mã bên dưới để tiện đối chiếu khi liên hệ với đội ngũ hỗ trợ.</p>
        <div class="support-success__code"><strong>${e(result.ticket.code)}</strong>
          <button type="button" data-action="copy-link" data-value="${e(result.ticket.code)}" aria-label="Sao chép mã yêu cầu">${icon('copy',18)} Sao chép</button></div>
        <p class="support-note">Yêu cầu đã được lưu vào hệ thống. Thời gian phản hồi chưa được xác định.</p>
      </div>`);
    } else if (form.id === 'reply-form') {
      await api.post(`/gifts/gifts/${form.dataset.slug}/replies`, data);
      toast('Lời hồi đáp đã được gửi.');
      const response = await api.get(`/gifts/gifts/${form.dataset.slug}/replies`);
      document.getElementById('reply-list').innerHTML = renderReplies(response.replies);
      document.querySelector('.memory-container h3 span').textContent = `(${response.replies.length})`;
      form.querySelector('textarea').value = '';
    } else if (form.id === 'creator-template-form') {
      await api.post('/catalog/creator/templates', {...data, price:Number(data.price)});
      toast('Đã gửi mẫu cho quản trị viên kiểm duyệt.');
      render();
    } else if (form.id === 'reject-form') {
      await api.post(`/catalog/admin/templates/${encodeURIComponent(form.dataset.templateId)}/reject`, {reason:data.reason});
      closeModal();
      toast('Đã từ chối mẫu và ghi nhận lý do.');
      await loadTemplates();
      render();
    }
  } catch(error) {
    if (inlineError) {
      inlineError.textContent = error.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
      inlineError.hidden = false;
      inlineError.scrollIntoView({behavior:'smooth', block:'nearest'});
    } else toast(error.message || 'Không xử lý được yêu cầu.', 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});
window.addEventListener('popstate', render);
function updateScrollTools() {
  const button = document.getElementById('back-to-top');
  if (button) button.hidden = window.scrollY < 420;
}
window.addEventListener('scroll', updateScrollTools, {passive:true});
updateScrollTools();
async function loadTemplates() {
  const data = await api.get('/catalog/templates');
  state.templates = data.templates;
}
async function boot() {
  try {
    const [identity, providers] = await Promise.all([api.get('/auth/me'), api.get('/auth/providers')]);
    state.user = identity.user;
    state.providers = providers;
    await loadTemplates();
    await loadFavorites();
  } catch(error) {
    toast(error.message, 'error');
  }
  await render();
}
boot();
