import { escapeHtml as e } from '../core/api.js';
import { icon } from '../ui/icons.js';


export function createLayout({ state, header, footer }) {
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
      activeLink('/pricing', 'Bảng giá'),
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
        <div class="footer-column"><h4>Khám phá</h4><a href="/explore" data-link>Thư viện mẫu</a><a href="/creator" data-link>Trở thành Creator</a><a href="/pricing" data-link>Bảng giá & gói dự kiến</a></div>
        <div class="footer-column"><h4>Thông tin</h4><a href="/about" data-link>Về chúng tôi</a><a href="/favorites" data-link>Mẫu yêu thích</a><button class="footer-contact" data-action="support">Liên hệ hỗ trợ</button></div>
        <div class="footer-column"><h4>Chính sách</h4><a href="/policies/general" data-link>Chính sách & Quy định chung</a><a href="/policies/payment" data-link>Chính sách thanh toán</a><a href="/policies/privacy" data-link>Chính sách bảo mật</a><a href="/policies/content" data-link>Nội dung & Bản quyền</a></div>
        <div class="footer-news"><span class="footer-bloom">${icon('sparkles', 22)}</span><h3>Một bất ngờ nhỏ, một niềm vui lớn.</h3><a href="/explore" data-link>Khám phá ngay ${icon('arrow', 17)}</a></div>
      </div><div class="container footer-bottom"><span>© 2026 Momevia. Bảo lưu mọi quyền.</span><span>Thiết kế với sự quan tâm đến từng chi tiết.</span></div>
    `;
  }

  return { activeLink, refreshNav };
}
