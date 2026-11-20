import { escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { attr, localeControl, text } from "../core/i18n.js";

export function createLayout({ state, header, footer, homeClosing }) {
  let headerKey;
  let footerIsHome;

  function activeLink(path, label, section = "") {
    const current = location.pathname;
    const hash = location.hash;
    const active =
      path === "/"
        ? current === "/" && hash !== "#how-it-works"
        : section
          ? current === "/" && hash === "#how-it-works"
          : current === path ||
            (path === "/explore" &&
              ["/template/", "/create/"].some((prefix) =>
                current.startsWith(prefix),
              ));
    return `<a href="${path}" data-link class="${active ? "is-active" : ""}" ${active ? 'aria-current="page"' : ""}>${label}</a>`;
  }

  function refreshNav() {
    const signedIn = Boolean(state.user);
    const home = location.pathname === '/';
    const links = [
      activeLink("/", text("shell.nav.home")),
      activeLink("/explore", text("shell.nav.explore")),
      activeLink("/#how-it-works", text("shell.nav.how"), "how-it-works"),
      activeLink("/creator", text("shell.nav.forCreators")),
      activeLink("/pricing", text("shell.pages.pricing")),
      activeLink("/about", text("shell.nav.about")),
    ];
    const studioActive =
      location.pathname === "/studio" || location.pathname === "/favorites";
    const nextHeaderKey = JSON.stringify([
      location.pathname, location.hash, state.user?.name, state.user?.role, signedIn,
    ]);
    if (headerKey !== nextHeaderKey) {
      header.innerHTML = `
      <div class="container wrap nav-inner">
        <a class="skip-link" href="#main">${text("shell.skip")}</a>
        <a class="brand" href="/" data-link ${attr("aria-label", "shell.nav.homeLabel")}>
          <img class="brand-mark" src="/assets/momevia-brand-92.webp" alt="" width="50" height="50" loading="lazy" />
          <span class="brand-name">momevia<span class="brand-period">.</span></span>
        </a>
        <nav class="nav-links" ${attr("aria-label", "shell.nav.main")}>${links.join("")}</nav>
        <div class="nav-actions">
          ${localeControl()}
          ${
            signedIn
              ? `
            <a class="nav-studio ${studioActive ? "is-current" : ""}" href="/studio" data-link ${studioActive ? 'aria-current="page"' : ""}>${icon("layers", 17)} ${text("shell.nav.studio")}</a>
            <button type="button" class="avatar-button" data-action="account-menu" aria-controls="account-menu" aria-expanded="false" ${attr("aria-label", "shell.nav.namedAccount", { name: state.user.name })} ${attr("title", "shell.nav.account")}>${e(state.user.name.charAt(0).toUpperCase())}</button>
          `
              : `<a class="btn btn--dark login-trigger" href="/login" data-link>${text("shell.pages.login")}</a>`
          }
          <button type="button" class="icon-button nav-toggle" data-action="toggle-menu" ${attr("aria-label", "shell.nav.openMenu")} aria-expanded="false" aria-controls="mobile-nav">${icon("menu", 22)}</button>
        </div>
      </div>
      ${
        signedIn
          ? `<div class="account-menu" id="account-menu" hidden>
        <div class="account-menu__meta"><strong>${e(state.user.name)}</strong><span>${text(state.user.role === "creator" ? "common.roles.creator" : state.user.role === "admin" ? "common.roles.admin" : "common.roles.sender")}</span></div>
        <a href="/studio" data-link>${icon("layers", 16)} ${text("shell.nav.myGifts")}</a>
        <a href="/favorites" data-link>${icon("heart", 16)} ${text("shell.pages.favorites")}</a>
        <a href="/creator" data-link>${icon("pencil", 16)} ${text("shell.pages.creator")}</a>
        ${state.user.role === "admin" ? `<a href="/admin" data-link>${icon("shield", 16)} ${text("shell.nav.moderation")}</a><a href="/admin/payments" data-link>${icon("shield", 16)} ${text("shell.pages.adminPayments")}</a>` : ""}
        <button type="button" data-action="logout">${icon("log-out", 16)} ${text("shell.nav.signOut")}</button>
      </div>`
          : ""
      }
      <div class="mobile-nav" id="mobile-nav" hidden>
        ${localeControl()}
        ${links.join("")}
        ${signedIn ? `<a href="/studio" data-link>${text("shell.nav.studio")}</a><a href="/favorites" data-link>${text("shell.pages.favorites")}</a>` : `<a href="/login" data-link>${text("shell.pages.login")}</a>`}
        ${state.user?.role === 'admin' ? `<a href="/admin" data-link>${text("shell.nav.moderation")}</a><a href="/admin/payments" data-link>${text("shell.pages.adminPayments")}</a>` : ''}
      </div>
    `;
      headerKey = nextHeaderKey;
    }
    if (footerIsHome === home) return;
    footer.innerHTML = `
      <div class="container wrap">
      ${home && homeClosing ? `<div class="home-footer-faq">${homeClosing()}</div>` : ''}
      <div class="footer-grid">
        <div class="footer-about"><div class="footer-logo">momevia<span>.</span></div>
        <p>${text("shell.footer.pitch")}</p></div>
        <div class="footer-column"><h3>${text("shell.footer.discover")}</h3><a href="/explore" data-link>${text("shell.footer.library")}</a><a href="/creator" data-link>${text("shell.footer.becomeCreator")}</a><a href="/pricing" data-link>${text("shell.footer.plans")}</a></div>
        <div class="footer-column"><h3>${text("shell.footer.information")}</h3><a href="/about" data-link>${text("shell.nav.about")}</a><a href="/favorites" data-link>${text("shell.pages.favorites")}</a><button class="footer-contact" data-action="support">${text("common.actions.support")}</button></div>
        <div class="footer-column"><h3>${text("shell.footer.policies")}</h3><a href="/policies/general" data-link>${text("shell.footer.general")}</a><a href="/policies/payment" data-link>${text("shell.footer.payments")}</a><a href="/policies/privacy" data-link>${text("shell.footer.privacy")}</a><a href="/policies/content" data-link>${text("shell.footer.content")}</a></div>
      </div>
      <div class="footer-bottom"><span>${text("shell.footer.copyright")}</span></div>
      </div>
    `;
    footerIsHome = home;
  }

  return { activeLink, refreshNav };
}
